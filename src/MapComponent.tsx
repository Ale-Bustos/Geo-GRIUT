import 'ol/ol.css'; // Importa los estilos básicos de OpenLayers
import { useEffect, useRef, useState } from 'react';
import Map from 'ol/Map';
import View from 'ol/View';
import { defaults as defaultControls, ScaleLine } from 'ol/control';
import type VectorLayer from 'ol/layer/Vector';
import { fromLonLat } from 'ol/proj';
import Point from 'ol/geom/Point';
import type { Coordinate } from 'ol/coordinate';
import './css/logo.css'; // Estilos del logo de GRIUT
import './css/relieve.css'; // Mezcla del relieve sombreado
import './css/ficha-lugar.css'; // Ficha de los lugares
import './css/selector-capas.css'; // Estilos del selector de capas
import './css/tutorial-mapa.css'; // Estilos del tutorial
import './css/recorrido.css'; // Botón y tarjeta del recorrido guiado
import { capaLugarDe, createLayers, findLayer, isPopupLayer } from './capas';
import { crearSelectorCapas } from './configSelector';
import { crearTutorial } from './configTutorial';
import Recorrido from './Recorrido';
import { RECORRIDO_TERRITORIO } from './configRecorrido';
import { BarridoPinturas, NAWELFUTA, FIOFIO_LEWFU, ANCA_LIGHEN, tituloNombre } from './PinturaTerritorio';
import { CENTRO_INICIAL, ZOOM_INICIAL, INITIAL_ROTATION, centroPara, zonaLibre } from './vista';
import Brujula, { orientarBrujula } from './Brujula';
import { conectarRelieve, esPantallaCompacta, TITULO_RELIEVE } from './relieve';
import { contadorFpsActivo, crearContadorFps } from './contadorFps';
import type WebGLTileLayer from 'ol/layer/WebGLTile';
import FichaLugar from './FichaLugar';
import Buscador from './Buscador';
import type { ResultadoBusqueda } from './api';
import { CAPAS_LUGAR, buscarLugar, claveLugar, escribirLugarUrl, esCapaLugar, leerClaveLugar, leerLugarUrl, type RefLugar } from './lugares';

// Elemento del mapa cuya ficha está abierta; lugar solo en los puntos con id (ver lugares.ts)
interface Seleccion {
  properties: Record<string, unknown>;
  category: string;
  coordinate: Coordinate;
  lugar: RefLugar | null;
}

// Hacia dónde llevar el mapa cuando la ficha ya está dibujada: sin zoom, solo si la ficha tapa el punto
interface Encuadre {
  coordenada: Coordinate;
  zoom?: number;
}

// Densidad de píxeles con que se dibuja el mapa mientras se mueve. Pintar el canvas a la densidad
// de una pantalla de alta resolución es lo que más cuesta en cada cuadro; al detenerse el mapa
// vuelve a la densidad de la pantalla para que se vea nítido
const MOVING_PIXEL_RATIO = 1;

// Acercamiento mínimo al volar a un lugar (buscador, enlace o relacionado)
const ZOOM_BUSQUEDA = 14;
const DURACION_BUSQUEDA_MS = 1000;
const DURACION_DESPLAZAMIENTO_MS = 250; // Al correr el mapa para que la ficha no tape el punto

// Tolerancia en píxeles para hacer clic sobre un punto (facilita el uso en pantallas táctiles)
const POPUP_HIT_TOLERANCE = 6;

// Propiedades de un elemento sin su geometría (OpenLayers la guarda entre las propiedades)
const sinGeometria = (propiedades: Record<string, unknown>) => {
  const copia = { ...propiedades };
  delete copia.geometry;
  return copia;
};

const reducirMovimiento = () => Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

