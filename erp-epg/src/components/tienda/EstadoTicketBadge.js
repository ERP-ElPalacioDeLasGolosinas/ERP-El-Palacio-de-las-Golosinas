const BADGE = {
  Abierto: "palacio-badge-lleno",
  "En proceso": "palacio-badge-lleno",
  Resuelto: "palacio-badge-activo",
  Cerrado: "palacio-badge-inactivo",
};

export default function EstadoTicketBadge({ estado }) {
  return <span className={BADGE[estado] ?? "palacio-badge-inactivo"}>{estado}</span>;
}
