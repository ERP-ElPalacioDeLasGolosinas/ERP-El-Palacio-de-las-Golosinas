"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { FormularioLogin } from "@/components/tienda/AuthForms";

function Formulario() {
  const param = useSearchParams().get("next");
  const next = param === "/checkout" || param === "/carrito" ? param : "";
  const sufijo = next ? `?next=${next}` : "";

  return (
    <main className="flex min-h-dvh items-center justify-center bg-palacio-bg p-6">
      <div className="palacio-card w-full max-w-md p-7 md:p-8">
        <h1 className="mb-5 text-xl font-bold tracking-tight text-zinc-900">Ingresar a la tienda</h1>
        <FormularioLogin next={next} />
        <p className="mt-4 text-sm text-palacio-muted">
          ¿No tenés cuenta? <Link href={`/tienda/registro${sufijo}`} className="font-medium text-palacio-red">Registrate</Link>
        </p>
      </div>
    </main>
  );
}

export default function LoginTienda() {
  return (
    <Suspense>
      <Formulario />
    </Suspense>
  );
}
