/// <reference types="vite/client" />

interface ImportMetaEnv {
  // Token público de Mapbox para el mapa base (se define en .env.local y en Vercel)
  readonly VITE_MAPBOX_TOKEN: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
