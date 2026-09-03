import { PlaceholderModule } from "@/components/layout/PlaceholderModule";

export const metadata = {
  title: "Registrar comprobante | Palacio · ERP",
};

export default function RegistrarComprobantePage() {
  return (
    <PlaceholderModule
      crumbs={[
        { label: "Compras" },
        { label: "Comprobantes", href: "/compras/comprobantes" },
        { label: "Registrar" },
      ]}
      title="Registrar comprobante"
      description="Registrar comprobante de proveedor (factura / nota de crédito / nota de débito / otros)"
      hu="C-05"
    />
  );
}
