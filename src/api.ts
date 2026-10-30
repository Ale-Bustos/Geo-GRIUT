// Cliente de la API de GRIUT (backend en Go, ver backend/). Si la API no responde, quien la usa
// debe seguir funcionando con los datos estáticos de public/

// En desarrollo, Vite reenvía /api al backend local (ver vite.config.ts)
export const API_URL = import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? '' : 'https://geo.myc-ingenieria.cl');

// Capas de la API y el título de su capa en el mapa (ver capas.ts)
export const CAPAS_API: Record<string, string> = {
  'toponimos': 'Toponimia',
  'puntos-historicos': 'Puntos Historicos',
  'puntos-resignificacion': 'Puntos de Resignificación',
  'conflictos': 'Conflictos Socio-Ambientales'
};

export interface ResultadoBusqueda {
  capa: string;
  id: number;
  nombre: string;
  lon: number;
  lat: number;
}

const pedir = async <T>(ruta: string, signal?: AbortSignal): Promise<T> => {
  const respuesta = await fetch(API_URL + ruta, { signal });
  if (!respuesta.ok) throw new Error(`API ${ruta}: ${respuesta.status}`);
  return respuesta.json() as Promise<T>;
};

/** Indica si la API está disponible (no lanza errores). */
export const apiDisponible = async (signal?: AbortSignal) => {
  try {
    await pedir('/api/salud', signal);
    return true;
  } catch {
    return false;
  }
};

export const buscarLugares = (q: string, signal?: AbortSignal) =>
  pedir<ResultadoBusqueda[]>('/api/buscar?q=' + encodeURIComponent(q), signal);
