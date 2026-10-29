# Geo-GRIUT

Visualizador de mapas interactivo del Grupo de Estudios Interculturales Urbanos y Territoriales (GRIUT).

Construido con [React](https://react.dev), [TypeScript](https://www.typescriptlang.org) y [OpenLayers](https://openlayers.org), empaquetado con [Vite](https://vite.dev) y publicado en Vercel.

## Requisitos

- Node.js 22
- Un token público de Mapbox: copia `.env.example` como `.env.local` y completa `VITE_MAPBOX_TOKEN`. En Vercel, la misma variable se define en *Settings → Environment Variables*.

## Scripts

| Comando | Descripción |
|---|---|
| `npm install` | Instala las dependencias |
| `npm run dev` (o `npm start`) | Servidor de desarrollo en http://localhost:3000 |
| `npm run build` | Revisa los tipos y genera la versión de producción en `dist/` |
| `npm run preview` | Sirve localmente la versión de producción |
| `npm test` | Ejecuta los tests con Vitest |
| `npm run lint` | Revisa el código con ESLint |
| `npm run typecheck` | Revisa los tipos con TypeScript |

## Estructura

- `src/MapComponent.tsx`: mapa, capas, leyenda, brújula y tutorial.
- `src/FeaturePopup.tsx`: contenido del popup de los puntos.
- `src/SelectorCapas.ts`: selector de capas con leyenda (adaptado de `simbologia_mapa_web/`).
- `public/geojson/`: capas vectoriales (ríos, esteros, quebradas, límite provincial, toponimia, conflictos, puntos históricos y de resignificación).
- `vercel.json`: configuración de despliegue.

## Datos

Los GeoJSON están en WGS84 (CRS84), con coordenadas redondeadas a 6 decimales. El límite provincial y las capas de agua están simplificados con [mapshaper](https://mapshaper.org) (tolerancia de 5 m y 2 m respectivamente).
