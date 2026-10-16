"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { FormularioRegistro } from "@/components/tienda/AuthForms";

function Formulario() {
  const param = useSearchParams().get("next");
  const next = param === "/checkout" || param === "/carrito" ? param : "";
  const sufijo = next ? `?next=${next}` : "";

  return (
    <main className="flex min-h-dvh items-center justify-center bg-palacio-bg p-6">
      <div className="palacio-card w-full max-w-md p-7 md:p-8">
        <h1 className="mb-5 text-xl font-bold tracking-tight text-zinc-900">Crear cuenta</h1>
        <FormularioRegistro next={next} />
        <p className="mt-4 text-sm text-palacio-muted">
          ¿Ya tenés cuenta? <Link href={`/login${sufijo}`} className="font-medium text-palacio-red">Ingresá</Link>
        </p>
      </div>
    </main>
  );
}

export default function RegistroTienda() {
  return (
    <Suspense>
      <Formulario />
    </Suspense>
  );
}
