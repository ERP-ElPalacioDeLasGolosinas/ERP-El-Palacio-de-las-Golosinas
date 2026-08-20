export default function LoadingMarcas() {
  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-5 space-y-2">
        <div className="h-3 w-40 animate-pulse rounded bg-linea" />
        <div className="h-7 w-64 animate-pulse rounded bg-linea" />
      </div>
      <div className="card p-4">
        <div className="mb-4 h-9 w-full animate-pulse rounded-[9px] bg-linea" />
        <div className="space-y-2.5">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-10 w-full animate-pulse rounded bg-crema" />
          ))}
        </div>
      </div>
    </div>
  );
}
