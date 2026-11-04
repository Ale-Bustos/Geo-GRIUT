// Lugares con ficha propia: los puntos de public/geojson, cada uno con un id estable (el "id" del
// feature, el mismo de las tablas griut.* que sirve la API). De aquí salen el enlace ?lugar=<capa>:<id>
// y los lugares relacionados cuando la API no responde
import { pedirRelacionados, type Relacionado } from './api';
import { nombreLugar } from './fichaCampos';

// Capas de lugares: el nombre de la capa en la API, su título en el mapa (ver capas.ts), la categoría
// que se muestra en la ficha y su GeoJSON
export const CAPAS_LUGAR = {
  'toponimos': { titulo: 'Toponimia', categoria: 'Topónimo', url: '/geojson/Toponimos.geojson' },
  'puntos-historicos': { titulo: 'Puntos Historicos', categoria: 'Punto histórico', url: '/geojson/Puntos_Historicos.geojson' },
  'puntos-resignificacion': { titulo: 'Puntos de Resignificación', categoria: 'Resignificación cultural', url: '/geojson/Puntos_Resignificacion.geojson' },
  'conflictos': { titulo: 'Conflictos Socio-Ambientales', categoria: 'Conflicto socioambiental', url: '/geojson/Conflictos.geojson' }
} as const;

export type CapaLugar = keyof typeof CAPAS_LUGAR;

export const esCapaLugar = (capa: unknown): capa is CapaLugar =>
  typeof capa === 'string' && Object.hasOwn(CAPAS_LUGAR, capa);

export interface RefLugar {
  capa: CapaLugar;
  id: number;
}

export interface Lugar extends RefLugar {
  nombre: string;
  lon: number;
  lat: number;
  propiedades: Record<string, unknown>;
}

export const claveLugar = (ref: RefLugar) => `${ref.capa}:${ref.id}`;

/** Lee "<capa>:<id>"; null si la capa no existe o el id no es un entero positivo. */
export const leerClaveLugar = (texto: string | null): RefLugar | null => {
  const partes = /^([a-z-]+):([1-9]\d{0,8})$/.exec(texto ?? '');
  if (!partes || !esCapaLugar(partes[1])) return null;
  return { capa: partes[1], id: Number(partes[2]) };
};

const PARAMETRO = 'lugar';

export const leerLugarUrl = () => leerClaveLugar(new URLSearchParams(window.location.search).get(PARAMETRO));

/** Deja en la URL el lugar abierto (o lo quita), sin agregar una entrada al historial. */
export const escribirLugarUrl = (ref: RefLugar | null) => {
  const url = new URL(window.location.href);
  if (ref) url.searchParams.set(PARAMETRO, claveLugar(ref));
  else url.searchParams.delete(PARAMETRO);
  window.history.replaceState(window.history.state, '', url);
};

/** Enlace para compartir un lugar: solo el lugar, sin el estado del recorrido. */
export const enlaceLugar = (ref: RefLugar) => {
  const url = new URL(window.location.pathname, window.location.origin);
  url.searchParams.set(PARAMETRO, claveLugar(ref));
  return url.toString();
};

interface FeatureGeoJSON {
  id?: unknown;
  properties?: Record<string, unknown> | null;
  geometry?: { type?: string; coordinates?: unknown } | null;
}

const leerCapa = async (capa: CapaLugar): Promise<Lugar[]> => {
  const respuesta = await fetch(CAPAS_LUGAR[capa].url);
  if (!respuesta.ok) throw new Error(`${CAPAS_LUGAR[capa].url}: ${respuesta.status}`);
  const datos = await respuesta.json() as { features?: FeatureGeoJSON[] };
  return (datos.features ?? []).flatMap((f) => {
    const [lon, lat] = Array.isArray(f.geometry?.coordinates) ? f.geometry.coordinates as number[] : [];
    if (!Number.isInteger(f.id) || f.geometry?.type !== 'Point' || !Number.isFinite(lon) || !Number.isFinite(lat)) return [];
    const propiedades = f.properties ?? {};
    return [{ capa, id: f.id as number, nombre: nombreLugar(propiedades), lon, lat, propiedades }];
  });
};

