// Vista del mapa y utilidades de rotación compartidas por el mapa y la brújula
import { fromLonLat } from 'ol/proj';

export const CENTRO_INICIAL = fromLonLat([-73.044, -36.826]);
export const ZOOM_INICIAL = 10.5;
export const INITIAL_ROTATION = -Math.PI / 2; // Rotación inicial del mapa: el este (Puelmapu) queda arriba
export const NORTH_ROTATION = 0; // Rotación con el norte arriba

// Lleva un ángulo al rango (-π, π], para comparar rotaciones y girar por el camino más corto
export const normalizeAngle = (angle: number) => Math.atan2(Math.sin(angle), Math.cos(angle));

/**
 * Centro de la vista que deja `coordenada` en el píxel `posicion` de un mapa de tamaño `tamano`, a la
 * resolución y rotación dadas. Es la cuenta de View#centerOn, pero sin mover la vista: así se puede
 * animar hacia ese centro y a otro zoom en un solo vuelo.
 */
export const centroPara = (coordenada: number[], tamano: number[], posicion: number[], resolucion: number, rotacion: number) => {
  const cos = Math.cos(-rotacion);
  const sin = Math.sin(-rotacion);
  const x = coordenada[0] * cos - coordenada[1] * sin + (tamano[0] / 2 - posicion[0]) * resolucion;
  const y = coordenada[1] * cos + coordenada[0] * sin + (posicion[1] - tamano[1] / 2) * resolucion;
  return [x * cos + y * sin, y * cos - x * sin];
};

// Rectángulo en píxeles del mapa
export interface Caja {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** Centro de la parte del mapa que no tapa `tapa` (la ficha), y si `pixel` queda visible en esa parte. */
export const zonaLibre = (tapa: Caja, ancho: number, alto: number) => {
  const abajo = tapa.left <= 1 && tapa.right >= ancho - 1 || (tapa.right - tapa.left) > ancho * 0.6;
  const libre: Caja = abajo
    ? { left: 0, top: 0, right: ancho, bottom: Math.max(0, tapa.top) }
    : tapa.left < ancho / 2
      ? { left: Math.min(ancho, tapa.right), top: 0, right: ancho, bottom: alto }
      : { left: 0, top: 0, right: Math.max(0, tapa.left), bottom: alto };
  return {
    centro: [(libre.left + libre.right) / 2, (libre.top + libre.bottom) / 2],
    contiene: (pixel: number[], margen = 24) => pixel[0] >= libre.left + margen && pixel[0] <= libre.right - margen
      && pixel[1] >= libre.top + margen && pixel[1] <= libre.bottom - margen
  };
};
