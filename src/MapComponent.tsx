import 'ol/ol.css'; // Importa los estilos básicos de OpenLayers
import 'ol-ext/dist/ol-ext.css'; // Importa los estilos adicionales de ol-ext
import { useEffect, useRef, useState } from 'react'; // Importa los hooks de React necesarios
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
import { Style, Fill, Stroke, Circle as CircleStyle, Icon, Text } from 'ol/style'; // Importa las clases de estilos de OpenLayers
import type ImageStyle from 'ol/style/Image';
import Point from 'ol/geom/Point';
import type BaseLayer from 'ol/layer/Base';
import type { FeatureLike } from 'ol/Feature';
import type { Coordinate } from 'ol/coordinate';
import LayerSwitcher from 'ol-ext/control/LayerSwitcher'; // Importa el control de capas de ol-ext
import './css/compass.css'; // Importa los estilos de la brújula desde src/css
import './css/logo.css'; // Importa los estilos del logo de GRIUT
import './css/popup.css'; // Importa los estilos del popup de los puntos
import 'intro.js/introjs.css';
import './css/tutorial.css'; // Ajustes de estilo del tutorial
import introJs from 'intro.js'; // Importa introJs como exportación por defecto
import FeaturePopup from './FeaturePopup';

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

const INITIAL_ROTATION = -2; // Rotación inicial del mapa

// Las capas con etiquetas se depuran juntas: si dos etiquetas chocan, solo se dibuja la de la capa
// más arriba en la leyenda (o la primera dentro de la misma capa)
const LABEL_DECLUTTER_GROUP = 'etiquetas';

// Tolerancia en píxeles para hacer clic sobre un punto (facilita el uso en pantallas táctiles)
const POPUP_HIT_TOLERANCE = 6;

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
  font: '16px Calibri,sans-serif',
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

// Función para crear capas GeoJSON con estilos personalizados
const createGeoJsonLayer = (url: string, style: Style, title: string, visible = true) => new VectorLayer({
  source: new VectorSource({
    url: url,
    format: new GeoJSON()
  }),
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
    declutter: LABEL_DECLUTTER_GROUP
  });
};

const createWaterLayer = (url: string, color: string, title: string) => new VectorLayer({
  source: new VectorSource({
    url,
    format: new GeoJSON()
  }),
  style: createCachedStyleFunction(
    (feature) => feature.get('Nombre'),
    (text) => new Style({
      stroke: new Stroke({
        color: color,
        width: 2
      }),
      text: new Text({
        font: 'italic 14px Calibri,sans-serif',
        fill: new Fill({ color: color }),
        stroke: new Stroke({
          color: '#ffffff',
          width: 2
        }),
        text: text,
        overflow: true,
        placement: 'line'
      })
    })
  ),
  properties: {
    title: title
  },
  minZoom: 11.5 - ZOOM_EPSILON, // Muestra las capas de agua solo si el zoom es 11.5 o mayor
  declutter: LABEL_DECLUTTER_GROUP
});

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

  const esterosLayer = createWaterLayer('/geojson/Esteros.geojson', '#6dceff', 'Esteros');
  const riosLayer = createWaterLayer('/geojson/Rios.geojson', '#6dceff', 'Ríos');
  const quebradasLayer = createWaterLayer('/geojson/Quebradas.geojson', '#6dceff', 'Quebradas');

  const nahuelbutaLayer = new VectorLayer({
    source: new VectorSource({
      url: '/geojson/Nahuelbuta.geojson', // URL del archivo GeoJSON
      format: new GeoJSON()
    }),
    style: createCachedStyleFunction(
      (feature) => feature.get('Nombre') || 'Nawelfuta', // Obtener el texto de la característica o usar un valor predeterminado
      (text) => new Style({
        text: new Text({
          font: '90px Calibri,sans-serif', // Tamaño de la fuente
          fill: new Fill({ color: 'green' }), // Color de relleno del texto
          stroke: new Stroke({
            color: 'white', // Color del borde del texto
            width: 3 // Grosor del borde del texto
          }),
          text: text, // Texto que se mostrará en el mapa
          overflow: true, // Permitir que el texto se desborde si es necesario
          placement: 'point', // Colocación del texto: en el punto del feature
          textAlign: 'center', // Alineación del texto: centrado
          textBaseline: 'middle', // Baseline del texto: medio
          rotation: -0.5, // Rotación del texto para crear efecto de arco
          offsetY: 0 // Desplazamiento vertical del texto
        })
      })
    ),
    properties: {
      title: 'Nahuelbuta'
    },
    minZoom: 11 - ZOOM_EPSILON // Muestra la capa de Nahuelbuta si el zoom es 11 o mayor
  });

  const provConceLayer = createGeoJsonLayer('/geojson/Prov_Conce.geojson', new Style({
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
          font: 'bold 16px Calibri,sans-serif', // Fuente en negritas y tamaño de 16px
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
    declutter: LABEL_DECLUTTER_GROUP
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
        nahuelbutaLayer,
        provConceLayer,
        quebradasLayer,
        riosLayer,
        toponimosLayer
      ]
    })
  ];
};

