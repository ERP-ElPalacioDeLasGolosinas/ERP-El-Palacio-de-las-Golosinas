import { listarClientes } from "@/lib/clientes/actions";
import { listarDepositos } from "@/lib/depositos/actions";
import { TIPOS_MEDIO_NO_CAJA } from "@/lib/cajas/constantes";
import { listarMediosPago } from "@/lib/medios-pago/actions";
import { listarTiposComprobanteVenta, obtenerListaVigenteVenta } from "@/lib/ventas/actions";

/**
 * Datos que necesita `VentaForm` (clientes, comprobantes, depósitos, listas
 * vigentes y medios admitidos en caja). Lo usan el alta de venta y el POS de caja.
 */
export async function cargarDatosFormularioVenta() {
  const [clientesRes, tiposRes, depositosRes, listaMayorista, listaMinorista, mediosRes] = await Promise.all([
    listarClientes(false),
    listarTiposComprobanteVenta(),
    listarDepositos(false),
    obtenerListaVigenteVenta("Mayorista"),
    obtenerListaVigenteVenta("Minorista"),
    listarMediosPago(false),
  ]);

  const error =
    clientesRes.error ||
    tiposRes.error ||
    depositosRes.error ||
    listaMayorista.error ||
    listaMinorista.error ||
    mediosRes.error ||
    null;

  const clientes = (clientesRes.data ?? [])
    .filter((c) => c.activo)
    .map((c) => ({
      id_cliente: c.id_cliente,
      nombre_cliente: c.nombre_cliente,
      documento_cliente: c.documento_cliente,
      lista_precio: c.lista_precio,
      es_consumidor_final: Boolean(c.es_consumidor_final),
    }));

  const tipos = (tiposRes.data ?? []).map((t) => ({
    id_tipo_comprobante: t.id_tipo_comprobante,
    nombre_tipo_comprobante: t.nombre_tipo_comprobante,
    letra: t.letra,
  }));

  const depositos = (depositosRes.data ?? [])
    .filter((d) => d.activo)
    .map((d) => ({ id_deposito: d.id_deposito, nombre_deposito: d.nombre_deposito }));

  const medios = (mediosRes.data ?? [])
    .filter((m) => m.activo && !TIPOS_MEDIO_NO_CAJA.has(m.tipo))
    .map((m) => ({
      id_medio_pago: m.id_medio_pago,
      nombre_medio_pago: m.nombre_medio_pago,
      tipo: m.tipo,
      requiere_referencia: Boolean(m.requiere_referencia),
    }));

  return {
    error,
    clientes,
    tipos,
    depositos,
    medios,
    listas: { Mayorista: listaMayorista.data, Minorista: listaMinorista.data },
  };
}
