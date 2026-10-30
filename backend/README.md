# Backend de Geo-GRIUT (Go)

API HTTP sobre el PostGIS de GRIUT (esquema `griut`). Corre en el TrueNAS, junto a PostGIS, y se publica en `https://geo.myc-ingenieria.cl/api/` por el túnel de Cloudflare.

## Endpoints

| Ruta | Qué devuelve |
|---|---|
| `GET /api/salud` | `{"estado":"ok","version":…}`; 503 si la base no responde |
| `GET /api/buscar?q=…&limite=10` | Topónimos y puntos cuyo nombre contiene `q`, sin importar tildes ni mayúsculas (`q` de 2 a 100 caracteres, `limite` de 1 a 50) |
| `GET /api/capas/{capa}/elementos/{id}` | Ficha de un punto como Feature GeoJSON. Capas: `toponimos`, `puntos-historicos`, `puntos-resignificacion`, `conflictos` |
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

Los puntos (`griut.toponimos`, `griut.puntos_historicos`, `griut.puntos_resignificacion`, `griut.conflictos`) se cargaron desde `public/geojson/` con columnas `id`, `nombre`, `propiedades` (jsonb con las propiedades originales) y `geom` (Point 4326). La búsqueda usa `griut.normalizar(text)` (`unaccent` + minúsculas) con un índice trigram. Si se cambia un GeoJSON en `public/geojson/`, hay que volver a cargarlo.
