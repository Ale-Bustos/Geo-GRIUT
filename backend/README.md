# Backend de Geo-GRIUT (Go)

API HTTP sobre el PostGIS de GRIUT (esquema `griut`). Corre en el TrueNAS, junto a PostGIS, y se publica en `https://geo.myc-ingenieria.cl/api/` por el túnel de Cloudflare.

## Endpoints

| Ruta | Qué devuelve |
|---|---|
| `GET /api/salud` | `{"estado":"ok","version":…}`; 503 si la base no responde |
| `GET /api/buscar?q=…&limite=10` | Topónimos y puntos cuyo nombre contiene `q`, sin importar tildes ni mayúsculas (`q` de 2 a 100 caracteres, `limite` de 1 a 50) |
| `GET /api/capas/{capa}/elementos/{id}` | Ficha de un punto como Feature GeoJSON. Capas: `toponimos`, `puntos-historicos`, `puntos-resignificacion`, `conflictos` |
| `GET /api/teselas/{capa}/{z}/{x}/{y}.pbf` | Tesela vectorial (MVT, esquema XYZ, zoom 0–16) armada en PostGIS con `ST_AsMVT`. Capas: `rios`, `esteros`, `quebradas`, `prov_conce`, `poblacion_indigena_mz_2024`, `poblacion_indigena_loc_2024`. Las últimas 64 MB de teselas quedan en memoria; responden con `ETag` y `Cache-Control` de un día |
| `GET /api/poblacion/comunas` | Población indígena por comuna (Censo 2024, manzanas + localidades) y su comparación con 2017. Las zonas con dato reservado por el INE no suman personas indígenas: se informan en `personas_en_reservadas` y `zonas_reservadas` |

## Configuración

| Variable | Por defecto | |
|---|---|---|
| `DATABASE_URL` | — | Conexión a PostGIS con el usuario de solo lectura `gis_reader` |
| `PUERTO` | `8081` | |
| `ORIGENES_PERMITIDOS` | `https://geo-griut.vercel.app,https://*.vercel.app` | Orígenes CORS separados por coma |

## Desarrollo

```sh
cd backend
go test ./...
DATABASE_URL='postgres://gis_reader:…@192.168.100.6:5432/gis' go run ./cmd/api
```

Con el backend corriendo en el puerto 8081, `npm run dev` reenvía `/api` a él (ver `vite.config.ts`). Sin backend, el buscador del mapa no aparece y el resto funciona igual.

## Despliegue

Cada push a `master` que toque `backend/` corre las pruebas y publica `ghcr.io/ale-bustos/geo-griut-api:latest` y `:<sha>` (ver `.github/workflows/backend.yml`). En el TrueNAS es el servicio `api` de la app `gis`.

## Datos

Las teselas salen directo de las tablas: si se recarga una capa, hay que reiniciar el servicio para vaciar su caché en memoria. El mapa pide a la API las capas de `CAPAS_TESELAS_API` (`src/capas.ts`). Si la API no responde, cada tesela se vuelve a pedir a GeoServer.

Los puntos (`griut.toponimos`, `griut.puntos_historicos`, `griut.puntos_resignificacion`, `griut.conflictos`) se cargaron desde `public/geojson/` con columnas `id`, `nombre`, `propiedades` (jsonb con las propiedades originales) y `geom` (Point 4326). La búsqueda usa `griut.normalizar(text)` (`unaccent` + minúsculas) con un índice trigram. Si se cambia un GeoJSON en `public/geojson/`, hay que volver a cargarlo.
