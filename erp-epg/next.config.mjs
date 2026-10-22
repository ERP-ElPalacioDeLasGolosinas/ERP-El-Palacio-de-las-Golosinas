import path from "path";
import { fileURLToPath } from "url";

const appRoot = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // El repo tiene otro package-lock.json arriba. La app es esta carpeta.
  outputFileTracingRoot: appRoot,
  reactCompiler: true,
  allowedDevOrigins: ["tienda.localhost"],
  async redirects() {
    return [
      { source: "/tienda/pedidos", destination: "/tienda/cuenta/pedidos", permanent: true },
      { source: "/tienda/pedidos/:id", destination: "/tienda/cuenta/pedidos/:id", permanent: true },
    ];
  },
};

export default nextConfig;
