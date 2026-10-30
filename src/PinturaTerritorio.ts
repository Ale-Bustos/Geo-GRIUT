/*
 * Pinturas del territorio: manchas de color que se integran al relieve del mapa base (mezcla
 * "multiplicar"), con su nombre escrito a lo largo de la cumbre o del cauce.
 *
 * - Cordillera de Nawelfuta: cota 300 m del DEM ALOS PALSAR 12,5 m (remuestreado a 200 m, con cierre
 *   de 1,5 km para unir los cordones separados por valles interiores) y eje de la cumbre.
 * - Fio-Fio Lewfu (río Biobío): superficie del agua y eje del río de OpenStreetMap; el cauce con un
 *   margen de 150 m, suavizado. El nombre va sobre el curso bajo, de Hualqui al mar.
 * - Anca-lighen: trazo sobre el eje del río de OpenStreetMap (el mismo que dibuja el mapa base). Es un
 *   río angosto: un ancho fijo en metros se perdería de lejos y taparía todo de cerca, así que el trazo
 *   mide 180 m pero nunca menos de 6 px ni más de 16 px. El nombre va sobre el tramo recto antes de
 *   Concepción.
 *
 * Al aparecer, cada pintura se descubre en 3 s en su propia dirección (la cordillera de sur a norte,
 * el río aguas abajo) y queda fija. Un único controlador (BarridoPinturas) lleva el tiempo de todas
 * con un solo ciclo de animación y recorta el lienzo de las capas en prerender: las funciones de
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
import { fromLonLat } from 'ol/proj';
import { unByKey } from 'ol/Observable';
import { apply as applyTransform } from 'ol/transform';
import type { EventsKey } from 'ol/events';
import './css/pintura-territorio.css';

export const DURACION_BARRIDO_MS = 3000;
const FUENTE = '"Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
const INICIO_NOMBRE = 0.6; // Fracción del barrido desde la que empieza a aparecer el nombre
const FRENTE = 0.25; // Largo del frente difuminado, como fracción del recorrido

export interface DefinicionPintura {
  titulo: string; // Título de la capa de pintura (el que usa el selector de capas)
  url: string;
  color: string; // Relleno; con "multiplicar" oscurece lo que hay debajo sin taparlo
  nombre: string;
  colorNombre: string;
  cursiva?: boolean;
  difuminadoPx: number; // Borde suave de la pintura, como acuarela
  // Ríos angostos: en vez de un área, un trazo sobre el cauce (elemento tipo "cauce") con ancho en
  // metros acotado en píxeles
  trazo?: { metros: number; minPx: number; maxPx: number };
  atribucion?: string; // Crédito de los datos, en el control de atribución del mapa
  desde: [number, number]; // Punto (lon, lat) donde empieza el barrido...
  hasta: [number, number]; // ...y hacia donde avanza
}

// Verde musgo apagado: no se confunde con el café de la población indígena
export const NAWELFUTA: DefinicionPintura = {
  titulo: 'Nahuelbuta',
  url: '/geojson/Nahuelbuta.geojson',
  color: 'rgba(110, 130, 60, 0.42)',
  nombre: 'NAWELFUTA',
  colorNombre: '#3F4A1F',
  difuminadoPx: 2.5,
  desde: [-73.22, -37.47], // De sur a norte, a lo largo de la cumbre
  hasta: [-73.08, -36.89]
};

// Azul kallfü: con "multiplicar" ahonda el agua del mapa base y tiñe apenas las orillas
export const FIOFIO_LEWFU: DefinicionPintura = {
  titulo: 'Fio-Fio Lewfu',
  url: '/geojson/FioFio_Lewfu.geojson',
  color: 'rgba(43, 80, 160, 0.38)',
  nombre: 'FIO-FIO LEWFU',
  colorNombre: '#173F6B',
  cursiva: true, // Los nombres de agua van en cursiva, como en la hidrografía
  difuminadoPx: 2,
  atribucion: 'Fio-Fio Lewfu: © colaboradores de <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>',
  desde: [-72.59, -37.56], // Aguas abajo, hasta la desembocadura
  hasta: [-73.17, -36.815]
};

// Mismo azul que el Biobío: la hidrografía pintada se lee como una sola familia
export const ANCA_LIGHEN: DefinicionPintura = {
  titulo: 'Anca-lighen',
  url: '/geojson/AncaLighen.geojson',
  color: 'rgba(43, 80, 160, 0.55)', // Más intenso que el Biobío: el trazo es angosto y si no se pierde
  nombre: 'ANCA-LIGHEN',
  colorNombre: '#173F6B',
  cursiva: true,
  difuminadoPx: 1.5, // Río angosto: menos difuminado para que el trazo no se pierda
  trazo: { metros: 180, minPx: 8, maxPx: 16 },
  atribucion: 'Anca-lighen: © colaboradores de <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>',
  desde: [-72.821, -36.793], // Aguas abajo, de oriente a la bahía de Concepción
  hasta: [-73.016, -36.74]
};

export const tituloNombre = (def: DefinicionPintura) => def.titulo + ' (nombre)';

// Letras separadas con espacios finos: OpenLayers no tiene interletrado
const espaciar = (texto: string) => texto.split('').join(' ');

export function crearPintura(def: DefinicionPintura) {
  const source = new VectorSource({ url: def.url, format: new GeoJSON(), attributions: def.atribucion });
  const estiloArea = new Style({ fill: new Fill({ color: def.color }) });
  // Un estilo por ancho entero de trazo, para no crearlos en cada cuadro
  const estilosTrazo: Record<number, Style> = {};
  const estiloTrazo = (resolution: number) => {
    const t = def.trazo!;
    const ancho = Math.round(Math.min(t.maxPx, Math.max(t.minPx, t.metros / resolution)));
    estilosTrazo[ancho] ??= new Style({ stroke: new Stroke({ color: def.color, width: ancho, lineCap: 'round', lineJoin: 'round' }) });
    return estilosTrazo[ancho];
  };
  // Tamaño del nombre según el zoom (14 a 20 px); un estilo por tamaño para no crearlos en cada cuadro
  const estilosNombre: Record<number, Style> = {};
  const estiloNombre = (resolution: number) => {
    const zoom = Math.log2(156543.03392 / resolution);
    const size = Math.round(Math.min(20, Math.max(14, 14 + (zoom - 10) * 2)));
    estilosNombre[size] ??= new Style({
      text: new Text({
        text: espaciar(def.nombre),
        font: `${def.cursiva ? 'italic ' : ''}600 ${size}px ${FUENTE}`,
        fill: new Fill({ color: def.colorNombre }),
        stroke: new Stroke({ color: 'rgba(250, 247, 242, 0.85)', width: 3 }),
        placement: 'line',
        overflow: false, // Solo se escribe donde el nombre cabe completo sobre la línea
        maxAngle: Math.PI / 6
      })
    });
    return estilosNombre[size];
  };
  const pintura = new VectorLayer({
    source,
    style: (feature, resolution) => {
      const tipo = feature.get('tipo');
      if (tipo === 'area') return estiloArea;
      if (tipo === 'cauce' && def.trazo) return estiloTrazo(resolution);
      return undefined;
    },
    className: 'ol-layer pintura-territorio', // Lienzo propio, para mezclarlo con "multiplicar" (CSS)
    properties: { title: def.titulo },
    updateWhileAnimating: true,
    updateWhileInteracting: true
  });
  const nombre = new VectorLayer({
    source,
    style: (feature, resolution) => (feature.get('tipo') === 'eje' || feature.get('tipo') === 'cumbre' ? estiloNombre(resolution) : undefined),
    className: 'ol-layer pintura-territorio-nombre',
    properties: { title: tituloNombre(def) },
    minZoom: 9.5,
    updateWhileAnimating: true,
    updateWhileInteracting: true
  });
  // El nombre sigue al interruptor de la pintura (el selector solo conoce la pintura)
  pintura.on('change:visible', () => nombre.setVisible(pintura.getVisible()));
  return { pintura, nombre };
}

// Empieza y termina suave, con paso parejo al medio: el barrido se percibe durante los 3 s
const suavizar = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

interface Barrido {
  pintura: VectorLayer;
  difuminadoPx: number;
  origen: number[]; // Inicio del recorrido, en coordenadas del mapa
  eje: number[]; // Vector unitario de avance
  largo: number;
  inicio: number | null;
  progreso: number; // 1 = pintura completa y fija
  claves: EventsKey[];
}

/** Único controlador de los barridos: un solo ciclo de animación para todas las pinturas. */
export class BarridoPinturas {
  private barridos: Barrido[] = [];
  private cuadro = 0;
  private enCurso = false;

