import path from "path";
import { fileURLToPath } from "url";

const appRoot = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // El repo tiene otro package-lock.json arriba. La app es esta carpeta.
  outputFileTracingRoot: appRoot,
  reactCompiler: true,
  allowedDevOrigins: ["tienda.localhost"],
};

export default nextConfig;