// Componente del mapa: crea el mapa y conecta capas, selector, pinturas, ficha, tutorial, recorrido y brújula
const MapComponent = () => {
  const mapRef = useRef<Map | null>(null); // Referencia al mapa
  const compassRef = useRef<HTMLButtonElement>(null); // Referencia a la brújula
  const [seleccion, setSeleccion] = useState<Seleccion | null>(null); // Elemento cuya ficha está abierta
  const encuadreRef = useRef<Encuadre | null>(null);
  const urlListaRef = useRef(false); // La URL refleja la ficha solo después de leer el enlace inicial
  const recorridoRef = useRef<Recorrido | null>(null);
  const [recorridoAbierto, setRecorridoAbierto] = useState(false);

  // Abre la ficha de un lugar por su capa e id (buscador, enlace ?lugar= o relacionado): enciende su
  // capa y vuela hasta él. Devuelve si el lugar existe
  const abrirLugar = async (ref: RefLugar) => {
    const lugar = await buscarLugar(ref).catch(() => null);
    const map = mapRef.current;
    if (!lugar || !map) return false;
    const { titulo, categoria } = CAPAS_LUGAR[ref.capa];
    findLayer(map, titulo)?.setVisible(true);
    const coordenada = fromLonLat([lugar.lon, lugar.lat]);
    encuadreRef.current = { coordenada, zoom: Math.max(map.getView().getZoom() ?? 0, ZOOM_BUSQUEDA) };
    setSeleccion((antes) => {
      // La misma ficha ya abierta no se vuelve a medir: se encuadra en el próximo cuadro
      if (antes?.lugar && claveLugar(antes.lugar) === claveLugar(ref)) {
        requestAnimationFrame(() => {
          const ficha = document.querySelector('.ficha-lugar');
          if (ficha) encuadrar(ficha.getBoundingClientRect());
        });
      }
      return { properties: lugar.propiedades, category: categoria, coordinate: coordenada, lugar: ref };
    });
    return true;
  };

  // Con la ficha dibujada, lleva el punto a la parte del mapa que la ficha deja libre
  const encuadrar = (ficha: DOMRect) => {
    const map = mapRef.current;
    const encuadre = encuadreRef.current;
    encuadreRef.current = null;
    if (!map || !encuadre) return;
    const tamano = map.getSize();
    if (!tamano || !tamano[0] || !tamano[1]) return;
    const visor = map.getViewport()?.getBoundingClientRect();
    if (!visor) return;
    const tapa = { left: ficha.left - visor.left, top: ficha.top - visor.top, right: ficha.right - visor.left, bottom: ficha.bottom - visor.top };
    const zona = zonaLibre(tapa, tamano[0], tamano[1]);
    if (encuadre.zoom === undefined) {
      const pixel = map.getPixelFromCoordinate(encuadre.coordenada);
      if (pixel && zona.contiene(pixel)) return; // Se ve bien: no se mueve el mapa
    }
    const vista = map.getView();
    const zoom = encuadre.zoom ?? vista.getZoom() ?? ZOOM_BUSQUEDA;
    // Con relleno (durante el recorrido) el centro de la vista es el del área sin relleno
    const [arriba, derecha, abajo, izquierda] = vista.padding ?? [0, 0, 0, 0];
    const centro = centroPara(encuadre.coordenada, [tamano[0] - izquierda - derecha, tamano[1] - arriba - abajo],
      [zona.centro[0] - izquierda, zona.centro[1] - arriba], vista.getResolutionForZoom(zoom), vista.getRotation());
    vista.cancelAnimations();
    vista.animate({
      center: centro,
      zoom,
      duration: reducirMovimiento() ? 0 : (encuadre.zoom === undefined ? DURACION_DESPLAZAMIENTO_MS : DURACION_BUSQUEDA_MS)
    });
  };

  // Funciones del render más reciente, para los manejadores que registra el mapa al montarse
  const accionesRef = useRef({ abrirLugar });
  useEffect(() => {
    accionesRef.current = { abrirLugar };
  });

  useEffect(() => {
    const map = new Map({
      target: 'map', // ID del elemento DOM donde se renderizará el mapa
      // El relieve (WebGL) viene apagado en celulares: allí es lo que más baja los cuadros por segundo
      // (ver relieve.ts); se enciende desde el selector de capas
      layers: createLayers({ relieveVisible: !esPantallaCompacta() }),
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

    // La escala del relieve sigue al zoom y a la latitud de la vista (ver relieve.ts)
    const relieve = findLayer(map, TITULO_RELIEVE) as WebGLTileLayer | null;
    const desconectarRelieve = relieve ? conectarRelieve(map, relieve) : () => {};

    // ?fps=1: contador de cuadros por segundo para medir en el dispositivo; el mapa queda en
    // window.geoGriut para los scripts de medición
    const quitarContador = contadorFpsActivo()
      ? crearContadorFps(map, () => ` · relieve ${relieve?.getVisible() ? 'sí' : 'no'}`)
      : () => {};
    if (contadorFpsActivo()) (window as unknown as { geoGriut?: { map: Map } }).geoGriut = { map };

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

    // OpenLayers fija z-index 0 en el contenedor de overlays y controles; se sube por encima
    // del logo y la brújula (z-index 1000) para que no tapen el selector de capas
    const overlayContainer = map.getOverlayContainerStopEvent();
    if (overlayContainer) {
      overlayContainer.style.zIndex = '1100';
    }

    const cerrarFicha = () => setSeleccion(null);

    // Al hacer clic en un elemento se abre su ficha; al hacer clic fuera, se cierra
    map.on('singleclick', (event) => {
      // Se queda con el primer elemento encontrado
      const hit = map.forEachFeatureAtPixel(event.pixel, (feature, layer) => ({ feature, layer }),
        { layerFilter: isPopupLayer, hitTolerance: POPUP_HIT_TOLERANCE });
      if (!hit) {
        cerrarFicha();
        return;
      }
      const geometry = hit.feature.getGeometry();
      const coordinate = geometry instanceof Point ? geometry.getCoordinates() : event.coordinate;
      const capa = capaLugarDe(hit.layer);
      const id = hit.feature.getId();
      encuadreRef.current = { coordenada: coordinate };
      setSeleccion({
        properties: sinGeometria(hit.feature.getProperties()),
        category: hit.layer.get('popupCategory'),
        coordinate,
        lugar: capa && typeof id === 'number' && Number.isInteger(id) ? { capa, id } : null
      });
    });

    // Cambia el cursor al pasar sobre un elemento con ficha
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

    // La brújula sigue la rotación del mapa
    const updateCompass = () => orientarBrujula(compassRef.current, map.getView().getRotation());
    map.getView().on('change:rotation', updateCompass);
    updateCompass(); // Orienta la brújula según la rotación inicial del mapa

    // Recorrido guiado (ver configRecorrido.ts); cada capítulo cierra la ficha del anterior
    const recorrido = new Recorrido(map, RECORRIDO_TERRITORIO, {
      alAbrir: () => setRecorridoAbierto(true),
      alCerrar: () => setRecorridoAbierto(false),
      alCambiar: cerrarFicha
    });
    recorridoRef.current = recorrido;

    // Tutorial de bienvenida (ver configTutorial.ts); los primeros barridos quedaron detrás de su velo
    const tutorial = crearTutorial(() => barridos.iniciar());
    // Espera a que el mapa y el selector de capas estén dibujados para destacarlos. Si el enlace
    // apunta a un capítulo del recorrido, se abre ese capítulo en vez del tutorial
    let tutorialTimeout: ReturnType<typeof setTimeout> | undefined;
    const iniciarTutorial = () => {
      tutorialTimeout = setTimeout(() => {
        if (!recorrido.abrirDesdeUrl()) tutorial.iniciar();
      }, 1000);
    };

    // Un enlace ?lugar=<capa>:<id> abre la ficha de ese lugar en vez del tutorial y del recorrido
    let desmontado = false;
    const lugarUrl = leerLugarUrl();
    if (lugarUrl) {
      accionesRef.current.abrirLugar(lugarUrl).then((abierto) => {
        if (desmontado) return;
        urlListaRef.current = true;
        if (!abierto) {
          escribirLugarUrl(null); // El lugar no existe: el enlace no sirve
          iniciarTutorial();
        }
      });
    } else {
      urlListaRef.current = true;
      iniciarTutorial();
    }

    // Limpieza al desmontar el componente
    return () => {
      desmontado = true;
      quitarContador();
      desconectarRelieve();
      clearTimeout(tutorialTimeout);
      tutorial.destruir();
      recorrido.destruir();
      recorridoRef.current = null;
      barridos.destruir();
      map.setTarget(undefined);
      mapRef.current = null;
    };
  }, []);

  // La URL lleva el lugar cuya ficha está abierta, para compartirla o volver a ella
  const lugarAbierto = seleccion?.lugar ? claveLugar(seleccion.lugar) : null;
  useEffect(() => {
    if (!urlListaRef.current) return;
    escribirLugarUrl(leerClaveLugar(lugarAbierto));
  }, [lugarAbierto]);

  // Con la ficha abierta, en celular se oculta la barra de chips del selector (ver ficha-lugar.css)
  const fichaAbierta = seleccion !== null;
  useEffect(() => {
    document.body.classList.toggle('con-ficha', fichaAbierta);
    return () => document.body.classList.remove('con-ficha');
  }, [fichaAbierta]);

  // Mientras dura el recorrido se ocultan los controles que la tarjeta taparía (ver recorrido.css)
  useEffect(() => {
    document.body.classList.toggle('en-recorrido', recorridoAbierto);
  }, [recorridoAbierto]);

  // Vuela al lugar elegido en el buscador y abre su ficha
  const irALugar = (resultado: ResultadoBusqueda) => {
    if (esCapaLugar(resultado.capa)) void abrirLugar({ capa: resultado.capa, id: resultado.id });
  };

  return (
    <div>
      <div id="map"></div>
      <Brujula ref={compassRef} mapRef={mapRef} />
      {!recorridoAbierto && <Buscador alElegir={irALugar} />}
      {!recorridoAbierto && (
        <button type="button" className="recorrido-boton" onClick={() => recorridoRef.current?.abrir()}
          aria-label={'Recorrido guiado: ' + RECORRIDO_TERRITORIO.titulo} title={RECORRIDO_TERRITORIO.titulo}>
          {/* Camino entre dos puntos */}
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            <circle cx="6" cy="18" r="2.5" fill="currentColor" />
            <path d="M18 3.5a3.5 3.5 0 0 0-3.5 3.5c0 2.6 3.5 6 3.5 6s3.5-3.4 3.5-6A3.5 3.5 0 0 0 18 3.5z" fill="currentColor" />
            <path d="M8.5 18h6a3 3 0 0 0 0-6h-5a3 3 0 0 1 0-6h2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeDasharray="2.5 2.5" />
          </svg>
          <span className="recorrido-boton-texto">Recorrer el territorio</span>
        </button>
      )}
      <div className="griut-logo">
        <img src="logo01.png" alt="Logo GRIUT" />
        <div><b>Grupo de Estudios Interculturales<br />Urbanos y Territoriales</b></div>
      </div>
      {seleccion && (
        <FichaLugar
          properties={seleccion.properties}
          category={seleccion.category}
          lugar={seleccion.lugar}
          onClose={() => setSeleccion(null)}
          onElegirRelacionado={(ref) => void abrirLugar(ref)}
          onMedir={encuadrar}
        />
      )}
    </div>
  );
};

export default MapComponent;
