import 'ol/ol.css'; // Importa los estilos básicos de OpenLayers
import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react'; // Importa los hooks de React necesarios
import { createPortal } from 'react-dom';
import Map from 'ol/Map'; // Importa la clase Map de OpenLayers
import View from 'ol/View'; // Importa la clase View de OpenLayers
import Overlay from 'ol/Overlay'; // Importa la clase Overlay para el popup
import LayerGroup from 'ol/layer/Group'; // Importa la clase LayerGroup de OpenLayers
import TileLayer from 'ol/layer/Tile'; // Importa la clase TileLayer de OpenLayers
import TileImage from 'ol/source/TileImage'; // Importa la clase TileImage de OpenLayers
import { fromLonLat } from 'ol/proj'; // Importa la función de proyección de coordenadas
import { defaults as defaultControls, ScaleLine } from 'ol/control'; // Importa los controles por defecto y la barra de escala
import VectorLayer from 'ol/layer/Vector'; // Importa la clase VectorLayer de OpenLayers
import VectorSource from 'ol/source/Vector'; // Importa la clase VectorSource de OpenLayers
import GeoJSON from 'ol/format/GeoJSON'; // Importa el formato GeoJSON de OpenLayers
import VectorTileLayer from 'ol/layer/VectorTile'; // Capa de teselas vectoriales
import VectorTileSource from 'ol/source/VectorTile'; // Fuente de teselas vectoriales
import MVT from 'ol/format/MVT'; // Formato Mapbox Vector Tile que entrega GeoServer
import RenderFeature from 'ol/render/Feature'; // Elementos livianos que entregan las teselas vectoriales
import MultiLineString from 'ol/geom/MultiLineString';
import { douglasPeuckerArray } from 'ol/geom/flat/simplify';
import { Style, Fill, Stroke, Circle as CircleStyle, Icon, Text } from 'ol/style'; // Importa las clases de estilos de OpenLayers
import type ImageStyle from 'ol/style/Image';
import Point from 'ol/geom/Point';
import type BaseLayer from 'ol/layer/Base';
import type { FeatureLike } from 'ol/Feature';
import type { Coordinate } from 'ol/coordinate';
import SelectorCapas from './SelectorCapas'; // Selector de capas con leyenda
import './css/compass.css'; // Importa los estilos de la brújula desde src/css
import './css/logo.css'; // Importa los estilos del logo de GRIUT
import './css/popup.css'; // Importa los estilos del popup de los puntos
import './css/selector-capas.css'; // Estilos del selector de capas
import './css/tutorial-mapa.css'; // Estilos del tutorial
import TutorialMapa from './TutorialMapa'; // Tutorial de bienvenida
import FeaturePopup from './FeaturePopup';
import { crearCapasNawelfuta, BarridoNawelfuta, TITULO_NAWELFUTA, TITULO_NOMBRE_NAWELFUTA, COLOR_NAWELFUTA } from './Nawelfuta';
import simboloBrujula from './img/compass-simbolo.png'; // Símbolo del meli witran mapu, sin los nombres

// Punto del mapa cuyo popup está abierto
interface SelectedFeature {
  properties: Record<string, unknown>;
  category: string;
  coordinate: Coordinate;
}

// Token público de Mapbox para el mapa base (ver .env.example)
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
if (!MAPBOX_TOKEN && import.meta.env.MODE !== 'test') {
  console.error('Falta VITE_MAPBOX_TOKEN: el mapa base de Mapbox no se cargará');
}

// minZoom de OpenLayers es exclusivo (zoom > minZoom); se resta un margen mínimo
// para que cada capa siga apareciendo desde el mismo nivel de zoom que antes (zoom >= umbral)
const ZOOM_EPSILON = 0.01;

const INITIAL_ROTATION = -Math.PI / 2; // Rotación inicial del mapa: el este (Puelmapu) queda arriba
const NORTH_ROTATION = 0; // Rotación con el norte arriba

// Ángulo que gira el mapa con cada pulsación de las flechas sobre la brújula
const COMPASS_KEY_STEP = Math.PI / 12; // 15°
// Giro mínimo del puntero para que se considere un arrastre y no un clic
const COMPASS_DRAG_THRESHOLD = Math.PI / 90; // 2°
const COMPASS_ANIMATION_MS = 400;

