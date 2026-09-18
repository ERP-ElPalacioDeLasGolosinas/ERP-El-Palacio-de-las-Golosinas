import { PlaceholderModule } from "@/components/layout/PlaceholderModule";

export const metadata = {
  title: "Emitir comprobante | Palacio · ERP",
};

export default function EmitirComprobanteVentaPage() {
  return (
    <PlaceholderModule
      crumbs={[
        { label: "Ventas" },
        { label: "Comprobantes", href: "/ventas/comprobantes" },
        { label: "Emitir comprobante" },
      ]}
      title="Emitir comprobante"
      description="Emisión de comprobante de venta"
      hu="V-11"
    />
  );
}
