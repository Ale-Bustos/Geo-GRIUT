import 'ol/ol.css'; // Importa los estilos básicos de OpenLayers
import 'ol-ext/dist/ol-ext.css'; // Importa los estilos adicionales de ol-ext
import { useEffect, useRef } from 'react'; // Importa los hooks de React necesarios
import Map from 'ol/Map'; // Importa la clase Map de OpenLayers
import View from 'ol/View'; // Importa la clase View de OpenLayers
import LayerGroup from 'ol/layer/Group'; // Importa la clase LayerGroup de OpenLayers
import TileLayer from 'ol/layer/Tile'; // Importa la clase TileLayer de OpenLayers
import TileImage from 'ol/source/TileImage'; // Importa la clase TileImage de OpenLayers
import { fromLonLat } from 'ol/proj'; // Importa la función de proyección de coordenadas
import { defaults as defaultControls, ScaleLine } from 'ol/control'; // Importa los controles por defecto y la barra de escala
import VectorLayer from 'ol/layer/Vector'; // Importa la clase VectorLayer de OpenLayers
import VectorSource from 'ol/source/Vector'; // Importa la clase VectorSource de OpenLayers
import GeoJSON from 'ol/format/GeoJSON'; // Importa el formato GeoJSON de OpenLayers
import { Style, Fill, Stroke, Circle as CircleStyle, Text } from 'ol/style'; // Importa las clases de estilos de OpenLayers
import LayerSwitcher from 'ol-ext/control/LayerSwitcher'; // Importa el control de capas de ol-ext
import './css/compass.css'; // Importa los estilos de la brújula desde src/css
import './css/logo.css'; // Importa los estilos del logo de GRIUT
import 'intro.js/introjs.css';
import introJs from 'intro.js'; // Importa introJs como exportación por defecto

// minZoom de OpenLayers es exclusivo (zoom > minZoom); se resta un margen mínimo
// para que cada capa siga apareciendo desde el mismo nivel de zoom que antes (zoom >= umbral)
const ZOOM_EPSILON = 0.01;

const INITIAL_ROTATION = -2; // Rotación inicial del mapa

// Guarda en caché los estilos por texto: OpenLayers llama a la función de estilo
// en cada renderizado, así que crear estilos nuevos cada vez es costoso
const createCachedStyleFunction = (getText, buildStyle) => {
  const cache = {};
  return (feature) => {
    const text = getText(feature) || '';
    if (!cache[text]) {
      cache[text] = buildStyle(text);
    }
    return cache[text];
  };
};

// Función para crear capas GeoJSON con estilos personalizados
const createGeoJsonLayer = (url, style, title, visible = true) => new VectorLayer({
  source: new VectorSource({
    url: url,
    format: new GeoJSON()
  }),
  style: createCachedStyleFunction(
    (feature) => feature.get('Nombre') || feature.get('PopupInfo') || feature.get('Name'),
    (text) => new Style({
      stroke: style.getStroke(),
      fill: style.getFill(),
      image: style.getImage(),
      text: new Text({
        font: '16px Calibri,sans-serif',
        fill: new Fill({ color: '#000' }),
        stroke: new Stroke({
          color: '#fff',
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
  visible: visible
});

const createWaterLayer = (url, color, title) => new VectorLayer({
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
  minZoom: 11.5 - ZOOM_EPSILON // Muestra las capas de agua solo si el zoom es 11.5 o mayor
});

// Crea todas las capas del mapa (se llama al montar el componente para no compartir capas entre mapas)
const createLayers = () => {
  const conflictosLayer = createGeoJsonLayer('/geojson/Conflictos.geojson', new Style({
    image: new CircleStyle({
      radius: 5,
      fill: new Fill({ color: 'red' }),
      stroke: new Stroke({ color: 'white', width: 1 })
    })
  }), 'Conflictos Socio-Ambientales', false);

  const puntosHistoricosLayer = createGeoJsonLayer('/geojson/Puntos_Historicos.geojson', new Style({
    image: new CircleStyle({
      radius: 5,
      fill: new Fill({ color: 'yellow' }),
      stroke: new Stroke({ color: 'black', width: 1 })
    })
  }), 'Puntos Historicos', false);

  const puntosResignificacionLayer = createGeoJsonLayer('/geojson/Puntos_Resignificacion.geojson', new Style({
    image: new CircleStyle({
      radius: 5,
      fill: new Fill({ color: 'purple' }),
      stroke: new Stroke({ color: 'white', width: 1 })
    })
  }), 'Puntos de Resignificación', false);

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
          baseline: 'middle', // Baseline del texto: medio
          rotation: -0.5, // Rotación del texto para crear efecto de arco
          offsetY: 0, // Desplazamiento vertical del texto
          letterSpacing: 100 // Espaciado entre letras
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
          textAlign: 'center' // Alineación del texto: centrado
        })
      })
    ),
    properties: {
      title: 'Toponimia'
    },
    minZoom: 10.5 - ZOOM_EPSILON // Muestra la capa de Toponimia si el zoom es 10.5 o mayor
  });

  return [
    new LayerGroup({
      title: 'Mapa Base',
      layers: [
        new TileLayer({
          source: new TileImage({
            // @2x devuelve teselas de 512px, que es lo que espera tilePixelRatio: 2
            url: 'https://api.mapbox.com/styles/v1/alejandro00bustos/clv9300mb03go01nugjw2heg1/tiles/256/{z}/{x}/{y}@2x?access_token=pk.eyJ1IjoiYWxlamFuZHJvMDBidXN0b3MiLCJhIjoiY2xmeXE0MW14MGJqNDNmczE2MHhkeGU1cSJ9.atA_HPcGYF4yYvxU-BwVjw',
            tilePixelRatio: 2
          }),
          title: 'Mapbox'
        })
      ]
    }),
    new LayerGroup({
      title: 'Capas',
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
  const mapRef = useRef(null); // Referencia al mapa
  const compassRef = useRef(null); // Referencia a la brújula

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

    // Actualizar la orientación de la brújula
    const updateCompass = () => {
      const rotation = map.getView().getRotation();
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
          intro: "Este es el control de capas. Puedes usarlo para alternar la visibilidad de las diferentes capas del mapa.",
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
      const dontShowAgain = document.getElementById('dont-show-again');
      if (dontShowAgain && dontShowAgain.checked) {
        localStorage.setItem('introShown', 'true');
      }
    };
    intro.oncomplete(saveIntroPreference);
    intro.onexit(saveIntroPreference);

    // Mostrar el tutorial solo si el usuario no ha marcado "No volver a mostrar"
    let introTimeout;
    if (!localStorage.getItem('introShown')) {
      introTimeout = setTimeout(() => {
        intro.start();
      }, 1000); // Ajusta el tiempo según sea necesario
    }

    // Limpieza al desmontar el componente
    return () => {
      clearTimeout(introTimeout);
      map.setTarget(undefined);
      mapRef.current = null;
    };
  }, []);

  // Al hacer clic en la brújula, alterna entre la rotación inicial y el norte arriba
  const handleCompassClick = () => {
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
    </div>
  );
};

export default MapComponent;