// Componente del mapa
const MapComponent = () => {
  const mapRef = useRef<Map | null>(null); // Referencia al mapa
  const compassRef = useRef<HTMLButtonElement>(null); // Referencia a la brújula
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

    // Añadir el control de capas (LayerSwitcher)
    const layerSwitcher = new LayerSwitcher({
      activationMode: 'click', // Modo de activación por clic
      startActive: false, // No empieza activo
      tipLabel: 'Leyenda', // Etiqueta del botón de la leyenda
      groupSelectStyle: 'none', // Estilo de selección de grupo sin controles de opacidad
      collapseTipLabel: 'Ocultar leyenda' // Etiqueta del botón para ocultar la leyenda
    });
    layerSwitcher.element.id = 'layer-switcher'; // Añade un id al control de capas
    layerSwitcher.element.style.right = '10px'; // Ajusta la posición del control de capas
    layerSwitcher.element.style.top = '50%'; // Ajusta la posición del control de capas
    layerSwitcher.element.style.transform = 'translateY(-50%)'; // Centra verticalmente el control de capas
    map.addControl(layerSwitcher); // Añade el control de capas al mapa

    // Popup con la información de los puntos
    const popupOverlay = new Overlay({
      element: popupElement,
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

    // Configurar intro.js para el tutorial
    const intro = introJs();
    intro.setOptions({
      steps: [
        {
          intro: "Bienvenido a Geo-GRIUT, nuestro visualizador de mapas interactivo. Vamos a guiarte a través de las funcionalidades básicas."
        },
        {
          element: document.querySelector('#map'),
          intro: "Este  mapa  puedes interactuar con diferentes capas y ver información geográfica...",
          position: 'bottom'
        },
        {
          element: document.querySelector('.compass'),
          intro: "Esta es la brújula. Te muestra la orientación actual del mapa. Haz clic en ella para restablecer la orientación.",
          position: 'right'
        },
        {
          element: document.querySelector('#layer-switcher'),
          intro: "Este es el control de capas. Puedes usarlo para alternar la visibilidad de las diferentes capas del mapa. Haz clic en un punto de conflicto, histórico o de resignificación para ver su información.",
          position: 'left'
        },
        {
          intro: "<input type='checkbox' id='dont-show-again'> No volver a mostrar.             Página en Desarrollo 🦖",
          position: 'bottom'
        }
      ],
      showStepNumbers: false,
      showProgress: true,
      scrollToElement: true,
      disableInteraction: true,
      hideNext: false,
      hidePrev: false,
      exitOnOverlayClick: false,
      exitOnEsc: true,
      overlayOpacity: 0.6,
      keyboardNavigation: true,
      doneLabel: 'Listo',
      nextLabel: 'Siguiente',
      prevLabel: 'Anterior',
      skipLabel: 'Saltar',
      scrollTo: 'tooltip'
    });

    // Guardar la preferencia si el usuario marcó "No volver a mostrar"
    const saveIntroPreference = () => {
      const dontShowAgain = document.getElementById('dont-show-again') as HTMLInputElement | null;
      if (dontShowAgain?.checked) {
        localStorage.setItem('introShown', 'true');
      }
    };
    intro.oncomplete(saveIntroPreference);
    intro.onexit(saveIntroPreference);

    // Mostrar el tutorial solo si el usuario no ha marcado "No volver a mostrar"
    let introTimeout: ReturnType<typeof setTimeout> | undefined;
    if (!localStorage.getItem('introShown')) {
      introTimeout = setTimeout(() => {
        intro.start();
      }, 1000); // Ajusta el tiempo según sea necesario
    }

    // Limpieza al desmontar el componente
    return () => {
      clearTimeout(introTimeout);
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

  // Al hacer clic en la brújula, alterna entre la rotación inicial y el norte arriba
  const handleCompassClick = () => {
    if (!mapRef.current) {
      return;
    }
    const view = mapRef.current.getView();
    view.setRotation(view.getRotation() !== INITIAL_ROTATION ? INITIAL_ROTATION : 0);
  };

  return (
    <div>
      <div id="map" style={{ width: '100%', height: '100vh' }}></div>
      <button
        type="button"
        id="compass"
        className="compass"
        ref={compassRef}
        onClick={handleCompassClick}
        aria-label="Brújula: restablecer la orientación del mapa"
        title="Restablecer orientación"
      ></button>
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
