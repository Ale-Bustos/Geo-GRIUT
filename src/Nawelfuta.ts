/*
 * Cordillera de Nawelfuta: una mancha de color que se integra al sombreado del relieve del mapa base
 * y su nombre a lo largo de la cumbre.
 *
 * Contorno: cota 300 m del DEM ALOS PALSAR 12,5 m (remuestreado a 200 m, con cierre de 1,5 km para unir
 * los cordones separados por valles interiores); eje de la cumbre trazado sobre el mismo relieve.
 *
 * Al aparecer, la pintura se descubre de sur a norte en 3 s y queda fija. Un único controlador
 * (BarridoNawelfuta) lleva el tiempo y recorta el lienzo de las capas en prerender: las funciones de
 * estilo son estáticas, así que no hay animaciones por elemento que se puedan acumular.
 */
import type Map from 'ol/Map';
import type BaseEvent from 'ol/events/Event';
import type RenderEvent from 'ol/render/Event';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import GeoJSON from 'ol/format/GeoJSON';
import { Style, Fill, Stroke, Text } from 'ol/style';
import { getRenderPixel } from 'ol/render';
import { getBottomLeft, getBottomRight, getHeight, type Extent } from 'ol/extent';
import { unByKey } from 'ol/Observable';
import { apply as applyTransform } from 'ol/transform';
import './css/nawelfuta.css';
import type { EventsKey } from 'ol/events';

export const TITULO_NAWELFUTA = 'Nahuelbuta';
export const TITULO_NOMBRE_NAWELFUTA = 'Nahuelbuta (nombre)';
export const DURACION_BARRIDO_MS = 3000;
// Verde musgo apagado: con mezcla "multiplicar" oscurece el relieve sin taparlo,
// y no se confunde con el café de la población indígena
export const COLOR_NAWELFUTA = 'rgba(110, 130, 60, 0.42)';
const COLOR_NOMBRE = '#3F4A1F';
const DIFUMINADO_PX = 2.5; // Borde suave de la pintura, como acuarela
const FUENTE = '"Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

// Letras separadas con espacios finos: OpenLayers no tiene interletrado
const NOMBRE = 'NAWELFUTA'.split('').join(' ');

const estiloPintura = new Style({ fill: new Fill({ color: COLOR_NAWELFUTA }) });

// Tamaño del nombre según el zoom (14 a 20 px); un estilo por tamaño para no crearlos en cada cuadro
const estilosNombre: Record<number, Style> = {};
const estiloNombre = (resolution: number) => {
  const zoom = Math.log2(156543.03392 / resolution);
  const size = Math.round(Math.min(20, Math.max(14, 14 + (zoom - 10) * 2)));
  estilosNombre[size] ??= new Style({
    text: new Text({
      text: NOMBRE,
      font: `600 ${size}px ${FUENTE}`,
      fill: new Fill({ color: COLOR_NOMBRE }),
      stroke: new Stroke({ color: 'rgba(250, 247, 242, 0.85)', width: 3 }),
      placement: 'line',
      overflow: false, // Solo se escribe donde el nombre cabe completo sobre la cumbre
      maxAngle: Math.PI / 6
    })
  });
  return estilosNombre[size];
};

export function crearCapasNawelfuta() {
  const source = new VectorSource({ url: '/geojson/Nahuelbuta.geojson', format: new GeoJSON() });
  const pintura = new VectorLayer({
    source,
    style: (feature) => (feature.get('tipo') === 'area' ? estiloPintura : undefined),
    className: 'ol-layer nawelfuta-pintura', // Lienzo propio, para mezclarlo con "multiplicar" (CSS)
    properties: { title: TITULO_NAWELFUTA },
    updateWhileAnimating: true,
    updateWhileInteracting: true
  });
  const nombre = new VectorLayer({
    source,
    style: (feature, resolution) => (feature.get('tipo') === 'cumbre' ? estiloNombre(resolution) : undefined),
    className: 'ol-layer nawelfuta-nombre',
    properties: { title: TITULO_NOMBRE_NAWELFUTA },
    minZoom: 9.5,
    updateWhileAnimating: true,
    updateWhileInteracting: true
  });
  // El nombre sigue al interruptor de la pintura (el selector solo conoce la pintura)
  pintura.on('change:visible', () => nombre.setVisible(pintura.getVisible()));
  return { pintura, nombre };
}

// Empieza y termina suave, con paso parejo al medio: el barrido se percibe durante los 3 s
const INICIO_NOMBRE = 0.6; // Fracción del barrido desde la que empieza a aparecer el nombre
const FRENTE = 0.25; // Largo del frente difuminado, como fracción del largo de la cordillera
const suavizar = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** Único controlador del barrido: un solo ciclo de animación, recorte en prerender, resultado fijo. */
export class BarridoNawelfuta {
  private inicio: number | null = null;
  private progreso = 1; // 1 = pintura completa y fija
  private cuadro = 0;
  private claves: EventsKey[] = [];

