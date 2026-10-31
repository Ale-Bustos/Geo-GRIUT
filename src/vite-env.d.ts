/// <reference types="vite/client" />

interface ImportMetaEnv {
  // Token público de Mapbox para el mapa base (se define en .env.local y en Vercel)
  readonly VITE_MAPBOX_TOKEN: string;
  // Dirección de la API de GRIUT (backend en Go); por defecto la del servidor de GRIUT
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