// Arco de la brújula (viewBox de 200 × 200, centro en 100,100) por el que corre el nombre de cada tierra.
// Los ángulos se miden en grados desde arriba en sentido horario; el sentido del recorrido decide
// hacia dónde mira la letra: horario, hacia afuera; antihorario, hacia el centro
const compassArc = (radius: number, from: number, to: number) => {
  const point = (deg: number) => {
    const rad = (deg * Math.PI) / 180;
    return (100 + radius * Math.sin(rad)).toFixed(2) + ' ' + (100 - radius * Math.cos(rad)).toFixed(2);
  };
  return 'M ' + point(from) + ' A ' + radius + ' ' + radius + ' 0 0 ' + (to > from ? 1 : 0) + ' ' + point(to);
};
// Los nombres van como texto (no dentro de la imagen) para que se lean bien aunque la brújula sea chica
const COMPASS_LABELS = [
  { id: 'puel', text: 'PUELMAPU', d: compassArc(66, -60, 60), length: 82, className: 'compass-puel' },
  { id: 'willi', text: 'WILLIMAPU', d: compassArc(66, 30, 150), length: 80 },
  { id: 'lafken', text: 'LAFKENMAPU', d: compassArc(80, 240, 120), length: 98 },
  { id: 'pikun', text: 'PIKUNMAPU', d: compassArc(66, 210, 330), length: 88 }
];

// Densidad de píxeles con que se dibuja el mapa mientras se mueve. Pintar el canvas a la densidad
// de una pantalla de alta resolución es lo que más cuesta en cada cuadro; al detenerse el mapa
// vuelve a la densidad de la pantalla para que se vea nítido
const MOVING_PIXEL_RATIO = 1;

// Las capas de puntos y nombres se redibujan también mientras el mapa se mueve. Si reutilizan el
// dibujo anterior, quedan con la densidad de la pantalla y, al bajar la densidad, los íconos y
// etiquetas se ven agrandados (3 veces en un celular de densidad 3). Son pocos elementos: es barato
const REDRAW_WHILE_MOVING = { updateWhileAnimating: true, updateWhileInteracting: true };

// Lleva un ángulo al rango (-π, π], para comparar rotaciones y girar por el camino más corto
const normalizeAngle = (angle: number) => Math.atan2(Math.sin(angle), Math.cos(angle));

// Ángulo del puntero respecto al centro de un elemento, en sentido horario desde arriba
// (el mismo sentido que la rotación de OpenLayers)
const pointerAngle = (element: HTMLElement, clientX: number, clientY: number) => {
  const rect = element.getBoundingClientRect();
  return Math.atan2(clientX - (rect.left + rect.width / 2), (rect.top + rect.height / 2) - clientY);
};

// Las capas con etiquetas se depuran juntas: si dos etiquetas chocan, solo se dibuja la de la capa
// más arriba en la leyenda (o la primera dentro de la misma capa)
const LABEL_DECLUTTER_GROUP = 'etiquetas';

// Fuentes de las etiquetas del mapa: las del sistema de cada dispositivo (Calibri solo existe en Windows)
const LABEL_FONT_FAMILY = '"Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

// Tolerancia en píxeles para hacer clic sobre un punto (facilita el uso en pantallas táctiles)
const POPUP_HIT_TOLERANCE = 6;

// Clave de localStorage que recuerda que ya se vio el tutorial
export const TUTORIAL_KEY = 'tutorialMapa.visto.v1';

// Busca una capa por su título, también dentro de los grupos
const findLayer = (map: Map, title: string) => {
  const layer = map.getAllLayers().find((candidate) => candidate.get('title') === title) ?? null;
  if (!layer) {
    console.warn('No se encontró la capa con título "' + title + '"');
  }
  return layer;
};

// Solo las capas con categoría de popup responden a los clics
const isPopupLayer = (layer: BaseLayer) => Boolean(layer.get('popupCategory'));

// Guarda en caché los estilos por texto: OpenLayers llama a la función de estilo
// en cada renderizado, así que crear estilos nuevos cada vez es costoso
const createCachedStyleFunction = (
  getText: (feature: FeatureLike) => string | undefined,
  buildStyle: (text: string) => Style
) => {
  const cache: Record<string, Style> = {};
  return (feature: FeatureLike) => {
    const text = getText(feature) || '';
    if (!cache[text]) {
      cache[text] = buildStyle(text);
    }
    return cache[text];
  };
};

// Texto de la etiqueta de un elemento, según la columna que traiga su capa
const getLabel = (feature: FeatureLike): string | undefined =>
  feature.get('Nombre') || feature.get('PopupInfo') || feature.get('Name');

// Etiqueta de las capas GeoJSON; en los puntos va encima del símbolo (a offsetY píxeles) y no sobre él
const createLabel = (text: string, offsetY: number) => new Text({
  font: `16px ${LABEL_FONT_FAMILY}`,
  fill: new Fill({ color: '#000' }),
  stroke: new Stroke({
    color: '#fff',
    width: 2
  }),
  text: text,
  overflow: true,
  placement: 'line',
  textBaseline: 'bottom',
  offsetY: offsetY
});

