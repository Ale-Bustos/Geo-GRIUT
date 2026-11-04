// Cliente de la API de GRIUT (backend en Go, ver backend/). Si la API no responde, quien la usa
// debe seguir funcionando con los datos estáticos de public/

// En desarrollo, Vite reenvía /api al backend local (ver vite.config.ts)
export const API_URL = import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? '' : 'https://geo.myc-ingenieria.cl');

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

// Lugar cercano a otro (ver /api/lugares/{capa}/{id}/relacionados en backend/README.md)
export interface Relacionado {
  capa: string;
  id: number;
  nombre: string;
  distancia_m: number;
}

export const pedirRelacionados = (capa: string, id: number, radioM: number, signal?: AbortSignal) =>
  pedir<Relacionado[]>(`/api/lugares/${encodeURIComponent(capa)}/${id}/relacionados?radio=${Math.round(radioM)}`, signal);
