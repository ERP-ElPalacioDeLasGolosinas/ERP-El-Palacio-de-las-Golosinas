import Link from "next/link";
import { listarClientes } from "@/lib/clientes/actions";
import { listarDepositos } from "@/lib/depositos/actions";
import { listarCajas } from "@/lib/cajas/actions";
import { TIPOS_MEDIO_NO_CAJA } from "@/lib/cajas/constantes";
import { listarMediosPago } from "@/lib/medios-pago/actions";
import { listarTiposComprobanteVenta, obtenerListaVigenteVenta } from "@/lib/ventas/actions";
import { VentaForm } from "@/components/ventas/VentaForm";
import { PageHeader } from "@/components/layout/PageHeader";

export const metadata = {
  title: "Registrar venta | Palacio · ERP",
};

export default async function RegistrarVentaPage() {
  const [clientesRes, tiposRes, depositosRes, listaMayorista, listaMinorista, cajasRes, mediosRes] =
    await Promise.all([
      listarClientes(false),
      listarTiposComprobanteVenta(),
      listarDepositos(false),
      obtenerListaVigenteVenta("Mayorista"),
      obtenerListaVigenteVenta("Minorista"),
      listarCajas({ estado: "Abierta" }),
      listarMediosPago(false),
    ]);

  const error =
    clientesRes.error ||
    tiposRes.error ||
    depositosRes.error ||
    listaMayorista.error ||
    listaMinorista.error ||
    cajasRes.error ||
    mediosRes.error;

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

  const faltantes = ["Mayorista", "Minorista"].filter(
    (t) => !(t === "Mayorista" ? listaMayorista.data : listaMinorista.data)
  );

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 md:px-8">
      <PageHeader
        crumbs={[
          { label: "Ventas" },
          { label: "Ventas", href: "/ventas/ordenes" },
          { label: "Registrar venta" },
        ]}
        title="Registrar venta"
        description="Mayorista: se emite el comprobante y el cobro queda para Tesorería, una vez despachada. Minorista y consumidor final: se cobran en la caja abierta y quedan pagadas."
      />

      {error ? (
        <div className="palacio-card border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-950">
          <p className="font-medium">No se pudieron cargar los datos del formulario</p>
          <p className="mt-1 text-amber-900/80">{error}</p>
        </div>
      ) : (
        <>
          {faltantes.length > 0 ? (
            <div className="palacio-card mb-6 border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-950">
              <p className="font-medium">
                No hay lista de precios {faltantes.join(" ni ")} vigente
              </p>
              <p className="mt-1 text-amber-900/80">
                Las ventas de ese tipo no se pueden registrar hasta que haya una.{" "}
                <Link href="/ventas/listas-de-precios" className="underline">
                  Ir a Listas de precios
                </Link>
              </p>
            </div>
          ) : null}
          <VentaForm
            clientes={clientes}
            tipos={tipos}
            depositos={depositos}
            listas={{ Mayorista: listaMayorista.data, Minorista: listaMinorista.data }}
            medios={medios}
            cajasAbiertas={(cajasRes.data ?? [])
              .filter((c) => c.id_deposito)
              .map((c) => ({
                id_caja: c.id_caja,
                id_deposito: c.id_deposito,
                nombre_deposito: c.nombre_deposito,
                abierta_por_nombre: c.abierta_por_nombre,
                fecha_apertura: c.fecha_apertura,
                monto_inicial: Number(c.monto_inicial) || 0,
              }))}
          />
        </>
      )}
    </div>
  );
}