// GeoServer de GRIUT: sirve las capas pesadas como teselas vectoriales que GeoWebCache guarda en caché
const GEOSERVER_URL = 'https://geo.myc-ingenieria.cl/geoserver';
// Último zoom precalculado en el servidor; más cerca, OpenLayers amplía las teselas de este nivel
const GEOSERVER_MAX_ZOOM = 16;

// Fuente de teselas vectoriales (MVT) de una capa del workspace griut de GeoServer
const createGeoServerTileSource = (layerName: string) => new VectorTileSource({
  format: new MVT(),
  // TMS numera las filas de abajo hacia arriba, de ahí {-y}
  url: `${GEOSERVER_URL}/gwc/service/tms/1.0.0/griut:${layerName}@EPSG:900913@pbf/{z}/{x}/{-y}.pbf`,
  maxZoom: GEOSERVER_MAX_ZOOM
});

// Función para crear capas de teselas vectoriales de GeoServer con estilos personalizados
const createGeoServerLayer = (layerName: string, style: Style, title: string, visible = true) => new VectorTileLayer({
  source: createGeoServerTileSource(layerName),
  style: createCachedStyleFunction(
    getLabel,
    (text) => new Style({
      stroke: style.getStroke() ?? undefined,
      fill: style.getFill() ?? undefined,
      image: style.getImage() ?? undefined,
      text: createLabel(text, -6)
    })
  ),
  properties: {
    title: title
  },
  visible: visible,
  declutter: LABEL_DECLUTTER_GROUP
});

// Símbolo de un punto: su imagen y cuánto se sube la etiqueta para no taparla
interface PointSymbol {
  name: string;
  image: ImageStyle;
  labelOffsetY: number;
}

// Alto en píxeles con que se dibujan los íconos de la simbología
const ICON_HEIGHT = 28;

// Ícono de public/simbologia (PNG a 4x, para que se vea nítido en pantallas de alta densidad)
const createIconSymbol = (name: string): PointSymbol => ({
  name,
  image: new Icon({
    src: `/simbologia/${name}.png`,
    height: ICON_HEIGHT,
    declutterMode: 'obstacle' // El ícono siempre se dibuja; las etiquetas lo esquivan
  }),
  labelOffsetY: -(ICON_HEIGHT / 2 + 2)
});

// Círculo de color, para los puntos que no tienen un ícono propio
const createCircleSymbol = (name: string, fillColor: string, strokeColor: string): PointSymbol => ({
  name,
  image: new CircleStyle({
    radius: 5,
    fill: new Fill({ color: fillColor }),
    stroke: new Stroke({ color: strokeColor, width: 1 }),
    declutterMode: 'obstacle' // El punto siempre se dibuja; las etiquetas lo esquivan
  }),
  labelOffsetY: -6
});

// Capa de puntos con popup; getSymbol elige el símbolo de cada punto
const createPointLayer = (
  url: string,
  title: string,
  popupCategory: string,
  getSymbol: (feature: FeatureLike) => PointSymbol
) => {
  const cache: Record<string, Style> = {}; // Un estilo por cada combinación de símbolo y etiqueta
  return new VectorLayer({
    source: new VectorSource({
      url: url,
      format: new GeoJSON()
    }),
    style: (feature) => {
      const symbol = getSymbol(feature);
      const text = getLabel(feature) || '';
      const key = symbol.name + '|' + text;
      if (!cache[key]) {
        cache[key] = new Style({
          image: symbol.image,
          text: createLabel(text, symbol.labelOffsetY)
        });
      }
      return cache[key];
    },
    properties: {
      title: title,
      popupCategory: popupCategory // Categoría que se muestra en el popup
    },
    visible: false,
    declutter: LABEL_DECLUTTER_GROUP,
    ...REDRAW_WHILE_MOVING
  });
};

// Azul oscuro para los nombres del agua: el celeste de las líneas no se lee como texto sobre el mapa
const WATER_LABEL_COLOR = '#1b5e86';

// Las etiquetas siguen el cauce mientras no se doble más que esto entre letras (~36°)
const WATER_LABEL_MAX_ANGLE = Math.PI / 5;

// Detalle en píxeles que se ignora al trazar el camino de una etiqueta. Los cauces están digitalizados
// con muchos vértices y zigzaguean a escala de pocos píxeles: sin simplificar, OpenLayers no encuentra
// un tramo parejo donde quepa el nombre
const WATER_LABEL_SIMPLIFY_PX = 12;

