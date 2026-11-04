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

El backend en Go tiene sus propios comandos: ver [`backend/README.md`](backend/README.md).

## Estructura

- `src/MapComponent.tsx`: mapa, capas, leyenda, brújula y tutorial.
- `src/FeaturePopup.tsx`: contenido del popup de los puntos.
- `src/SelectorCapas.ts`: selector de capas con leyenda (adaptado de `simbologia_mapa_web/`).
- `src/TutorialMapa.ts`: tutorial de bienvenida (adaptado de `simbologia_mapa_web/`).
- `public/geojson/`: capas vectoriales (ríos, esteros, quebradas, límite provincial, toponimia, conflictos, puntos históricos y de resignificación).
- `src/Buscador.tsx` y `src/api.ts`: buscador de lugares que consulta la API de GRIUT.
- `backend/`: API en Go sobre PostGIS (ver `backend/README.md`).
- `vercel.json`: configuración de despliegue.

## Datos

Los GeoJSON están en WGS84 (CRS84), con coordenadas redondeadas a 6 decimales. El límite provincial y las capas de agua están simplificados con [mapshaper](https://mapshaper.org) (tolerancia de 5 m y 2 m respectivamente).

## Relieve sombreado

La capa "Relieve sombreado" (`src/relieve.ts`) se calcula en la GPU con `ol/layer/WebGLTile` a partir de teselas de elevación. Va sobre el mapa base y bajo todas las capas temáticas, y se mezcla con "multiplicar" (`src/css/relieve.css`): es blanca en el terreno plano y gris en las laderas que dan la espalda a la luz, que viene de Puelmapu (este-noreste, 67,5°). La luz queda fija en el terreno aunque se gire el mapa, porque los vecinos de cada píxel se leen en la textura de la tesela, alineada al norte.

**Fuente actual:** Mapbox Terrain-RGB v1 (`mapbox.terrain-rgb`) por la Raster Tiles API, en teselas de 512 px (`@2x`) y formato `pngraw`, sin pérdida. El `.png` de la misma API viene con paleta de 8 bits y se equivoca hasta en 50 m. No se usa Terrain-DEM v1: Mapbox lo permite solo dentro de sus SDK, no por la Raster Tiles API. Terrain-RGB ya no recibe actualizaciones de datos (desde diciembre de 2021).

**Cuota:** cada tesela es una petición a la Raster Tiles API, la misma que cobra las teselas del mapa base, con un tramo gratuito mensual (ver mapbox.com/pricing). Las teselas de elevación no aumentan con la densidad de la pantalla, no se piden más allá del zoom 14 y el navegador las guarda 12 horas. En las mediciones del PR, una sesión típica (carga, zoom del 11 al 13, arrastre y giro) pidió entre 5 y 20 teselas de elevación, frente a 20–85 del mapa base.

### Usar un modelo de elevación propio

Todo lo que depende de la fuente está en `FUENTE_DEM` y en la función `elevacion` de `src/relieve.ts`.

- **Recomendado: un COG servido como archivo estático.** Se convierte el DEM ALOS PALSAR 12,5 m de la región (más detalle que el de Mapbox en la zona) a un GeoTIFF optimizado para la nube, en EPSG:3857:

  ```sh
  gdalwarp -t_srs EPSG:3857 -r bilinear -of COG -co COMPRESS=DEFLATE -co PREDICTOR=3 \
    -co BLOCKSIZE=512 -co OVERVIEWS=AUTO REGION_BIOBIO.tif dem_biobio_3857.tif
  ```

  Se publica con CORS y peticiones por rango (Range), por ejemplo en el TrueNAS detrás del túnel de Cloudflare. En `relieve.ts` se reemplaza la fuente por `new GeoTIFF({ sources: [{ url }], normalize: false, interpolate: false })` (`ol/source/GeoTIFF`), y `elevacion(dx, dy)` pasa a ser `['band', 1, dx, dy]`, porque la banda ya viene en metros. `metrosPorPixelTextura` sigue sirviendo: usa la grilla de la fuente.

- **Alternativa: teselas Terrain-RGB propias** desde GeoServer/GeoWebCache o como archivos estáticos. Se generan con `rio rgbify -b -10000 -i 0.1 --format png` (mismo cifrado que Mapbox) o con `gdal2tiles` sobre un RGB precalculado. Solo cambia `FUENTE_DEM.url` (y `tileSize`/`maxZoom` según el teselado). En GeoWebCache hay que publicarlas como PNG sin pérdida: nada de PNG8 ni JPEG.

### Medir los FPS

Con `?fps=1` en la URL aparece un contador abajo a la izquierda: cuadros del último segundo, el cuadro más lento, la densidad con que se dibuja el mapa (baja a 1 mientras se mueve) y si el relieve está encendido. En ese modo el mapa queda también en `window.geoGriut.map`, para los scripts de medición.
