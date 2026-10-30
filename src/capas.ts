// Capas del mapa: mapa base, GeoServer (MVT), GeoJSON locales, población indígena y pinturas del territorio
import Map from 'ol/Map';
import LayerGroup from 'ol/layer/Group';
import TileLayer from 'ol/layer/Tile';
import TileImage from 'ol/source/TileImage';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import GeoJSON from 'ol/format/GeoJSON';
import VectorTileLayer from 'ol/layer/VectorTile';
import VectorTileSource from 'ol/source/VectorTile';
import MVT from 'ol/format/MVT'; // Formato Mapbox Vector Tile que entrega GeoServer
import RenderFeature from 'ol/render/Feature'; // Elementos livianos que entregan las teselas vectoriales
import MultiLineString from 'ol/geom/MultiLineString';
import { douglasPeuckerArray } from 'ol/geom/flat/simplify';
import { Style, Fill, Stroke, Circle as CircleStyle, Icon, Text } from 'ol/style';
import type ImageStyle from 'ol/style/Image';
import type BaseLayer from 'ol/layer/Base';
import type { FeatureLike } from 'ol/Feature';
import { crearPintura, NAWELFUTA, FIOFIO_LEWFU, ANCA_LIGHEN } from './PinturaTerritorio';

// Token público de Mapbox para el mapa base (ver .env.example)
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
if (!MAPBOX_TOKEN && import.meta.env.MODE !== 'test') {
  console.error('Falta VITE_MAPBOX_TOKEN: el mapa base de Mapbox no se cargará');
}

// minZoom de OpenLayers es exclusivo (zoom > minZoom); se resta un margen mínimo
// para que cada capa siga apareciendo desde el mismo nivel de zoom que antes (zoom >= umbral)
const ZOOM_EPSILON = 0.01;

// Las capas de puntos y nombres se redibujan también mientras el mapa se mueve. Si reutilizan el
// dibujo anterior, quedan con la densidad de la pantalla y, al bajar la densidad, los íconos y
// etiquetas se ven agrandados (3 veces en un celular de densidad 3). Son pocos elementos: es barato
const REDRAW_WHILE_MOVING = { updateWhileAnimating: true, updateWhileInteracting: true };

// Las capas con etiquetas se depuran juntas: si dos etiquetas chocan, solo se dibuja la de la capa
// más arriba en la leyenda (o la primera dentro de la misma capa)
const LABEL_DECLUTTER_GROUP = 'etiquetas';

// Fuentes de las etiquetas del mapa: las del sistema de cada dispositivo (Calibri solo existe en Windows)
const LABEL_FONT_FAMILY = '"Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

// Busca una capa por su título, también dentro de los grupos
export const findLayer = (map: Map, title: string) => {
  const layer = map.getAllLayers().find((candidate) => candidate.get('title') === title) ?? null;
  if (!layer) {
    console.warn('No se encontró la capa con título "' + title + '"');
  }
  return layer;
};

// Solo las capas con categoría de popup responden a los clics
export const isPopupLayer = (layer: BaseLayer) => Boolean(layer.get('popupCategory'));

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

// Nombres que ya van escritos en una pintura del territorio (PinturaTerritorio.ts): ni la capa de ríos
// ni la toponimia los repiten
const NOMBRES_PINTADOS = new Set(['Fio-Fio Lewfu', 'Anca-lighen', 'Río Andalien']);

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
      if (!name || NOMBRES_PINTADOS.has(name)) {
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

// Población indígena (Censo 2017): rampa secuencial de un solo tono, de claro a oscuro, en tierra
// para no confundirse con el azul del agua ni con el rojo de los conflictos
export const POBLACION_CLASES = [
  { hasta: 0, color: '#F3EEE6', texto: 'Sin población indígena' },
  { hasta: 5, color: '#F6E8C3', texto: 'Menos de 5 %' },
  { hasta: 10, color: '#DFC27D', texto: '5 a 10 %' },
  { hasta: 20, color: '#BF812D', texto: '10 a 20 %' },
  { hasta: Infinity, color: '#8C510A', texto: '20 % o más' }
];

const poblacionStyles = (borde: string) => {
  const stroke = new Stroke({ color: borde, width: 0.6 });
  return {
    clases: POBLACION_CLASES.map((clase) => new Style({ fill: new Fill({ color: clase.color }), stroke })),
    // Sin dato: solo el contorno
    sinDato: new Style({ stroke })
  };
};

// Capa de GeoServer con el porcentaje de población indígena de cada polígono (manzana o localidad)
const createPoblacionLayer = (layerName: string, title: string, popupCategory: string, borde: string, minZoom: number) => {
  const styles = poblacionStyles(borde);
  return new VectorTileLayer({
    source: createGeoServerTileSource(layerName),
    style: (feature) => {
      const value = feature.get('porc_indigena');
      if (value === null || value === undefined) {
        return styles.sinDato;
      }
      const index = POBLACION_CLASES.findIndex((clase) => Number(value) <= clase.hasta);
      return styles.clases[index === -1 ? POBLACION_CLASES.length - 1 : index];
    },
    opacity: 0.7, // Deja ver el mapa base y los nombres debajo
    properties: { title, popupCategory },
    visible: false,
    minZoom: minZoom - ZOOM_EPSILON
  });
};

// Crea todas las capas del mapa (se llama al montar el componente para no compartir capas entre mapas)
export const createLayers = () => {
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

  // Las manzanas son chicas: se muestran desde el zoom 12; las localidades rurales, desde el 10
  const poblacionManzanasLayer = createPoblacionLayer('poblacion_indigena_mz', 'Población indígena por manzana',
    'Población indígena · manzana', 'rgba(255, 255, 255, 0.6)', 12);
  const poblacionLocalidadesLayer = createPoblacionLayer('poblacion_indigena_loc', 'Población indígena por localidad',
    'Población indígena · localidad rural', 'rgba(84, 48, 5, 0.6)', 10);

  const esterosLayer = createWaterLayer('esteros', '#6dceff', 'Esteros', '13px');
  const riosLayer = createWaterLayer('rios', '#6dceff', 'Ríos', '600 15px');
  const quebradasLayer = createWaterLayer('quebradas', '#6dceff', 'Quebradas', '12px');

  // Cordillera de Nawelfuta y río Fio-Fio Lewfu: pintura sobre el relieve y nombre en la cumbre
  // o el cauce (ver PinturaTerritorio.ts)
  const nawelfuta = crearPintura(NAWELFUTA);
  const fiofio = crearPintura(FIOFIO_LEWFU);
  const ancaLighen = crearPintura(ANCA_LIGHEN);

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
      (feature) => (NOMBRES_PINTADOS.has(feature.get('Name')) ? undefined : feature.get('Name')),
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
        // Primero (abajo de todo) los polígonos de población, para no tapar ríos, nombres ni puntos
        poblacionLocalidadesLayer,
        poblacionManzanasLayer,
        conflictosLayer,
        puntosHistoricosLayer,
        puntosResignificacionLayer,
        esterosLayer,
        nawelfuta.pintura,
        fiofio.pintura,
        ancaLighen.pintura,
        provConceLayer,
        quebradasLayer,
        riosLayer,
        toponimosLayer,
        // Arriba de todo, para que ninguna capa tape los nombres de la cordillera y del río
        nawelfuta.nombre,
        fiofio.nombre,
        ancaLighen.nombre
      ]
    })
  ];
};
