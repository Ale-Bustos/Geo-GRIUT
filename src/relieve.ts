/*
 * Relieve sombreado calculado en la GPU (WebGL) a partir de teselas de elevación.
 *
 * Fuente: Mapbox Terrain-RGB v1 (mapbox.terrain-rgb) por la Raster Tiles API, en formato pngraw (PNG
 * RGBA sin pérdida; el .png de la misma API viene con paleta de 8 bits y se equivoca hasta en 50 m).
 * No se usa Terrain-DEM v1, su sucesor: Mapbox solo lo permite dentro de sus SDK (GL JS, etc.), no por
 * la Raster Tiles API (ver docs.mapbox.com/data/tilesets/reference/mapbox-terrain-dem-v1). Terrain-RGB
 * ya no recibe actualizaciones de datos (desde diciembre de 2021). Cada píxel codifica la altura en metros:
 *   h = -10000 + (R·65536 + G·256 + B) · 0,1
 *
 * Cálculo: pendiente con los cuatro vecinos de cada píxel e iluminación de Lambert con la luz desde
 * Puelmapu (ENE). Los vecinos se leen en la textura de la tesela, que está alineada al norte del mapa
 * y no a la pantalla: la luz queda fija en el terreno aunque el mapa esté girado (ver relieve.test.ts).
 * La salida es blanca en terreno plano y se mezcla con "multiplicar" (css/relieve.css): solo oscurece
 * las laderas en sombra y no cambia los colores del mapa base ni el mar.
 *
 * Para usar un modelo de elevación propio en vez de Mapbox, ver "Relieve sombreado" en README.md:
 * basta cambiar FUENTE_DEM (y, si no es Terrain-RGB, la función elevacion).
 */
import type Map from 'ol/Map';
import WebGLTileLayer from 'ol/layer/WebGLTile';
import ImageTile from 'ol/source/ImageTile';
import { toLonLat } from 'ol/proj';
import { unByKey } from 'ol/Observable';
import type { ExpressionValue } from 'ol/expr/expression';

export const TITULO_RELIEVE = 'Relieve sombreado';

// Último zoom con datos en teselas de 512 px (equivale al 15 en 256 px); más cerca, OpenLayers amplía
// las de este nivel sin pedir más
export const ZOOM_MAXIMO_DEM = 14;

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

// @2x: teselas de 512 px (la cuarta parte de peticiones que en 256 px). pngraw: sin pérdida,
// imprescindible para decodificar la altura
export const FUENTE_DEM = {
  url: `https://api.mapbox.com/v4/mapbox.terrain-rgb/{z}/{x}/{y}@2x.pngraw?access_token=${MAPBOX_TOKEN}`,
  tileSize: 512,
  maxZoom: ZOOM_MAXIMO_DEM,
  attributions: '© Mapbox'
};

// Luz: desde dónde llega (grados desde el norte, en sentido horario) y su altura sobre el horizonte.
// 67,5° = este-noreste: Puelmapu, el lado de la cordillera
export const AZIMUT_LUZ = 67.5;
export const ALTURA_LUZ = 45;
const EXAGERACION = 1.5; // Exageración vertical: el relieve de la costa es suave
export const INTENSIDAD = 0.5; // Cuánto oscurece la ladera más sombreada (0 = nada, 1 = negro)

/** Altura en metros de un píxel Terrain-RGB (r, g, b de 0 a 255). */
export const decodificarTerrainRgb = (r: number, g: number, b: number) => -10000 + (r * 65536 + g * 256 + b) * 0.1;

// Altura del vecino (dx, dy) sin el -10000, que se cancela al restar: menos error de redondeo en la GPU.
// band entrega cada canal de 0 a 1, así que se escala por 255
const elevacion = (dx: number, dy: number): ExpressionValue => ['+',
  ['*', 0.1 * 255 * 65536, ['band', 1, dx, dy]],
  ['*', 0.1 * 255 * 256, ['band', 2, dx, dy]],
  ['*', 0.1 * 255, ['band', 3, dx, dy]]
];

const rad = (grados: number) => (grados * Math.PI) / 180;

// Componentes de la dirección de la luz: x al este, y al norte, z hacia arriba
const LUZ = {
  x: Math.sin(rad(AZIMUT_LUZ)) * Math.cos(rad(ALTURA_LUZ)),
  y: Math.cos(rad(AZIMUT_LUZ)) * Math.cos(rad(ALTURA_LUZ)),
  z: Math.sin(rad(ALTURA_LUZ))
};

