import 'ol/ol.css'; // Importa los estilos básicos de OpenLayers
import 'ol-ext/dist/ol-ext.css'; // Importa los estilos adicionales de ol-ext
import React, { useState, useEffect, useRef } from 'react'; // Importa React y algunos hooks necesarios
import Map from 'ol/Map'; // Importa la clase Map de OpenLayers
import View from 'ol/View'; // Importa la clase View de OpenLayers
import LayerGroup from 'ol/layer/Group'; // Importa la clase LayerGroup de OpenLayers
import TileLayer from 'ol/layer/Tile'; // Importa la clase TileLayer de OpenLayers
import TileImage from 'ol/source/TileImage'; // Importa la clase TileImage de OpenLayers
import { fromLonLat } from 'ol/proj'; // Importa la función de proyección de coordenadas
import { defaults as defaultControls, ScaleLine, Rotate } from 'ol/control'; // Importa los controles por defecto y la barra de escala
import VectorLayer from 'ol/layer/Vector'; // Importa la clase VectorLayer de OpenLayers
import VectorSource from 'ol/source/Vector'; // Importa la clase VectorSource de OpenLayers
import GeoJSON from 'ol/format/GeoJSON'; // Importa el formato GeoJSON de OpenLayers
import { Style, Fill, Stroke, Circle as CircleStyle, Text } from 'ol/style'; // Importa las clases de estilos de OpenLayers
import LayerSwitcher from 'ol-ext/control/LayerSwitcher'; // Importa el control de capas de ol-ext

// Función para crear un estilo
const createStyle = (color, width) => new Style({
  stroke: new Stroke({
    color,
    width
  }),
  fill: new Fill({
    color: color
  })
});

const createGeoJsonLayer = (url, style, title, visible = true) => {
  const vectorSource = new VectorSource({
    url: url, // URL completa a S3
    format: new GeoJSON()
  });

  return new VectorLayer({
    source: vectorSource,
    style: (feature) => {
      const text = feature.get('Nombre') || feature.get('PopupInfo') || feature.get('Name');
      return new Style({
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
      });
    },
    properties: {
      title: title
    },
    visible: visible
  });
};

// Define las capas usando la función createGeoJsonLayer

// Capa de conflictos
const conflictosLayer = createGeoJsonLayer('https://geo-griut.s3.us-west-1.amazonaws.com/geojson/Conflictos.geojson', new Style({
  image: new CircleStyle({
    radius: 5,
    fill: new Fill({ color: 'red' }),
    stroke: new Stroke({ color: 'white', width: 1 })
  })
}), 'Conflictos Socio-Ambientales', false);

// Capa de puntos históricos
const puntosHistoricosLayer = createGeoJsonLayer('https://geo-griut.s3.us-west-1.amazonaws.comgeojson/Puntos_Historicos.geojson', new Style({
  image: new CircleStyle({
    radius: 5,
    fill: new Fill({ color: 'yellow' }),
    stroke: new Stroke({ color: 'black', width: 1 })
  })
}), 'Puntos Historicos', false);

// Capa de puntos de resignificación
const puntosResignificacionLayer = createGeoJsonLayer('https://geo-griut.s3.us-west-1.amazonaws.com/geojson/Puntos_Resignificacion.geojson', new Style({
  image: new CircleStyle({
    radius: 5,
    fill: new Fill({ color: 'purple' }),
    stroke: new Stroke({ color: 'white', width: 1 })
  })
}), 'Puntos de Resignificación', false);

// Función para crear capas de redes hídricas con un estilo específico
const createWaterLayer = (url, color, title) => {
  return new VectorLayer({
    source: new VectorSource({
      url,
      format: new GeoJSON()
    }),
    style: (feature) => {
      const text = feature.get('Nombre');
      return new Style({
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
      });
    },
    properties: {
      title: title
    }
  });
};

// Capas de redes hídricas
const esterosLayer = createWaterLayer('https://geo-griut.s3.us-west-1.amazonaws.com/geojson/Esteros.geojson', '#6dceff', 'Esteros');
const riosLayer = createWaterLayer('https://geo-griut.s3.us-west-1.amazonaws.com/geojson/Rios.geojson', '#6dceff', 'Ríos');
const quebradasLayer = createWaterLayer('https://geo-griut.s3.us-west-1.amazonaws.com/geojson/Quebradas.geojson', '#6dceff', 'Quebradas');