  constructor(private map: Map, private duracion = DURACION_BARRIDO_MS) {}

  registrar(def: DefinicionPintura, pintura: VectorLayer, nombre: VectorLayer) {
    const origen = fromLonLat(def.desde);
    const destino = fromLonLat(def.hasta);
    const dx = destino[0] - origen[0], dy = destino[1] - origen[1];
    const largo = Math.hypot(dx, dy);
    const b: Barrido = { pintura, difuminadoPx: def.difuminadoPx, origen, eje: [dx / largo, dy / largo], largo, inicio: null, progreso: 1, claves: [] };
    const recortar = (e: BaseEvent | Event) => this.recortar(b, e as RenderEvent);
    const restaurar = (e: BaseEvent | Event) => {
      const evento = e as RenderEvent;
      const ctx = evento.context as CanvasRenderingContext2D | undefined;
      if (!ctx) return;
      this.difuminarFrente(b, evento, ctx);
      ctx.restore();
    };
    b.claves.push(
      pintura.on('prerender', recortar), pintura.on('postrender', restaurar),
      nombre.on('prerender', recortar), nombre.on('postrender', restaurar),
      // Vuelve a barrer cada vez que se enciende la capa
      pintura.on('change:visible', () => { if (pintura.getVisible()) this.iniciar(pintura); })
    );
    this.barridos.push(b);
  }

