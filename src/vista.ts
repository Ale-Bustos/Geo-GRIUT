// Vista del mapa y utilidades de rotación compartidas por el mapa y la brújula
import { fromLonLat } from 'ol/proj';

export const CENTRO_INICIAL = fromLonLat([-73.044, -36.826]);
export const ZOOM_INICIAL = 10.5;
export const INITIAL_ROTATION = -Math.PI / 2; // Rotación inicial del mapa: el este (Puelmapu) queda arriba
export const NORTH_ROTATION = 0; // Rotación con el norte arriba

// Lleva un ángulo al rango (-π, π], para comparar rotaciones y girar por el camino más corto
export const normalizeAngle = (angle: number) => Math.atan2(Math.sin(angle), Math.cos(angle));
