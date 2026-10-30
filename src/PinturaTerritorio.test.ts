import Map from 'ol/Map';
import { BarridoPinturas, crearPintura, NAWELFUTA, FIOFIO_LEWFU, ANDALIEN } from './PinturaTerritorio';

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
  const cordillera = crearPintura(NAWELFUTA);
  const rio = crearPintura(FIOFIO_LEWFU);
  const map = new Map({ layers: [cordillera.pintura, rio.pintura, cordillera.nombre, rio.nombre] });
  const barridos = new BarridoPinturas(map, 3000);
  barridos.registrar(NAWELFUTA, cordillera.pintura, cordillera.nombre);
  barridos.registrar(FIOFIO_LEWFU, rio.pintura, rio.nombre);
  return { barridos, cordillera: cordillera.pintura, rio: rio.pintura };
};

test('el barrido dura 3 s, deja la pintura fija y no deja cuadros pendientes', () => {
  const { barridos, cordillera, rio } = montar();
  barridos.iniciar();
  avanzar(16); // Primer cuadro: marca el inicio
  avanzar(1500);
  expect(barridos.terminado(cordillera)).toBe(false);
  expect(barridos.terminado(rio)).toBe(false);
  avanzar(1500);
  expect(barridos.terminado(cordillera)).toBe(true);
  expect(barridos.terminado(rio)).toBe(true);
  expect(pendientes).toHaveLength(0);
});

test('un solo ciclo de animación para todas las pinturas, aunque se reinicien seguido', () => {
  const { barridos, cordillera, rio } = montar();
  barridos.iniciar(cordillera);
  barridos.iniciar(rio);
  barridos.iniciar();
  barridos.iniciar(rio);
  expect(pendientes).toHaveLength(1);
});

test('cada pintura lleva su propio tiempo', () => {
  const { barridos, cordillera, rio } = montar();
  barridos.iniciar(cordillera);
  avanzar(16);
  avanzar(2000);
  barridos.iniciar(rio); // El río empieza cuando la cordillera va por los 2 s
  avanzar(1000);
  expect(barridos.terminado(cordillera)).toBe(true);
  expect(barridos.terminado(rio)).toBe(false);
  avanzar(3000);
  expect(barridos.terminado(rio)).toBe(true);
  expect(pendientes).toHaveLength(0);
});

test('volver a encender una capa repite solo su barrido', () => {
  const { barridos, cordillera, rio } = montar();
  cordillera.setVisible(false);
  cordillera.setVisible(true);
  expect(barridos.terminado(cordillera)).toBe(false);
  expect(barridos.terminado(rio)).toBe(true);
  expect(pendientes).toHaveLength(1);
});

test('con "reducir movimiento" muestra directo el resultado', () => {
  vi.stubGlobal('matchMedia', () => ({ matches: true }));
  const { barridos, cordillera, rio } = montar();
  barridos.iniciar();
  expect(barridos.terminado(cordillera)).toBe(true);
  expect(barridos.terminado(rio)).toBe(true);
  expect(pendientes).toHaveLength(0);
});

test('destruir corta los barridos en curso', () => {
  const { barridos } = montar();
  barridos.iniciar();
  barridos.destruir();
  expect(pendientes).toHaveLength(0);
});

test('las tres pinturas comparten un solo ciclo y terminan juntas si empiezan juntas', () => {
  const pinturas = [NAWELFUTA, FIOFIO_LEWFU, ANDALIEN].map((def) => ({ def, ...crearPintura(def) }));
  const map = new Map({ layers: pinturas.flatMap((p) => [p.pintura, p.nombre]) });
  const barridos = new BarridoPinturas(map, 3000);
  pinturas.forEach((p) => barridos.registrar(p.def, p.pintura, p.nombre));
  barridos.iniciar();
  expect(pendientes).toHaveLength(1);
  avanzar(16);
  avanzar(3000);
  pinturas.forEach((p) => expect(barridos.terminado(p.pintura)).toBe(true));
  expect(pendientes).toHaveLength(0);
});