let cargando: Promise<Lugar[]> | null = null;

/** Todos los lugares de las capas de CAPAS_LUGAR (se descargan una vez; si falla, se reintenta la próxima). */
export const cargarLugares = () => {
  cargando ??= Promise.all((Object.keys(CAPAS_LUGAR) as CapaLugar[]).map(leerCapa))
    .then((capas) => capas.flat())
    .catch((error) => {
      cargando = null;
      throw error;
    });
  return cargando;
};

/** Solo para los tests: olvida los lugares descargados. */
export const olvidarLugares = () => {
  cargando = null;
};

export const buscarLugar = async (ref: RefLugar) =>
  (await cargarLugares()).find((l) => l.capa === ref.capa && l.id === ref.id) ?? null;

// Radio y límite por capa de los relacionados, los mismos que usa la API por defecto
export const RADIO_RELACIONADOS_M = 5000;
export const RELACIONADOS_POR_CAPA = 5;

const RADIO_TIERRA_M = 6371008.8;
const rad = (grados: number) => (grados * Math.PI) / 180;

/** Distancia en metros sobre la esfera (haversine); a estas distancias difiere del elipsoide en menos de 0,5 %. */
export const distanciaM = (a: { lon: number; lat: number }, b: { lon: number; lat: number }) => {
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2
    + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lon - a.lon) / 2) ** 2;
  return 2 * RADIO_TIERRA_M * Math.asin(Math.min(1, Math.sqrt(h)));
};

/** Lo mismo que /api/lugares/{capa}/{id}/relacionados, calculado con los lugares locales. */
export const relacionadosLocales = (lugares: Lugar[], origen: Lugar, radioM = RADIO_RELACIONADOS_M,
  porCapa = RELACIONADOS_POR_CAPA): Relacionado[] => {
  const cercanos = lugares
    .filter((l) => !(l.capa === origen.capa && l.id === origen.id))
    .map((l) => ({ capa: l.capa, id: l.id, nombre: l.nombre, distancia_m: Math.round(distanciaM(origen, l)) }))
    .filter((r) => r.distancia_m <= radioM)
    .sort((a, b) => a.distancia_m - b.distancia_m || a.capa.localeCompare(b.capa) || a.id - b.id);
  const porCapaVistos: Record<string, number> = {};
  return cercanos.filter((r) => (porCapaVistos[r.capa] = (porCapaVistos[r.capa] ?? 0) + 1) <= porCapa);
};

/**
 * Relacionados de un lugar: los pide a la API y, si no responde, los calcula con los GeoJSON locales.
 * Los nombres salen de los datos locales cuando están, para que coincidan con el título de cada ficha.
 * Sin API ni datos locales devuelve [] (la ficha oculta la sección).
 */
export const obtenerRelacionados = async (ref: RefLugar, signal?: AbortSignal): Promise<Relacionado[]> => {
  const locales = cargarLugares().catch(() => [] as Lugar[]);
  let relacionados: Relacionado[] | null = null;
  try {
    relacionados = await pedirRelacionados(ref.capa, ref.id, RADIO_RELACIONADOS_M, signal);
  } catch (error) {
    if (signal?.aborted) throw error;
  }
  const lugares = await locales;
  if (relacionados === null) {
    const origen = lugares.find((l) => l.capa === ref.capa && l.id === ref.id);
    return origen ? relacionadosLocales(lugares, origen) : [];
  }
  const porClave = new Map(lugares.map((l) => [claveLugar(l), l.nombre]));
  return relacionados
    .filter((r) => esCapaLugar(r.capa))
    .map((r) => ({ ...r, nombre: porClave.get(claveLugar(r as RefLugar)) || r.nombre }));
};