// Línea suavizada para la resolución actual, sobre la que se escribe el nombre (la línea se dibuja completa)
const simplifyForLabel = (feature: FeatureLike, resolution: number) => {
  if (!(feature instanceof RenderFeature)) {
    return undefined;
  }
  const tolerance = WATER_LABEL_SIMPLIFY_PX * resolution;
  const flatCoordinates = feature.getFlatCoordinates();
  const ends = feature.getEnds() as number[];
  const simplified: number[] = [];
  const simplifiedEnds: number[] = [];
  douglasPeuckerArray(flatCoordinates, 0, ends, 2, tolerance * tolerance, simplified, 0, simplifiedEnds);
  return new MultiLineString(simplified, 'XY', simplifiedEnds);
};

// labelFont: tamaño y peso del nombre, para que los ríos destaquen sobre esteros y quebradas
const createWaterLayer = (layerName: string, color: string, title: string, labelFont: string) => {
  const lineStyle = new Style({
    stroke: new Stroke({
      color: color,
      width: 2
    })
  });
  const labels: Record<string, Text> = {}; // Un texto por nombre; la geometría cambia en cada elemento
  return new VectorTileLayer({
    source: createGeoServerTileSource(layerName),
    style: (feature, resolution) => {
      const name = feature.get('Nombre');
      if (!name) {
        return lineStyle;
      }
      if (!labels[name]) {
        labels[name] = new Text({
          font: `italic ${labelFont} ${LABEL_FONT_FAMILY}`,
          fill: new Fill({ color: WATER_LABEL_COLOR }),
          stroke: new Stroke({
            color: 'rgba(255, 255, 255, 0.9)',
            width: 3
          }),
          text: name,
          // Solo se escribe en los tramos donde el nombre cabe completo, sin salirse del cauce
          overflow: false,
          placement: 'line',
          maxAngle: WATER_LABEL_MAX_ANGLE
        });
      }
      return [lineStyle, new Style({ geometry: simplifyForLabel(feature, resolution), text: labels[name] })];
    },
    properties: {
      title: title
    },
    minZoom: 11.5 - ZOOM_EPSILON, // Muestra las capas de agua solo si el zoom es 11.5 o mayor
    declutter: LABEL_DECLUTTER_GROUP
  });
};

