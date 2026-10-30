import 'ol/ol.css'; // Importa los estilos básicos de OpenLayers
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Map from 'ol/Map';
import View from 'ol/View';
import Overlay from 'ol/Overlay';
import { defaults as defaultControls, ScaleLine } from 'ol/control';
import type VectorLayer from 'ol/layer/Vector';
import Point from 'ol/geom/Point';
import type { Coordinate } from 'ol/coordinate';
import './css/logo.css'; // Estilos del logo de GRIUT
import './css/popup.css'; // Estilos del popup de los puntos
import './css/selector-capas.css'; // Estilos del selector de capas
import './css/tutorial-mapa.css'; // Estilos del tutorial
import { createLayers, findLayer, isPopupLayer } from './capas';
import { crearSelectorCapas } from './configSelector';
import { crearTutorial } from './configTutorial';
import { BarridoPinturas, NAWELFUTA, FIOFIO_LEWFU, ANCA_LIGHEN, tituloNombre } from './PinturaTerritorio';
import { CENTRO_INICIAL, ZOOM_INICIAL, INITIAL_ROTATION } from './vista';
import Brujula, { orientarBrujula } from './Brujula';
import FeaturePopup from './FeaturePopup';

// Punto del mapa cuyo popup está abierto
interface SelectedFeature {
  properties: Record<string, unknown>;
  category: string;
  coordinate: Coordinate;
}

// Densidad de píxeles con que se dibuja el mapa mientras se mueve. Pintar el canvas a la densidad
// de una pantalla de alta resolución es lo que más cuesta en cada cuadro; al detenerse el mapa
// vuelve a la densidad de la pantalla para que se vea nítido
const MOVING_PIXEL_RATIO = 1;

// Tolerancia en píxeles para hacer clic sobre un punto (facilita el uso en pantallas táctiles)
const POPUP_HIT_TOLERANCE = 6;

// Componente del mapa: crea el mapa y conecta capas, selector, pinturas, popup, tutorial y brújula
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
        center: CENTRO_INICIAL,
        zoom: ZOOM_INICIAL,
        rotation: INITIAL_ROTATION // El este (Puelmapu) queda arriba
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

    // Selector de capas con su leyenda (ver configSelector.ts)
    map.addControl(crearSelectorCapas(map));

    // Un solo controlador para todos los barridos; cada pintura empieza cuando llega su geometría
    // y se repite al volver a encender su capa
    const barridos = new BarridoPinturas(map);
    [NAWELFUTA, FIOFIO_LEWFU, ANCA_LIGHEN].forEach((def) => {
      const pintura = findLayer(map, def.titulo) as VectorLayer | null;
      const nombre = findLayer(map, tituloNombre(def)) as VectorLayer | null;
      if (!pintura || !nombre) return;
      barridos.registrar(def, pintura, nombre);
      pintura.getSource()?.once('featuresloadend', () => barridos.iniciar(pintura));
    });

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

    // La brújula sigue la rotación del mapa
    const updateCompass = () => orientarBrujula(compassRef.current, map.getView().getRotation());
    map.getView().on('change:rotation', updateCompass);
    updateCompass(); // Orienta la brújula según la rotación inicial del mapa

    // Tutorial de bienvenida (ver configTutorial.ts); los primeros barridos quedaron detrás de su velo
    const tutorial = crearTutorial(() => barridos.iniciar());
    // Espera a que el mapa y el selector de capas estén dibujados para destacarlos
    const tutorialTimeout = setTimeout(() => tutorial.iniciar(), 1000);

    // Limpieza al desmontar el componente
    return () => {
      clearTimeout(tutorialTimeout);
      tutorial.destruir();
      barridos.destruir();
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

  return (
    <div>
      <div id="map"></div>
      <Brujula ref={compassRef} mapRef={mapRef} />
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
