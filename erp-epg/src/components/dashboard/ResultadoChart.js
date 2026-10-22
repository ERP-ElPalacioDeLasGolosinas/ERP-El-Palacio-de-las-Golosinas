const monedaFmt = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });
const mesFmt = new Intl.DateTimeFormat("es-AR", { month: "short", year: "2-digit" });

function mesLabel(valor) {
  const d = new Date(`${valor}T00:00:00`);
  if (Number.isNaN(d.getTime())) return valor;
  const texto = mesFmt.format(d).replace(".", "");
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/**
 * Compara ingresos y egresos de cada mes del rango. El alto sale del mayor
 * valor del período, así la tendencia se lee en un solo gráfico.
 *
 * @param {{ meses: Array<{ mes: string, ingresos: number, egresos: number, resultado: number }> }} props
 */
export function ResultadoChart({ meses }) {
  const max = Math.max(1, ...meses.flatMap((m) => [Number(m.ingresos) || 0, Math.max(Number(m.egresos) || 0, 0)]));
  const alto = 220;
  const grupo = 72;
  const ancho = Math.max(meses.length * grupo, grupo);
  const base = 28;

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${ancho} ${alto + base}`}
        className="h-72 w-full min-w-[36rem]"
        role="img"
        aria-label="Ingresos y egresos por mes"
      >
        {[0, 0.5, 1].map((t) => {
          const y = alto - t * (alto - 16);
          return (
            <g key={t}>
              <line x1="0" x2={ancho} y1={y} y2={y} stroke="#e4e4e7" strokeDasharray={t === 0 ? "0" : "3 4"} />
            </g>
          );
        })}
        {meses.map((m, i) => {
          const ingresos = Math.max(Number(m.ingresos) || 0, 0);
          const egresos = Math.max(Number(m.egresos) || 0, 0);
          const x = i * grupo + grupo / 2;
          const hi = ((alto - 16) * ingresos) / max;
          const he = ((alto - 16) * egresos) / max;
          return (
            <g key={m.mes}>
              <rect x={x - 18} y={alto - hi} width="16" height={hi} rx="3" fill="#15803d" />
              <rect x={x + 2} y={alto - he} width="16" height={he} rx="3" fill="#b91c1c" />
              <text x={x} y={alto + 18} textAnchor="middle" fontSize="11" fill="#71717a">
                {mesLabel(m.mes)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function moneda(valor) {
  return monedaFmt.format(Number(valor) || 0);
}

export { mesLabel };
