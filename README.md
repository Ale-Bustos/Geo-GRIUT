# Geo-GRIUT

Visualizador de mapas interactivo del Grupo de Estudios Interculturales Urbanos y Territoriales (GRIUT).

Construido con [React](https://react.dev), [OpenLayers](https://openlayers.org) y [ol-ext](https://viglino.github.io/ol-ext/), empaquetado con [Vite](https://vite.dev) y publicado en Vercel.

## Requisitos

- Node.js 22

## Scripts

| Comando | Descripción |
|---|---|
| `npm install` | Instala las dependencias |
| `npm run dev` (o `npm start`) | Servidor de desarrollo en http://localhost:3000 |
| `npm run build` | Genera la versión de producción en `dist/` |
| `npm run preview` | Sirve localmente la versión de producción |
| `npm test` | Ejecuta los tests con Vitest |
| `npm run lint` | Revisa el código con ESLint |

## Estructura

- `src/MapComponent.jsx`: mapa, capas, leyenda, brújula y tutorial.
- `public/geojson/`: capas vectoriales (ríos, esteros, quebradas, límite provincial, toponimia, conflictos, puntos históricos y de resignificación).
- `vercel.json`: configuración de despliegue.

## Datos

Los GeoJSON están en WGS84 (CRS84), con coordenadas redondeadas a 6 decimales. El límite provincial y las capas de agua están simplificados con [mapshaper](https://mapshaper.org) (tolerancia de 5 m y 2 m respectivamente).