// Capa de Nahuelbuta con un estilo de texto grande, más separado y en forma de arco, activación a zoom 12
const nahuelbutaLayer = new VectorLayer({
  source: new VectorSource({
    url: 'https://geo-griut.s3.us-west-1.amazonaws.com/geojson/Nahuelbuta.geojson', // URL del archivo GeoJSON
    format: new GeoJSON()
  }),
  style: new Style({
    text: new Text({
      font: '90px Calibri,sans-serif', // Aumenta el tamaño de la fuente a 60px
      fill: new Fill({ color: 'green' }), // Color de relleno del texto
      stroke: new Stroke({
        color: 'white', // Color del borde del texto
        width: 3 // Grosor del borde del texto
      }),
      text: 'Nawelfuta', // Texto que se mostrará en el mapa
      overflow: true, // Permitir que el texto se desborde si es necesario
      placement: 'point', // Colocación del texto: en el punto del feature
      textAlign: 'center', // Alineación del texto: centrado
      baseline: 'middle', // Baseline del texto: medio
      rotation: -0.5, // Rotación del texto para crear efecto de arco
      offsetY: 0, // Desplazamiento vertical del texto
      letterSpacing: 100 // Espaciado entre letras
    })
  }),
  properties: {
    title: 'Nahuelbuta'
  },
  visible: false // Inicialmente no visible
});

// Capa de Provincia de Concepción con un estilo de línea punteada
const provConceLayer = createGeoJsonLayer('https://geo-griut.s3.us-west-1.amazonaws.com/geojson/Prov_Conce.geojson', new Style({
  stroke: new Stroke({
    color: '#8B4513',
    width: 1,
    lineDash: [5, 5]
  })
}), 'Límite Provincial');

// Capa de Topónimos
const toponimosLayer = new VectorLayer({
  source: new VectorSource({
    url: 'https://geo-griut.s3.us-west-1.amazonaws.com/geojson/Toponimos.geojson', // URL del archivo GeoJSON
    format: new GeoJSON()
  }),
  style: (feature) => {
    const text = feature.get('Name');
    return new Style({
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
    });
  },
  properties: {
    title: 'Toponimia'
  },
  visible: true // Inicialmente visible
});

