export default function Badge({ activo }) {
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-[10.5px] font-bold ${
        activo ? "bg-verde-bg text-verde" : "bg-ambar-bg text-ambar"
      }`}
    >
      {activo ? "Activa" : "Inactiva"}
    </span>
  );
}
