// Contador de cuadros por segundo para medir en el dispositivo real: se activa con ?fps=1.
// Muestra los cuadros del último segundo, el cuadro más lento y la densidad de píxeles con que se
// está dibujando el mapa (baja a 1 mientras se mueve, ver MOVING_PIXEL_RATIO en MapComponent.tsx)
import type Map from 'ol/Map';

export const contadorFpsActivo = () => new URLSearchParams(window.location.search).get('fps') === '1';

export const crearContadorFps = (map: Map, describir: () => string = () => '') => {
  const caja = document.createElement('div');
  caja.className = 'contador-fps';
  caja.setAttribute('aria-hidden', 'true'); // Herramienta de medición, no contenido
  document.body.appendChild(caja);

  let cuadros = 0;
  let peor = 0;
  let anterior = performance.now();
  let inicio = anterior;
  let id = requestAnimationFrame(function cuadro(ahora) {
    cuadros++;
    peor = Math.max(peor, ahora - anterior);
    anterior = ahora;
    if (ahora - inicio >= 1000) {
      const fps = (cuadros * 1000) / (ahora - inicio);
      const dpr = map.getPixelRatio();
      caja.textContent = `${fps.toFixed(0)} fps · peor ${peor.toFixed(0)} ms · DPR ${dpr}${describir()}`;
      cuadros = 0;
      peor = 0;
      inicio = ahora;
    }
    id = requestAnimationFrame(cuadro);
  });

  return () => {
    cancelAnimationFrame(id);
    caja.remove();
  };
};