  /** Empieza (o reinicia) el barrido de una pintura, o de todas. Con "reducir movimiento" muestra el resultado. */
  iniciar(pintura?: VectorLayer) {
    const reducir = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    this.barridos.filter((b) => !pintura || b.pintura === pintura).forEach((b) => {
      b.inicio = null;
      b.progreso = reducir ? 1 : 0;
    });
    this.map.render();
    if (!reducir && !this.enCurso) {
      this.enCurso = true;
      this.cuadro = requestAnimationFrame(this.paso);
    }
  }

  // El único ciclo: avanza todos los barridos en curso y se detiene cuando ninguno sigue
  private paso = (ahora: number) => {
    let quedan = false;
    for (const b of this.barridos) {
      if (b.progreso >= 1) continue;
      b.inicio ??= ahora;
      b.progreso = Math.min(1, (ahora - b.inicio) / this.duracion);
      quedan ||= b.progreso < 1;
    }
    this.map.render();
    this.enCurso = quedan;
    if (quedan) this.cuadro = requestAnimationFrame(this.paso);
  };

  terminado(pintura: VectorLayer) {
    return (this.barridos.find((b) => b.pintura === pintura)?.progreso ?? 1) >= 1;
  }

  destruir() {
    cancelAnimationFrame(this.cuadro);
    this.enCurso = false;
    this.barridos.forEach((b) => unByKey(b.claves));
    this.barridos = [];
  }

  // Punto del recorrido a la distancia s del origen, desplazado n de costado; en píxeles del lienzo
  private aPixel(b: Barrido, e: RenderEvent, s: number, n = 0) {
    const c = [b.origen[0] + b.eje[0] * s - b.eje[1] * n, b.origen[1] + b.eje[1] * s + b.eje[0] * n];
    return getRenderPixel(e, applyTransform(e.frameState!.coordinateToPixelTransform, c));
  }

  // Distancia del origen hasta donde llegó el barrido; pasa del final para que el frente salga completo
  private frente(b: Barrido) {
    return b.largo * suavizar(b.progreso) * (1 + FRENTE);
  }

  // Deja dibujar solo la parte que el barrido ya alcanzó (en coordenadas del mapa, así sigue a la
  // cordillera o al río aunque el mapa esté girado)
  private recortar(b: Barrido, e: RenderEvent) {
    const ctx = e.context as CanvasRenderingContext2D | undefined;
    if (!ctx) return;
    ctx.save();
    const esPintura = e.target === b.pintura;
    if (esPintura) ctx.filter = `blur(${b.difuminadoPx * e.frameState!.pixelRatio}px)`;
    if (b.progreso >= 1) return;
    if (!esPintura) {
      // El nombre no se recorta: aparece con un fundido en el último tramo del barrido
      ctx.globalAlpha = Math.max(0, (b.progreso - INICIO_NOMBRE) / (1 - INICIO_NOMBRE));
      return;
    }
    const s = this.frente(b), ancho = b.largo; // Rectángulo holgado a ambos lados del recorrido
    const esquinas = [this.aPixel(b, e, -b.largo, -ancho), this.aPixel(b, e, -b.largo, ancho), this.aPixel(b, e, s, ancho), this.aPixel(b, e, s, -ancho)];
    ctx.beginPath();
    esquinas.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.clip();
  }

  // Frente del barrido como pintura que avanza: se desvanece en una franja en vez de cortar en seco
  private difuminarFrente(b: Barrido, e: RenderEvent, ctx: CanvasRenderingContext2D) {
    if (b.progreso >= 1 || e.target !== b.pintura) return;
    const s = this.frente(b);
    const [ax, ay] = this.aPixel(b, e, s - b.largo * FRENTE);
    const [bx, by] = this.aPixel(b, e, s);
    const degradado = ctx.createLinearGradient(ax, ay, bx, by);
    degradado.addColorStop(0, 'rgba(0, 0, 0, 0)');
    degradado.addColorStop(1, 'rgba(0, 0, 0, 1)');
    ctx.filter = 'none';
    ctx.globalCompositeOperation = 'destination-out'; // Borra la pintura según el degradado
    ctx.fillStyle = degradado;
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  }
}
