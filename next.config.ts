import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-parse (vía pdfjs-dist) carga @napi-rs/canvas, que trae un binario
  // nativo (.node) específico de la plataforma. Si webpack lo mete dentro
  // del bundle de la función, ese binario se pierde y falla solo en
  // producción (en local, con acceso directo a node_modules, funciona bien).
  serverExternalPackages: ["pdf-parse", "pdfjs-dist", "@napi-rs/canvas", "mammoth"],
  // pdfjs-dist carga @napi-rs/canvas con un require() envuelto en try/catch
  // (para tratarlo como opcional), lo que el rastreador de dependencias de
  // Next no detecta: sin esto, el binario nativo no viaja al deploy y
  // pdfjs-dist revienta en producción con "DOMMatrix is not defined".
  outputFileTracingIncludes: {
    "/api/cv/upload": ["./node_modules/@napi-rs/canvas*/**/*"],
  },
};

export default nextConfig;