// Crea todas las capas del mapa (se llama al montar el componente para no compartir capas entre mapas)
const createLayers = () => {
  const conflictoSymbol = createCircleSymbol('conflicto', 'red', 'white');
  const batallaSymbol = createIconSymbol('batalla');
  const sitioArqueologicoSymbol = createIconSymbol('sitio_arqueologico');
  const relevanciaHistoricaSymbol = createIconSymbol('relevancia_historica');
  const reweSymbol = createIconSymbol('rewe');
  const resignificacionSymbol = createCircleSymbol('resignificacion', 'purple', 'white');

  const conflictosLayer = createPointLayer('/geojson/Conflictos.geojson', 'Conflictos Socio-Ambientales',
    'Conflicto socioambiental', () => conflictoSymbol);

  // Los puntos históricos no traen una columna de tipo, así que el símbolo se elige por el nombre
  const puntosHistoricosLayer = createPointLayer('/geojson/Puntos_Historicos.geojson', 'Puntos Historicos',
    'Punto histórico', (feature) => {
      const name = String(feature.get('Name') || '');
      if (/batalla/i.test(name)) {
        return batallaSymbol;
      }
      if (/conchal|petroglifo|chemamul/i.test(name)) {
        return sitioArqueologicoSymbol;
      }
      return relevanciaHistoricaSymbol;
    });

  const puntosResignificacionLayer = createPointLayer('/geojson/Puntos_Resignificacion.geojson', 'Puntos de Resignificación',
    'Resignificación cultural', (feature) => /rewe/i.test(String(feature.get('PopupInfo') || '')) ? reweSymbol : resignificacionSymbol);

  const esterosLayer = createWaterLayer('esteros', '#6dceff', 'Esteros', '13px');
  const riosLayer = createWaterLayer('rios', '#6dceff', 'Ríos', '600 15px');
  const quebradasLayer = createWaterLayer('quebradas', '#6dceff', 'Quebradas', '12px');

  // Cordillera de Nawelfuta: pintura sobre el relieve y nombre en la cumbre (ver Nawelfuta.ts)
  const nawelfuta = crearCapasNawelfuta();

  const provConceLayer = createGeoServerLayer('prov_conce', new Style({
    stroke: new Stroke({
      color: '#8B4513',
      width: 1,
      lineDash: [5, 5]
    })
  }), 'Límite Provincial');

  const toponimosLayer = new VectorLayer({
    source: new VectorSource({
      url: '/geojson/Toponimos.geojson', // URL del archivo GeoJSON
      format: new GeoJSON()
    }),
    style: createCachedStyleFunction(
      (feature) => feature.get('Name'),
      (text) => new Style({
        text: new Text({
          font: `bold 16px ${LABEL_FONT_FAMILY}`, // Fuente en negritas y tamaño de 16px
          fill: new Fill({ color: '#000' }), // Color del texto
          stroke: new Stroke({
            color: '#fff', // Color del borde del texto
            width: 3 // Grosor del borde del texto
          }),
          text: text, // Texto que se mostrará en el mapa
          overflow: true, // Permitir que el texto se desborde si es necesario
          placement: 'point', // Colocación del texto: en el punto del feature
          textAlign: 'center', // Alineación del texto: centrado
          declutterMode: 'obstacle' // Los topónimos siempre se dibujan; las demás etiquetas los esquivan
        })
      })
    ),
    properties: {
      title: 'Toponimia'
    },
    minZoom: 10.5 - ZOOM_EPSILON, // Muestra la capa de Toponimia si el zoom es 10.5 o mayor
    declutter: LABEL_DECLUTTER_GROUP,
    ...REDRAW_WHILE_MOVING
  });

  return [
    new LayerGroup({
      properties: { title: 'Mapa Base' },
      layers: [
        new TileLayer({
          source: new TileImage({
            // @2x devuelve teselas de 512px, que es lo que espera tilePixelRatio: 2
            url: `https://api.mapbox.com/styles/v1/alejandro00bustos/clv9300mb03go01nugjw2heg1/tiles/256/{z}/{x}/{y}@2x?access_token=${MAPBOX_TOKEN}`,
            tilePixelRatio: 2
          }),
          properties: { title: 'Mapbox' }
        })
      ]
    }),
    new LayerGroup({
      properties: { title: 'Capas' },
      layers: [
        conflictosLayer,
        puntosHistoricosLayer,
        puntosResignificacionLayer,
        esterosLayer,
        nawelfuta.pintura,
        provConceLayer,
        quebradasLayer,
        riosLayer,
        toponimosLayer,
        nawelfuta.nombre // Arriba de todo, para que ninguna capa tape el nombre de la cordillera
      ]
    })
  ];
};