// Componente del mapa
const MapComponent = () => {
  const mapRef = useRef(null); // Referencia al mapa
  const [layerVisibility, setLayerVisibility] = useState({
    conflictos: false,
    puntosHistoricos: false,
    puntosResignificacion: false
  }); // Estado de visibilidad de las capas
  const initialRotation = useRef(-2); // Rotación inicial del mapa

  // Función para alternar la visibilidad de las capas
  const toggleLayerVisibility = (layerKey) => {
    setLayerVisibility(prevState => ({
      ...prevState,
      [layerKey]: !prevState[layerKey]
    }));
  };

  useEffect(() => {
    if (!mapRef.current) {
      mapRef.current = new Map({
        target: 'map', // ID del elemento DOM donde se renderizará el mapa
        layers: [
          new LayerGroup({
            title: 'Mapa Base',
            layers: [
              new TileLayer({
                source: new TileImage({
                  url: 'https://api.mapbox.com/styles/v1/alejandro00bustos/clv9300mb03go01nugjw2heg1/tiles/256/{z}/{x}/{y}?access_token=pk.eyJ1IjoiYWxlamFuZHJvMDBidXN0b3MiLCJhIjoiY2xmeXE0MW14MGJqNDNmczE2MHhkeGU1cSJ9.atA_HPcGYF4yYvxU-BwVjw',
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
        ],
        view: new View({
          center: fromLonLat([-73.044, -36.826]), // Centro inicial del mapa
          zoom: 10.5, // Nivel de zoom inicial
          rotation: initialRotation.current // Rotación inicial del mapa
        }),
        controls: defaultControls().extend([
          new ScaleLine({
            units: 'metric' // Añade una barra de escala métrica
          }),
          new Rotate({
            autoHide: false, // Muestra siempre el botón de rotación
            label: 'R', // Etiqueta del botón de rotación
            tipLabel: 'Reset rotation', // Etiqueta del tooltip del botón de rotación
            resetNorth: () => {
              const currentRotation = mapRef.current.getView().getRotation();
              if (currentRotation !== initialRotation.current) {
                mapRef.current.getView().setRotation(initialRotation.current);
              } else {
                mapRef.current.getView().setRotation(0);
              }
            }
          })
        ])
      });

      // Añadir el control de capas (LayerSwitcher)
      const layerSwitcher = new LayerSwitcher({
        activationMode: 'click', // Modo de activación por clic
        startActive: false, // No empieza activo
        tipLabel: 'Leyenda', // Etiqueta del botón de la leyenda
        groupSelectStyle: 'none', // Estilo de selección de grupo sin controles de opacidad
        collapseTipLabel: 'Ocultar leyenda' // Etiqueta del botón para ocultar la leyenda
      });
      layerSwitcher.element.style.right = '10px'; // Ajusta la posición del control de capas
      layerSwitcher.element.style.top = '50%'; // Ajusta la posición del control de capas
      layerSwitcher.element.style.transform = 'translateY(-50%)'; // Centra verticalmente el control de capas

      mapRef.current.addControl(layerSwitcher); // Añade el control de capas al mapa

    // Añadir la imagen en la esquina superior izquierda
const imgContainer = document.createElement('div');
imgContainer.style.position = 'absolute';
imgContainer.style.top = '9px'; // Deja margen para los botones de zoom
imgContainer.style.left = '50px';
imgContainer.style.zIndex = '1000'; // Asegúrate de que esté por encima del mapa
imgContainer.style.display = 'flex';
imgContainer.style.alignItems = 'center';

const img = document.createElement('img');
img.src = 'rvm.png';
img.style.width = '50px'; // Tamaño por defecto para dispositivos móviles
img.style.height = 'auto'; // Mantén la proporción de la imagen

// Ajusta el tamaño para vista de escritorio
const mediaQueryImg = window.matchMedia('(min-width: 768px)');
const handleMediaQueryChangeImg = (e) => {
  if (e.matches) {
    img.style.width = '160px'; // Tamaño para vista de escritorio
  } else {
    img.style.width = '60px'; // Tamaño para dispositivos móviles
  }
};
mediaQueryImg.addListener(handleMediaQueryChangeImg);
handleMediaQueryChangeImg(mediaQueryImg);

imgContainer.appendChild(img);
document.getElementById('map').appendChild(imgContainer); // Añade el contenedor de la imagen al mapa


     // Añadir el logo de GRIUT con texto
const logoContainer = document.createElement('div');
logoContainer.style.position = 'absolute';
logoContainer.style.top = '9px'; // Deja margen para los botones de zoom
logoContainer.style.right = '50px';
logoContainer.style.zIndex = '1000'; // Asegúrate de que esté por encima del mapa
logoContainer.style.display = 'flex';
logoContainer.style.alignItems = 'center';

const griutLogo = document.createElement('img');
griutLogo.src = 'logo01.png'; // Ruta al logo de GRIUT
griutLogo.style.width = '50px'; // Tamaño por defecto para dispositivos móviles
griutLogo.style.height = 'auto'; // Mantén la proporción de la imagen

const griutText = document.createElement('div');
griutText.innerHTML = '<b>Grupo de Estudios Interculturales<br>Urbanos y Territoriales</b>'; // Añade el salto de línea usando <br> y pone el texto en negrita usando <b>
griutText.style.fontSize = '11px'; // Tamaño por defecto para dispositivos móviles
griutText.style.color = 'black'; // Color del texto
griutText.style.marginLeft = '5px'; // Añade un margen a la izquierda del texto

// Ajusta el tamaño para vista de escritorio
const mediaQuery = window.matchMedia('(min-width: 768px)');
const handleMediaQueryChange = (e) => {
  if (e.matches) {
    griutLogo.style.width = '120px'; // Tamaño para vista de escritorio
    griutText.style.fontSize = '20px'; // Tamaño del texto para vista de escritorio
  } else {
    griutLogo.style.width = '60px'; // Tamaño para dispositivos móviles
    griutText.style.fontSize = '11px'; // Tamaño del texto para dispositivos móviles
  }
};
mediaQuery.addListener(handleMediaQueryChange);
handleMediaQueryChange(mediaQuery);

logoContainer.appendChild(griutLogo);
logoContainer.appendChild(griutText);
document.getElementById('map').appendChild(logoContainer); // Añade el contenedor del logo al mapa


      // Función para manejar cambios en el nivel de zoom
      const handleZoomChange = () => {
        const zoom = mapRef.current.getView().getZoom();
        const showWaterLayers = zoom >= 11.5; // Muestra las capas de agua solo si el zoom es 14 o mayor
        const showNahuelbutaLayer = zoom >= 11; // Muestra la capa de Nahuelbuta si el zoom es 12 o mayor
        const showToponimosLayer = zoom >= 10.5; // Muestra la capa de Toponimia si el zoom es 10.5 o mayor

        esterosLayer.setVisible(showWaterLayers);
        riosLayer.setVisible(showWaterLayers);
        quebradasLayer.setVisible(showWaterLayers);
        nahuelbutaLayer.setVisible(showNahuelbutaLayer); // Activa la capa de Nahuelbuta a zoom 12
        toponimosLayer.setVisible(showToponimosLayer); // Activa la capa de Toponimia a zoom 10.5
      };

      mapRef.current.getView().on('change:resolution', handleZoomChange); // Añade el listener para cambios de resolución
      handleZoomChange(); // Ajusta la visibilidad inicial basada en el nivel de zoom inicial

      // Actualizar la visibilidad de las capas según el estado
      mapRef.current.getLayers().forEach(group => {
        if (group instanceof LayerGroup) {
          group.getLayers().forEach(layer => {
            const title = layer.get('title');
            if (title) {
              const layerKey = title.toLowerCase();
              if (layerVisibility[layerKey] !== undefined) {
                layer.setVisible(layerVisibility[layerKey]);
              }
            }
          });
        }
      });

    }
  }, [layerVisibility]);

  return (
    <div>
      <div id="map" style={{ width: '100%', height: '100vh' }}></div>
    </div>
  );
};

export default MapComponent;
