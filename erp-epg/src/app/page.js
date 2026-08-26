import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4">
      <h1 className="text-2xl font-semibold">ERP EPG</h1>
      <Link href="/unidades-medida" className="underline underline-offset-2">
        Unidades de medida
      </Link>
      <Link href="/rubros" className="underline underline-offset-2">
        Rubros
      </Link>
    </div>
  );
}
