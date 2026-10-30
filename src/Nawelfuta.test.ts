import Map from 'ol/Map';
import { BarridoNawelfuta, crearCapasNawelfuta } from './Nawelfuta';

// Reloj de cuadros controlado a mano: cada llamada a avanzar(ms) ejecuta los cuadros pendientes
let pendientes: FrameRequestCallback[] = [];
let ahora = 0;
const avanzar = (ms: number) => {
  ahora += ms;
  const lote = pendientes;
  pendientes = [];
  lote.forEach((f) => f(ahora));
};

beforeEach(() => {
  pendientes = [];
  ahora = 0;
  vi.stubGlobal('requestAnimationFrame', (f: FrameRequestCallback) => pendientes.push(f));
  vi.stubGlobal('cancelAnimationFrame', () => { pendientes = []; });
  vi.stubGlobal('matchMedia', () => ({ matches: false }));
});

afterEach(() => vi.unstubAllGlobals());

const montar = () => {
  const { pintura, nombre } = crearCapasNawelfuta();
  const map = new Map({ layers: [pintura, nombre] });
  return { pintura, barrido: new BarridoNawelfuta(map, pintura, nombre, 3000) };
};

test('el barrido dura 3 s, deja la pintura fija y no deja cuadros pendientes', () => {
  const { barrido } = montar();
  barrido.iniciar();
  avanzar(16); // Primer cuadro: marca el inicio
  avanzar(1500);
  expect(barrido.terminado).toBe(false);
  avanzar(1500);
  expect(barrido.terminado).toBe(true);
  expect(pendientes).toHaveLength(0);
});

test('reiniciar no acumula animaciones: siempre hay un solo cuadro en espera', () => {
  const { barrido } = montar();
  barrido.iniciar();
  barrido.iniciar();
  barrido.iniciar();
  expect(pendientes).toHaveLength(1);
});

test('volver a encender la capa repite el barrido', () => {
  const { pintura, barrido } = montar();
  pintura.setVisible(false);
  pintura.setVisible(true);
  expect(barrido.terminado).toBe(false);
  expect(pendientes).toHaveLength(1);
});

test('con "reducir movimiento" muestra directo el resultado', () => {
  vi.stubGlobal('matchMedia', () => ({ matches: true }));
  const { barrido } = montar();
  barrido.iniciar();
  expect(barrido.terminado).toBe(true);
  expect(pendientes).toHaveLength(0);
});

test('destruir corta el barrido en curso', () => {
  const { barrido } = montar();
  barrido.iniciar();
  barrido.destruir();
  expect(pendientes).toHaveLength(0);
});
