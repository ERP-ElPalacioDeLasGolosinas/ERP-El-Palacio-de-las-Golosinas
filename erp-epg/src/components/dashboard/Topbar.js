export default function Topbar() {
  return (
    <header className="relative flex items-center gap-4 px-5 py-3 bg-gradient-to-b from-rojo to-rojo-hondo shadow-[0_2px_0_var(--color-oro-hondo),0_6px_18px_rgba(124,10,25,0.28)]">
      {/* Filo dorado tipo cinta */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 -bottom-0.5 h-0.5 bg-gradient-to-r from-oro-hondo via-oro-claro to-oro-hondo"
      />

      <div className="flex flex-col leading-tight">
        <span className="font-baloo font-bold text-white text-[17px] tracking-[0.2px]">
          Palacio · ERP
        </span>
        <span className="text-oro-claro text-[11px] font-semibold tracking-[1.4px] uppercase">
          Gestión &amp; Punto de venta
        </span>
      </div>

      <div className="flex-1" />

      {/* Usuario: se conecta cuando llegue el login */}
      <div
        className="grid h-[34px] w-[34px] place-items-center rounded-full border-2 border-white bg-oro font-baloo font-extrabold text-rojo-noche"
        title="Usuario"
      >
        ?
      </div>
    </header>
  );
}
