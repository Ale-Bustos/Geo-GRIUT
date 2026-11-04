// Ayudantes para los tests: los GeoJSON de public/ tal como los sirve el servidor
import { vi } from 'vitest';
import toponimos from '../public/geojson/Toponimos.geojson?raw';
import historicos from '../public/geojson/Puntos_Historicos.geojson?raw';
import resignificacion from '../public/geojson/Puntos_Resignificacion.geojson?raw';
import conflictos from '../public/geojson/Conflictos.geojson?raw';

export const GEOJSON_PUBLIC: Record<string, string> = {
  '/geojson/Toponimos.geojson': toponimos,
  '/geojson/Puntos_Historicos.geojson': historicos,
  '/geojson/Puntos_Resignificacion.geojson': resignificacion,
  '/geojson/Conflictos.geojson': conflictos
};

/** fetch falso: sirve los GeoJSON de lugares; /api/ responde con `api` o, si no, 503 (API caída). */
export const servirPublic = (api?: (url: string) => Response | undefined) => vi.fn(async (entrada: RequestInfo | URL) => {
  const url = String(entrada);
  if (url.includes('/api/')) return api?.(url) ?? new Response('{"error":"sin API"}', { status: 503 });
  const cuerpo = GEOJSON_PUBLIC[new URL(url, 'http://localhost').pathname];
  return cuerpo === undefined ? new Response('', { status: 404 }) : new Response(cuerpo);
});