// Componente del mapa
const MapComponent = () => {
  const mapRef = useRef<Map | null>(null); // Referencia al mapa
  const compassRef = useRef<HTMLButtonElement>(null); // Referencia a la brújula
  // Arrastre en curso sobre la brújula: último ángulo del puntero y si ya giró el mapa
  const compassDragRef = useRef<{ pointerId: number; lastAngle: number; dragged: boolean } | null>(null);
  const suppressCompassClickRef = useRef(false); // Evita que soltar tras arrastrar cuente como clic
  const compassKeyTargetRef = useRef(INITIAL_ROTATION); // Rotación a la que va el giro con las flechas
  const popupOverlayRef = useRef<Overlay | null>(null); // Referencia al overlay del popup
  const [popupElement] = useState(() => {
    const element = document.createElement('div'); // Contenedor que OpenLayers posiciona sobre el mapa
    element.className = 'ol-popup';
    return element;
  });
  const [selectedFeature, setSelectedFeature] = useState<SelectedFeature | null>(null); // Punto cuyo popup está abierto

  useEffect(() => {
    const map = new Map({
      target: 'map', // ID del elemento DOM donde se renderizará el mapa
      layers: createLayers(),
      view: new View({
        center: fromLonLat([-73.044, -36.826]), // Centro inicial del mapa
        zoom: 10.5, // Nivel de zoom inicial
        rotation: INITIAL_ROTATION // Rotación inicial del mapa
      }),
      controls: defaultControls({ zoom: false, rotate: false }).extend([
        new ScaleLine({
          units: 'metric' // Añade una barra de escala métrica
        }),
      ])
    });
    mapRef.current = map;

    // Baja la densidad mientras el mapa se mueve (arrastre, zoom, giro o animación)
    map.on('movestart', () => map.setPixelRatio(Math.min(window.devicePixelRatio, MOVING_PIXEL_RATIO)));
    map.on('moveend', () => map.setPixelRatio(window.devicePixelRatio));

    // Selector de capas con su leyenda; los símbolos reproducen cómo se dibuja cada capa
    map.addControl(new SelectorCapas({
      titulo: 'Capas',
      grupos: [
        {
          titulo: 'Territorio',
          capas: [
            { capa: findLayer(map, 'Toponimia'), nombre: 'Toponimia', simbolo: { tipo: 'texto', color: '#000' } },
            { capa: findLayer(map, 'Límite Provincial'), nombre: 'Límite provincial', simbolo: { tipo: 'linea', color: '#8B4513', ancho: 1.5, guiones: '3 2' } },
            { capa: findLayer(map, TITULO_NAWELFUTA), nombre: 'Cordillera de Nawelfuta', simbolo: { tipo: 'area', relleno: COLOR_NAWELFUTA, borde: '#6E823C' } }
          ]
        },
        {
          titulo: 'Hidrografía',
          capas: [
            { capa: findLayer(map, 'Ríos'), nombre: 'Ríos', simbolo: { tipo: 'onda', color: '#6dceff', ancho: 2 } },
            { capa: findLayer(map, 'Esteros'), nombre: 'Esteros', simbolo: { tipo: 'onda', color: '#6dceff', ancho: 2 } },
            { capa: findLayer(map, 'Quebradas'), nombre: 'Quebradas', simbolo: { tipo: 'onda', color: '#6dceff', ancho: 2 } }
          ]
        },
        {
          titulo: 'Puntos de interés',
          chips: 'capas', // En celular, un chip por capa en vez de uno por grupo
          capas: [
            {
              capa: findLayer(map, 'Puntos de Resignificación'),
              nombre: 'Puntos de resignificación', nombreCorto: 'Resignificación',
              simbolo: { tipo: 'icono', src: '/simbologia/rewe.png' },
              leyenda: [
                { icono: '/simbologia/rewe.png', texto: 'Rewe' },
                { simbolo: { tipo: 'punto', color: 'purple' }, texto: 'Otra resignificación' }
              ]
            },
            {
              capa: findLayer(map, 'Puntos Historicos'),
              nombre: 'Puntos históricos', nombreCorto: 'Históricos',
              simbolo: { tipo: 'icono', src: '/simbologia/relevancia_historica.png' },
              leyenda: [
                { icono: '/simbologia/batalla.png', texto: 'Batalla' },
                { icono: '/simbologia/relevancia_historica.png', texto: 'Relevancia histórica' },
                { icono: '/simbologia/sitio_arqueologico.png', texto: 'Sitio arqueológico / conchal' }
              ]
            },
            {
              capa: findLayer(map, 'Conflictos Socio-Ambientales'),
              nombre: 'Conflictos socioambientales', nombreCorto: 'Conflictos',
              simbolo: { tipo: 'punto', color: 'red' }
            }
          ]
        }
      ]
    }));

    // Barrido de la cordillera: empieza cuando llega el contorno y se repite al volver a encender la capa
    const pinturaNawelfuta = findLayer(map, TITULO_NAWELFUTA) as VectorLayer | null;
    const nombreNawelfuta = findLayer(map, TITULO_NOMBRE_NAWELFUTA) as VectorLayer | null;
    const barridoNawelfuta = pinturaNawelfuta && nombreNawelfuta ? new BarridoNawelfuta(map, pinturaNawelfuta, nombreNawelfuta) : null;
    pinturaNawelfuta?.getSource()?.once('featuresloadend', () => barridoNawelfuta?.iniciar());

    // Popup con la información de los puntos
    const popupOverlay = new Overlay({
      element: popupElement,
      className: 'ol-overlay-container ol-selectable popup-overlay', // popup-overlay lo deja sobre el selector de capas
      autoPan: { animation: { duration: 250 } } // Desplaza el mapa si el popup queda fuera de la vista
    });
    map.addOverlay(popupOverlay);
    // OpenLayers fija z-index 0 en el contenedor de overlays y controles; se sube por encima
    // del logo y la brújula (z-index 1000) para que no tapen el popup
    const overlayContainer = map.getOverlayContainerStopEvent();
    if (overlayContainer) {
      overlayContainer.style.zIndex = '1100';
    }
    popupOverlayRef.current = popupOverlay;

    const closePopup = () => setSelectedFeature(null);

    // Al hacer clic en un punto se abre su popup; al hacer clic fuera, se cierra
    map.on('singleclick', (event) => {
      // Se queda con el primer punto encontrado
      const hit = map.forEachFeatureAtPixel(event.pixel, (feature, layer) => ({ feature, layer }),
        { layerFilter: isPopupLayer, hitTolerance: POPUP_HIT_TOLERANCE });

      if (hit) {
        const geometry = hit.feature.getGeometry();
        setSelectedFeature({
          properties: hit.feature.getProperties(),
          category: hit.layer.get('popupCategory'),
          coordinate: geometry instanceof Point ? geometry.getCoordinates() : event.coordinate
        });
      } else {
        closePopup();
      }
    });

    // Cambia el cursor al pasar sobre un punto con popup
    map.on('pointermove', (event) => {
      if (event.dragging) {
        return;
      }
      const overPoint = map.hasFeatureAtPixel(event.pixel, { layerFilter: isPopupLayer, hitTolerance: POPUP_HIT_TOLERANCE });
      const target = map.getTargetElement();
      if (target) {
        target.style.cursor = overPoint ? 'pointer' : '';
      }
    });

    // La tecla Escape cierra el popup
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closePopup();
      }
    };
    document.addEventListener('keydown', handleKeyDown);

    // Actualizar la orientación de la brújula
    const updateCompass = () => {
      const rotation = map.getView().getRotation();
      if (!compassRef.current) {
        return;
      }
      compassRef.current.style.transform = 'rotate(' + (rotation + Math.PI / 2) + 'rad)'; // Ajustar la brújula para que apunte al este
    };
    map.getView().on('change:rotation', updateCompass);
    updateCompass(); // Orienta la brújula según la rotación inicial del mapa

    // Tutorial de bienvenida (textos propuestos por GRIUT; el mapudungun está por validar con las comunidades)
    const tutorial = new TutorialMapa({
      clave: TUTORIAL_KEY, // Cambia el sufijo de la clave para que todos lo vuelvan a ver
      alCerrar: () => barridoNawelfuta?.iniciar(), // El primer barrido quedó detrás del velo del tutorial
      pasos: [
        {
          saludo: 'Mari mari kom pu che',
          titulo: 'Bienvenida al mapa del territorio',
          texto: '<p>Recorre el territorio desde <i lang="arn">Lafkenmapu</i>, la costa, hasta <i lang="arn">Nawelfuta</i>, con sus nombres originales, sus <i lang="arn">rewe</i> y su memoria.</p>'
        },
        {
          titulo: 'Elige qué ver',
          texto: '<p>En <strong>Capas</strong> enciende o apaga ríos, esteros, límites y puntos de interés. Cada capa muestra su símbolo para reconocerla en el mapa.</p>',
          objetivo: '.sc-panel', // Escritorio: la tarjeta de capas
          objetivoMovil: '.sc-fab' // Celular: el botón de capas
        },
        {
          icono: '/simbologia/rewe.png',
          titulo: 'Puntos con historia',
          texto: '<p>Toca un punto para conocer su historia: <i lang="arn">rewe</i>, sitios arqueológicos, batallas y conflictos socioambientales del territorio.</p>'
        },
        {
          titulo: 'Los nombres del territorio',
          texto: '<p>Los lugares aparecen con su nombre en mapudungun: <i lang="arn">Peguko</i> (Penco), <i lang="arn">Tralkawenu</i> (Talcahuano), <i lang="arn">Fio-Fio Lewfu</i> (río Biobío).</p>'
        },
        {
          titulo: 'Orientarse con el meli witran mapu',
          texto: '<p>Las cuatro tierras indican la orientación: <i lang="arn">Puelmapu</i> al este, <i lang="arn">Pikunmapu</i> al norte, <i lang="arn">Willimapu</i> al sur y <i lang="arn">Lafkenmapu</i> al oeste, hacia el mar. Arrastra la brújula para girar el mapa.</p><p>Pewkallal, ¡buen recorrido!</p>',
          objetivo: '#compass'
        }
      ]
    });

    // Espera a que el mapa y el selector de capas estén dibujados para destacarlos
    const tutorialTimeout = setTimeout(() => tutorial.iniciar(), 1000);

    // Limpieza al desmontar el componente
    return () => {
      clearTimeout(tutorialTimeout);
      tutorial.destruir();
      barridoNawelfuta?.destruir();
      document.removeEventListener('keydown', handleKeyDown);
      map.setTarget(undefined);
      mapRef.current = null;
    };
  }, [popupElement]);

  // Posiciona el popup después de que React dibuje su contenido, para que el desplazamiento
  // automático del mapa (autoPan) use el tamaño real del popup
  useEffect(() => {
    popupOverlayRef.current?.setPosition(selectedFeature ? selectedFeature.coordinate : undefined);
  }, [selectedFeature]);

  const handleClosePopup = () => setSelectedFeature(null);

  // Gira el mapa hasta una rotación con animación, por el camino más corto
  const animateRotation = (target: number, duration = COMPASS_ANIMATION_MS) => {
    const view = mapRef.current?.getView();
    if (!view) {
      return;
    }
    view.cancelAnimations();
    const rotation = view.getRotation();
    view.animate({ rotation: rotation + normalizeAngle(target - rotation), duration });
  };

  // Al hacer clic en la brújula, alterna entre el este arriba (rotación inicial) y el norte arriba
  const handleCompassClick = () => {
    if (suppressCompassClickRef.current) {
      suppressCompassClickRef.current = false;
      return;
    }
    const view = mapRef.current?.getView();
    if (!view) {
      return;
    }
    const isEastUp = Math.abs(normalizeAngle(view.getRotation() - INITIAL_ROTATION)) < 0.01;
    animateRotation(isEastUp ? NORTH_ROTATION : INITIAL_ROTATION);
  };

  // Arrastrar la brújula gira el mapa siguiendo al puntero
  const handleCompassPointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) {
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId); // Sigue recibiendo el movimiento fuera de la brújula
    const view = mapRef.current?.getView();
    view?.cancelAnimations();
    // Marca el giro como una interacción, igual que arrastrar el mapa: OpenLayers dispara un solo
    // movestart/moveend para todo el giro y no redibuja las capas vectoriales en cada paso
    view?.beginInteraction();
    compassDragRef.current = {
      pointerId: event.pointerId,
      lastAngle: pointerAngle(event.currentTarget, event.clientX, event.clientY),
      dragged: false
    };
  };

  const handleCompassPointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = compassDragRef.current;
    const view = mapRef.current?.getView();
    if (!drag || drag.pointerId !== event.pointerId || !view) {
      return;
    }
    const angle = pointerAngle(event.currentTarget, event.clientX, event.clientY);
    // Se acumula el giro paso a paso para no saltar al cruzar los ±180°
    const delta = normalizeAngle(angle - drag.lastAngle);
    if (!drag.dragged && Math.abs(delta) < COMPASS_DRAG_THRESHOLD) {
      return;
    }
    drag.dragged = true;
    drag.lastAngle = angle;
    view.setRotation(view.getRotation() + delta);
  };

  const handleCompassPointerUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = compassDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }
    suppressCompassClickRef.current = drag.dragged;
    compassDragRef.current = null;
    mapRef.current?.getView().endInteraction();
  };

  // Con el teclado: las flechas giran el mapa e Inicio vuelve al este arriba
  const handleCompassKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    const view = mapRef.current?.getView();
    if (!view) {
      return;
    }
    const steps: Record<string, number> = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1 };
    if (event.key in steps) {
      event.preventDefault();
      // Parte de la rotación final de una animación en curso, para que pulsar seguido acumule el giro
      const target = (view.getAnimating() ? compassKeyTargetRef.current : view.getRotation()) + steps[event.key] * COMPASS_KEY_STEP;
      compassKeyTargetRef.current = target;
      view.cancelAnimations();
      view.animate({ rotation: target, duration: 150 });
    } else if (event.key === 'Home') {
      event.preventDefault();
      animateRotation(INITIAL_ROTATION);
    }
  };

  return (
    <div>
      <div id="map"></div>
      <button
        type="button"
        id="compass"
        className="compass"
        ref={compassRef}
        onClick={handleCompassClick}
        onPointerDown={handleCompassPointerDown}
        onPointerMove={handleCompassPointerMove}
        onPointerUp={handleCompassPointerUp}
        onPointerCancel={handleCompassPointerUp}
        onKeyDown={handleCompassKeyDown}
        aria-label="Brújula: arrastra o usa las flechas para girar el mapa; pulsa para alternar entre el este y el norte arriba"
        title="Arrastra para girar el mapa · clic: este / norte arriba"
      >
        <svg viewBox="0 0 200 200" aria-hidden="true">
          <image href={simboloBrujula} x="36" y="36" width="128" height="128" className="compass-simbolo" />
          {COMPASS_LABELS.map((label) => (
            <g key={label.id}>
              <path id={'compass-arco-' + label.id} d={label.d} fill="none" />
              <text className={'compass-nombre ' + (label.className ?? '')} textLength={label.length} lengthAdjust="spacingAndGlyphs">
                <textPath href={'#compass-arco-' + label.id} startOffset="50%" textAnchor="middle">{label.text}</textPath>
              </text>
            </g>
          ))}
        </svg>
      </button>
      <div className="griut-logo">
        <img src="logo01.png" alt="Logo GRIUT" />
        <div><b>Grupo de Estudios Interculturales<br />Urbanos y Territoriales</b></div>
      </div>
      {selectedFeature && createPortal(
        <FeaturePopup
          properties={selectedFeature.properties}
          category={selectedFeature.category}
          onClose={handleClosePopup}
        />,
        popupElement
      )}
    </div>
  );
};

export default MapComponent;
