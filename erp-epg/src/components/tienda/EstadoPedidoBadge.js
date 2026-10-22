import { badgeEstadoPedidoWeb } from "@/lib/pedidos-web/estado";

export default function EstadoPedidoBadge({ estado }) {
  return <span className={badgeEstadoPedidoWeb(estado)}>{estado}</span>;
}
