import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-parse (vía pdfjs-dist) carga @napi-rs/canvas, que trae un binario
  // nativo (.node) específico de la plataforma. Si webpack lo mete dentro
  // del bundle de la función, ese binario se pierde y falla solo en
  // producción (en local, con acceso directo a node_modules, funciona bien).
  serverExternalPackages: ["pdf-parse", "pdfjs-dist", "@napi-rs/canvas", "mammoth"],
  // pdfjs-dist carga en tiempo de ejecución tanto @napi-rs/canvas (require()
  // envuelto en try/catch, tratado como opcional) como su propio worker
  // (pdf.worker.mjs, importado con una ruta que el rastreador de Next no
  // sigue). El rastreador de dependencias no detecta ninguna de las dos, así
  // que sin esto faltan archivos en el deploy y pdfjs-dist revienta en
  // producción (visto en logs: "DOMMatrix is not defined" y luego "Cannot
  // find module .../pdf.worker.mjs").
  outputFileTracingIncludes: {
    "/api/cv/upload": ["./node_modules/@napi-rs/canvas*/**/*", "./node_modules/pdfjs-dist/**/*"],
  },
};

export default nextConfig;
