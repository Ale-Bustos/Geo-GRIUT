import { screen } from '@testing-library/react';
import Map from 'ol/Map';
import View from 'ol/View';
import LayerGroup from 'ol/layer/Group';
import VectorLayer from 'ol/layer/Vector';
import { fromLonLat } from 'ol/proj';
import Recorrido, { rellenoTarjeta, type DefinicionRecorrido } from './Recorrido';

const capa = (title: string, visible = true) => new VectorLayer({ properties: { title }, visible });

const DEF: DefinicionRecorrido = {
  id: 'prueba',
  titulo: 'Recorrido de prueba',
  capitulos: [
    { titulo: 'Costa', texto: '<p>Uno</p>', vista: { centro: [-73.1, -36.74], zoom: 11 }, capas: ['Toponimia'] },
    { titulo: 'Río', texto: '<p>Dos</p>', vista: { centro: [-73.07, -36.86], zoom: 12, rotacion: 0 }, capas: ['Toponimia', 'Río'] }
  ]
};

const crearMapa = () => {
  const capas = [capa('Toponimia'), capa('Río', false), capa('Conflictos'), capa('Río (nombre)', false)];
  const mapaBase = capa('Mapbox');
  const map = new Map({
    layers: [new LayerGroup({ properties: { title: 'Mapa Base' }, layers: [mapaBase] }), new LayerGroup({ properties: { title: 'Capas' }, layers: capas })],
    view: new View({ center: [0, 0], zoom: 5 })
  });
  return { map, capas, mapaBase };
};

const visibles = (capas: VectorLayer[]) => capas.map((c) => c.getVisible());

afterEach(() => {
  document.body.innerHTML = '';
  window.history.replaceState(null, '', '/');
});

test('cada capítulo deja encendidas solo sus capas y lleva la vista a su lugar', () => {
  const { map, capas, mapaBase } = crearMapa();
  const animate = vi.spyOn(map.getView(), 'animate');
  const recorrido = new Recorrido(map, DEF);
  recorrido.abrir();

  expect(screen.getByRole('dialog', { name: 'Costa' })).toBeVisible();
  expect(visibles(capas)).toEqual([true, false, false, false]);
  expect(mapaBase.getVisible()).toBe(true); // El mapa base no se toca
  expect(animate).toHaveBeenLastCalledWith(expect.objectContaining({ center: fromLonLat([-73.1, -36.74]), zoom: 11, rotation: -Math.PI / 2 }));
  expect(window.location.search).toBe('?recorrido=prueba&paso=1');

  screen.getByRole('button', { name: 'Siguiente' }).click();
  expect(visibles(capas).slice(0, 3)).toEqual([true, true, false]);
  expect(animate).toHaveBeenLastCalledWith(expect.objectContaining({ zoom: 12, rotation: 0 }));
  expect(window.location.search).toBe('?recorrido=prueba&paso=2');
});

test('al salir deja las capas, la vista y la URL como estaban', () => {
  const { map, capas } = crearMapa();
  const antes = visibles(capas);
  const recorrido = new Recorrido(map, DEF);
  recorrido.abrir(1);
  const animate = vi.spyOn(map.getView(), 'animate');
  screen.getByRole('button', { name: 'Salir' }).click();

  expect(screen.queryByRole('dialog')).not.toBeInTheDocument(); // La tarjeta queda oculta
  expect(visibles(capas)).toEqual(antes);
  expect(animate).toHaveBeenLastCalledWith(expect.objectContaining({ center: [0, 0], zoom: 5, rotation: 0 }));
  expect(window.location.search).toBe('');
});

test('abre el capítulo al que apunta el enlace', () => {
  window.history.replaceState(null, '', '/?recorrido=prueba&paso=2');
  const { map } = crearMapa();
  expect(new Recorrido(map, DEF).abrirDesdeUrl()).toBe(true);
  expect(screen.getByRole('dialog', { name: 'Río' })).toBeVisible();

  document.body.innerHTML = '';
  window.history.replaceState(null, '', '/?recorrido=otro');
  expect(new Recorrido(crearMapa().map, DEF).abrirDesdeUrl()).toBe(false);
});

test('la vista deja libre la parte del mapa que tapa la tarjeta', () => {
  // Celular: hoja inferior a todo el ancho
  expect(rellenoTarjeta({ left: 12, top: 400, right: 348, width: 336, height: 228 }, 360, 640)).toEqual([0, 0, 248, 0]);
  // Escritorio: panel a la izquierda
  expect(rellenoTarjeta({ left: 12, top: 172, right: 372, width: 360, height: 300 }, 1400, 900)).toEqual([0, 0, 0, 380]);
  // Celular acostado: panel a la derecha
  expect(rellenoTarjeta({ left: 452, top: 8, right: 792, width: 340, height: 344 }, 800, 360)).toEqual([0, 356, 0, 0]);
});
