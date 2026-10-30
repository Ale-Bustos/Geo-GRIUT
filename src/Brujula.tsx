// Brújula del meli witran mapu: muestra la rotación del mapa y permite girarlo (arrastre, clic o teclado)
import { forwardRef, useRef, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import type Map from 'ol/Map';
import { INITIAL_ROTATION, NORTH_ROTATION, normalizeAngle } from './vista';
import simboloBrujula from './img/compass-simbolo.png'; // Símbolo del meli witran mapu, sin los nombres
import './css/compass.css';

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

// Ángulo del puntero respecto al centro de un elemento, en sentido horario desde arriba
// (el mismo sentido que la rotación de OpenLayers)
const pointerAngle = (element: HTMLElement, clientX: number, clientY: number) => {
  const rect = element.getBoundingClientRect();
  return Math.atan2(clientX - (rect.left + rect.width / 2), (rect.top + rect.height / 2) - clientY);
};

interface BrujulaProps {
  mapRef: RefObject<Map | null>; // Mapa que gira la brújula
}

// El componente del mapa recibe el botón (ref) para orientarlo cuando el mapa gira
const Brujula = forwardRef<HTMLButtonElement, BrujulaProps>(({ mapRef }, compassRef) => {
  // Arrastre en curso sobre la brújula: último ángulo del puntero y si ya giró el mapa
  const compassDragRef = useRef<{ pointerId: number; lastAngle: number; dragged: boolean } | null>(null);
  const suppressCompassClickRef = useRef(false); // Evita que soltar tras arrastrar cuente como clic
  const compassKeyTargetRef = useRef(INITIAL_ROTATION); // Rotación a la que va el giro con las flechas

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
  );
});
Brujula.displayName = 'Brujula';

/** Orienta la brújula según la rotación del mapa (apunta al este, de ahí el cuarto de vuelta). */
export const orientarBrujula = (boton: HTMLButtonElement | null, rotation: number) => {
  if (boton) {
    boton.style.transform = 'rotate(' + (rotation + Math.PI / 2) + 'rad)';
  }
};

export default Brujula;