  constructor(private map: Map, private pintura: VectorLayer, nombre: VectorLayer, private duracion = DURACION_BARRIDO_MS) {
    const recortar = (e: BaseEvent | Event) => this.recortar(e as RenderEvent);
    const restaurar = (e: BaseEvent | Event) => {
      const evento = e as RenderEvent;
      const ctx = evento.context as CanvasRenderingContext2D | undefined;
      if (!ctx) return;
      this.difuminarFrente(evento, ctx);
      ctx.restore();
    };
    this.claves.push(
      pintura.on('prerender', recortar), pintura.on('postrender', restaurar),
      nombre.on('prerender', recortar), nombre.on('postrender', restaurar),
      // Vuelve a barrer cada vez que se enciende la capa
      pintura.on('change:visible', () => { if (pintura.getVisible()) this.iniciar(); })
    );
  }

  /** Empieza (o reinicia) el barrido. Con "reducir movimiento" muestra directo el resultado. */
  iniciar() {
    cancelAnimationFrame(this.cuadro);
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      this.progreso = 1;
      this.map.render();
      return;
    }
    this.inicio = null;
    this.progreso = 0;
    const paso = (ahora: number) => {
      this.inicio ??= ahora;
      this.progreso = Math.min(1, (ahora - this.inicio) / this.duracion);
      this.map.render();
      if (this.progreso < 1) this.cuadro = requestAnimationFrame(paso);
    };
    this.cuadro = requestAnimationFrame(paso);
  }

  get terminado() {
    return this.progreso >= 1;
  }

  destruir() {
    cancelAnimationFrame(this.cuadro);
    unByKey(this.claves);
    this.claves = [];
  }

  // Latitud (en coordenadas del mapa) hasta donde llegó el barrido; pasa un poco del extremo norte
  // para que el frente difuminado salga completo
  private borde(extent: Extent) {
    return extent[1] + getHeight(extent) * (suavizar(this.progreso) * (1 + FRENTE));
  }

  // Frente del barrido como pintura que avanza: se desvanece en una franja en vez de cortar en seco
  private difuminarFrente(e: RenderEvent, ctx: CanvasRenderingContext2D) {
    if (this.progreso >= 1 || e.target !== this.pintura) return;
    const extent = this.pintura.getSource()?.getExtent() as Extent | undefined;
    if (!extent || !Number.isFinite(extent[0])) return;
    const borde = this.borde(extent);
    const x = (extent[0] + extent[2]) / 2;
    const aPixel = (c: number[]) => getRenderPixel(e, applyTransform(e.frameState!.coordinateToPixelTransform, c.slice()));
    const [ax, ay] = aPixel([x, borde - getHeight(extent) * FRENTE]);
    const [bx, by] = aPixel([x, borde]);
    const degradado = ctx.createLinearGradient(ax, ay, bx, by);
    degradado.addColorStop(0, 'rgba(0, 0, 0, 0)');
    degradado.addColorStop(1, 'rgba(0, 0, 0, 1)');
    ctx.filter = 'none';
    ctx.globalCompositeOperation = 'destination-out'; // Borra la pintura según el degradado
    ctx.fillStyle = degradado;
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  }

  // Deja dibujar solo la parte de la cordillera que el barrido ya alcanzó (de sur a norte, en
  // coordenadas del mapa, así el barrido sigue a la cordillera aunque el mapa esté girado)
  private recortar(e: RenderEvent) {
    const ctx = e.context as CanvasRenderingContext2D | undefined;
    if (!ctx) return;
    ctx.save();
    if (e.target === this.pintura) ctx.filter = `blur(${DIFUMINADO_PX * e.frameState!.pixelRatio}px)`;
    if (this.progreso >= 1) return;
    if (e.target !== this.pintura) {
      // El nombre no se recorta: aparece con un fundido en el último tramo del barrido
      ctx.globalAlpha = Math.max(0, (this.progreso - INICIO_NOMBRE) / (1 - INICIO_NOMBRE));
      return;
    }
    const extent = this.pintura.getSource()?.getExtent() as Extent | undefined;
    if (!extent || !Number.isFinite(extent[0])) return;
    const alto = getHeight(extent);
    const borde = this.borde(extent);
    const [x0, y0] = getBottomLeft(extent);
    const [x1] = getBottomRight(extent);
    const margen = alto; // Rectángulo holgado: cubre el ancho aunque el mapa esté girado
    const esquinas = [[x0 - margen, y0 - margen], [x1 + margen, y0 - margen], [x1 + margen, borde], [x0 - margen, borde]]
      // Coordenada del mapa -> píxel de pantalla -> píxel del lienzo de la capa
      .map((c) => getRenderPixel(e, applyTransform(e.frameState!.coordinateToPixelTransform, c.slice())));
    ctx.beginPath();
    esquinas.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.clip();
  }
}