/**
 * Brillo de una ladera de pendientes dzdx (hacia el este) y dzdy (hacia el norte), relativo al
 * terreno plano y acotado a 1: es lo mismo que calcula la GPU, para los tests.
 */
export const brilloLadera = (dzdx: number, dzdy: number, exageracion = EXAGERACION, intensidad = INTENSIDAD) => {
  const nx = -dzdx * exageracion;
  const ny = -dzdy * exageracion;
  const lambert = (nx * LUZ.x + ny * LUZ.y + LUZ.z) / Math.sqrt(nx * nx + ny * ny + 1);
  const relativo = Math.min(1, Math.max(0, lambert / LUZ.z));
  return 1 - intensidad * (1 - relativo);
};

// Metros de terreno por píxel de textura (variable resTextura). Las filas de la textura crecen hacia el sur
const dzdx: ExpressionValue = ['/', ['-', elevacion(1, 0), elevacion(-1, 0)], ['*', 2, ['var', 'resTextura']]];
const dzdy: ExpressionValue = ['/', ['-', elevacion(0, -1), elevacion(0, 1)], ['*', 2, ['var', 'resTextura']]];
const nx: ExpressionValue = ['*', -1, ['var', 'exageracion'], dzdx];
const ny: ExpressionValue = ['*', -1, ['var', 'exageracion'], dzdy];
const lambert: ExpressionValue = ['/',
  ['+', ['*', nx, LUZ.x], ['*', ny, LUZ.y], LUZ.z],
  ['sqrt', ['+', ['*', nx, nx], ['*', ny, ny], 1]]];
const brillo: ExpressionValue = ['-', 1, ['*', ['var', 'intensidad'], ['-', 1, ['clamp', ['/', lambert, LUZ.z], 0, 1]]]];

/**
 * Metros de terreno que mide un píxel de la textura de elevación a esta resolución de la vista: la
 * resolución de la tesela que usa OpenLayers (nunca más fina que el zoom 14) por la escala de
 * Mercator en esa latitud. No sirve la resolución de la vista: más cerca que el zoom 14 la pendiente
 * se exageraría hasta 16 veces.
 */
export const metrosPorPixelTextura = (fuente: ImageTile, resolucionVista: number, latitud: number) => {
  const grilla = fuente.getTileGrid();
  if (!grilla) return resolucionVista;
  const z = grilla.getZForResolution(resolucionVista, fuente.zDirection);
  return grilla.getResolution(z) * Math.cos(rad(latitud));
};

// Celulares y teléfonos en horizontal: el mismo corte que usa la interfaz móvil (ver css/selector-capas.css)
export const PANTALLA_COMPACTA = '(max-width: 640px), (max-height: 500px)';
export const esPantallaCompacta = () => Boolean(window.matchMedia?.(PANTALLA_COMPACTA).matches);

export const crearRelieve = () => {
  const fuente = new ImageTile({
    ...FUENTE_DEM,
    crossOrigin: 'anonymous', // WebGL solo lee imágenes con CORS
    interpolate: false // Interpolar los bytes RGB mezclaría alturas sin sentido
  });
  const capa = new WebGLTileLayer({
    source: fuente,
    className: 'ol-layer relieve-sombreado', // Lienzo propio, para mezclarlo con "multiplicar" (CSS)
    properties: { title: TITULO_RELIEVE },
    style: {
      variables: { resTextura: 1, exageracion: EXAGERACION, intensidad: INTENSIDAD },
      color: ['array', brillo, brillo, brillo, 1]
    },
    preload: 0
  });
  return { capa, fuente };
};

/**
 * Mantiene al día la escala de la pendiente con la vista. Solo cambia la variable cuando cambia
 * de verdad (más de 0,5 %): cada cambio vuelve a dibujar la capa.
 */
export const conectarRelieve = (map: Map, capa: WebGLTileLayer) => {
  const fuente = capa.getSource() as ImageTile | null;
  if (!fuente) return () => {};
  let actual = 0;
  const actualizar = () => {
    const vista = map.getView();
    const resolucion = vista.getResolution();
    const centro = vista.getCenter();
    if (!resolucion || !centro) return;
    const res = metrosPorPixelTextura(fuente, resolucion, toLonLat(centro, vista.getProjection())[1]);
    if (Math.abs(res - actual) / res < 0.005) return;
    actual = res;
    capa.updateStyleVariables({ resTextura: res });
  };
  actualizar();
  const claves = [map.getView().on('change:resolution', actualizar), map.on('moveend', actualizar)];
  return () => unByKey(claves);
};
