"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { notificarEstadoPedido } from "@/lib/email/pedido";
import { createClient } from "@/lib/supabase/server";
import { guardarCarrito, leerCarrito } from "@/lib/tienda/carrito";
import { mensajeErrorPedido, mensajeErrorRegistro } from "@/lib/tienda/errores";
import { procesarPagoTarjeta, procesarTransferencia } from "@/lib/tienda/pasarela-simulada";

const MEDIOS = ["Transferencia", "Tarjeta de débito", "Tarjeta de crédito"];
const ENTREGAS = ["Envío a domicilio", "Retiro por sucursal"];

export async function completarDatosCliente(_prev, formData) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_cliente_web_completar_datos", {
    p_documento_cliente: String(formData.get("documento") ?? ""),
    p_telefono_cliente: String(formData.get("telefono") ?? ""),
    p_direccion_cliente: String(formData.get("direccion") ?? "") || null,
  });
  if (error) return { error: mensajeErrorRegistro(error) };
  revalidatePath("/tienda/checkout");
  return { error: null };
}

export async function confirmarPedido(formData) {
  const medio = String(formData?.get?.("medio") ?? "Transferencia");
  if (!MEDIOS.includes(medio)) return { error: mensajeErrorPedido({ code: "PWB02" }) };

  const entrega = String(formData?.get?.("entrega") ?? "");
  if (!ENTREGAS.includes(entrega)) return { error: mensajeErrorPedido({ code: "PWB13" }) };
  const campo = (n) => String(formData.get(n) ?? "").trim() || null;

  const items = await leerCarrito();
  if (items.length === 0) return { error: mensajeErrorPedido({ code: "PWB03" }) };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_pedido_web_registrar", {
    p_items: items.map((l) => ({ id_producto: l.id_producto, cantidad: l.cantidad })),
    p_medio: medio,
    p_tipo_entrega: entrega,
    p_envio_destinatario: entrega === "Envío a domicilio" ? campo("destinatario") : null,
    p_envio_direccion: entrega === "Envío a domicilio" ? campo("direccion") : null,
    p_envio_localidad: entrega === "Envío a domicilio" ? campo("localidad") : null,
    p_envio_observaciones: entrega === "Envío a domicilio" ? campo("observaciones") : null,
    p_id_deposito_retiro: entrega === "Retiro por sucursal" ? campo("sucursal") : null,
  });
  if (error) return { error: mensajeErrorPedido(error) };

  const pedido = Array.isArray(data) ? data[0] : data;
  await guardarCarrito([]);

  // Aviso por mail (E-06); un fallo no afecta al pedido ya registrado.
  const { data: auth } = await supabase.auth.getUser();
  await notificarEstadoPedido({
    email: auth?.user?.email,
    numero: pedido.numero,
    estado: "Pendiente de pago",
    importeTotal: pedido.importe_total,
  });

  redirect(`/tienda/checkout/pago?pedido=${encodeURIComponent(pedido.id_pedido)}`);
}

// Paga un pedido pendiente en la pasarela simulada (D-034). Si la pasarela rechaza, el pedido
// sigue pendiente y se devuelve el error para reintentar.
export async function pagarPedido(_prev, formData) {
  const idPedido = String(formData.get("pedido") ?? "");
  const metodo = String(formData.get("metodo") ?? "");
  if (!idPedido) return { error: mensajeErrorPedido({ code: "PWB05" }) };

  const resultado =
    metodo === "transferencia"
      ? await procesarTransferencia()
      : metodo === "debito" || metodo === "credito"
        ? await procesarPagoTarjeta({
            tipo: metodo,
            numero: formData.get("numero"),
            titular: formData.get("titular"),
            vencimiento: formData.get("vencimiento"),
            cvv: formData.get("cvv"),
            cuotas: formData.get("cuotas") ?? 1,
          })
        : { aprobado: false, error: "Elegí un medio de pago válido." };
  if (!resultado.aprobado) return { error: resultado.error };

  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_pedido_web_pagar", {
    p_id_pedido: idPedido,
    p_referencia: resultado.referencia,
  });
  if (error) return { error: mensajeErrorPedido(error) };

  // Aviso por mail (E-06); un fallo no afecta al pago ya registrado.
  const [{ data: auth }, { data: ped }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.rpc("fn_pedido_web_mi_obtener", { p_id_pedido: idPedido }),
  ]);
  const pedido = Array.isArray(ped) ? ped[0] : ped;
  if (pedido) {
    await notificarEstadoPedido({
      email: auth?.user?.email,
      numero: pedido.numero,
      estado: "Pagado",
      importeTotal: pedido.importe_total,
    });
  }

  revalidatePath("/tienda/cuenta/pedidos");
  redirect(`/tienda/checkout/confirmado?pedido=${encodeURIComponent(idPedido)}`);
}
