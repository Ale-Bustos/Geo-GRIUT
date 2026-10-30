// Recorrido guiado (story map): cada capítulo lleva la cámara a un lugar, deja encendidas solo sus
// capas y cuenta su historia en la tarjeta del tutorial (modo 'recorrido')
import type Map from 'ol/Map';
import type BaseLayer from 'ol/layer/Base';
import type LayerGroup from 'ol/layer/Group';
import { fromLonLat } from 'ol/proj';
import type { Coordinate } from 'ol/coordinate';
import TutorialMapa, { type PasoTutorial } from './TutorialMapa';
import { INITIAL_ROTATION } from './vista';

export interface Capitulo extends PasoTutorial {
  vista: {
    centro: [number, number]; // lon, lat
    zoom: number;
    rotacion?: number; // Por defecto, el este (Puelmapu) arriba
  };
  capas: string[]; // Títulos de las capas que quedan encendidas; las demás capas temáticas se apagan
}

export interface DefinicionRecorrido {
  id: string; // Va en la URL (?recorrido=…&paso=…) para compartir un capítulo
  titulo: string;
  capitulos: Capitulo[];
}

export interface OpcionesRecorrido {
  alCambiar?: (indice: number) => void;
  alAbrir?: () => void;
  alCerrar?: () => void;
}

const DURACION_VUELO_MS = 1200;
const MARGEN_TARJETA = 8; // Separación entre la tarjeta y el lugar enfocado, en píxeles

// Capas que el recorrido enciende y apaga: las del grupo "Capas" (no el mapa base). Los nombres de
// las pinturas siguen solos a su pintura, así que no se tocan
export const capasTematicas = (map: Map): BaseLayer[] => {
  const grupo = map.getLayers().getArray().find((capa) => capa.get('title') === 'Capas') as LayerGroup | undefined;
  return (grupo?.getLayers().getArray() ?? []).filter((capa) => !String(capa.get('title')).endsWith(' (nombre)'));
};

// Parte del mapa que tapa la tarjeta, como relleno de la vista [arriba, derecha, abajo, izquierda]:
// así el lugar del capítulo queda centrado en lo que se ve y no debajo de la tarjeta
type Rectangulo = Pick<DOMRect, 'left' | 'top' | 'right' | 'width' | 'height'>;

export const rellenoTarjeta = (tarjeta: Rectangulo, ancho: number, alto: number): number[] => {
  if (tarjeta.width === 0 || tarjeta.height === 0) return [0, 0, 0, 0];
  if (tarjeta.width > ancho * 0.6) return [0, 0, alto - tarjeta.top + MARGEN_TARJETA, 0]; // Celular: abajo
  if (tarjeta.left < ancho / 2) return [0, 0, 0, tarjeta.right + MARGEN_TARJETA]; // A la izquierda
  return [0, ancho - tarjeta.left + MARGEN_TARJETA, 0, 0]; // A la derecha
};

const leerPaso = (id: string, total: number) => {
  const params = new URLSearchParams(window.location.search);
  if (params.get('recorrido') !== id) return null;
  const paso = Number(params.get('paso') || 1);
  return Number.isInteger(paso) && paso >= 1 && paso <= total ? paso - 1 : 0;
};

const escribirPaso = (id: string, indice: number | null) => {
  const url = new URL(window.location.href);
  if (indice === null) {
    url.searchParams.delete('recorrido');
    url.searchParams.delete('paso');
  } else {
    url.searchParams.set('recorrido', id);
    url.searchParams.set('paso', String(indice + 1));
  }
  window.history.replaceState(window.history.state, '', url);
};

export default class Recorrido {
  private tarjeta: TutorialMapa;
  private capas: BaseLayer[];
  // Lo que había antes de entrar, para dejar el mapa como estaba al salir
  private visiblesAntes: boolean[] = [];
  private vistaAntes: { centro?: Coordinate; zoom?: number; rotacion: number } | null = null;

  constructor(private map: Map, private def: DefinicionRecorrido, private opciones: OpcionesRecorrido = {}) {
    this.capas = capasTematicas(map);
    const titulos = new Set(this.capas.map((capa) => capa.get('title')));
    def.capitulos.flatMap((c) => c.capas).filter((t) => !titulos.has(t))
      .forEach((t) => console.warn('Recorrido "' + def.id + '": no existe la capa "' + t + '"'));

    this.tarjeta = new TutorialMapa({
      modo: 'recorrido',
      pasos: def.capitulos,
      textoSaltar: 'Salir',
      textoFinal: 'Terminar el recorrido',
      alCambiar: (indice) => this.mostrar(indice),
      alCerrar: () => this.restaurar()
    });
  }

  get abierto() {
    return this.tarjeta.abierto;
  }

  abrir(indice = 0) {
    if (this.tarjeta.abierto) {
      this.tarjeta.ir(indice);
      return;
    }
    const vista = this.map.getView();
    this.visiblesAntes = this.capas.map((capa) => capa.getVisible());
    this.vistaAntes = { centro: vista.getCenter(), zoom: vista.getZoom(), rotacion: vista.getRotation() };
    this.opciones.alAbrir?.();
    this.tarjeta.abrir(indice);
  }

  /** Abre el recorrido si la URL apunta a él; devuelve si lo abrió. */
  abrirDesdeUrl() {
    const indice = leerPaso(this.def.id, this.def.capitulos.length);
    if (indice === null) return false;
    this.abrir(indice);
    return true;
  }

  cerrar() {
    this.tarjeta.cerrar();
  }

  destruir() {
    this.tarjeta.destruir();
  }

  private mostrar(indice: number) {
    const capitulo = this.def.capitulos[indice];
    const encendidas = new Set(capitulo.capas);
    this.capas.forEach((capa) => capa.setVisible(encendidas.has(capa.get('title'))));

    const vista = this.map.getView();
    const tarjeta = this.tarjeta.tarjeta?.getBoundingClientRect();
    const mapa = this.map.getViewport()?.getBoundingClientRect();
    if (tarjeta && mapa) {
      // Medidas de la tarjeta respecto del mapa
      const relativa = { left: tarjeta.left - mapa.left, top: tarjeta.top - mapa.top, right: tarjeta.right - mapa.left, width: tarjeta.width, height: tarjeta.height };
      vista.padding = rellenoTarjeta(relativa, mapa.width, mapa.height);
    }
    vista.cancelAnimations();
    const reducir = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    vista.animate({
      center: fromLonLat(capitulo.vista.centro),
      zoom: capitulo.vista.zoom,
      rotation: capitulo.vista.rotacion ?? INITIAL_ROTATION,
      duration: reducir ? 0 : DURACION_VUELO_MS
    });
    escribirPaso(this.def.id, indice);
    this.opciones.alCambiar?.(indice);
  }

  private restaurar() {
    const vista = this.map.getView();
    vista.cancelAnimations();
    vista.padding = [0, 0, 0, 0];
    this.capas.forEach((capa, k) => capa.setVisible(this.visiblesAntes[k] ?? capa.getVisible()));
    if (this.vistaAntes?.centro) {
      const reducir = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      vista.animate({
        center: this.vistaAntes.centro,
        zoom: this.vistaAntes.zoom,
        rotation: this.vistaAntes.rotacion,
        duration: reducir ? 0 : DURACION_VUELO_MS
      });
    }
    escribirPaso(this.def.id, null);
    this.opciones.alCerrar?.();
  }
}
