import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { getWidth } from 'ol/extent';
import { get as getProjection } from 'ol/proj';
import type ImageTile from 'ol/source/ImageTile';
import App from './App';
import { TUTORIAL_KEY } from './configTutorial';
import { createLayers } from './capas';
import {
  brilloLadera, crearRelieve, esPantallaCompacta, PANTALLA_COMPACTA, decodificarTerrainRgb, FUENTE_DEM, INTENSIDAD, metrosPorPixelTextura, TITULO_RELIEVE, ZOOM_MAXIMO_DEM
} from './relieve';

test('decodifica la altura de Terrain-RGB', () => {
  expect(decodificarTerrainRgb(1, 134, 160)).toBeCloseTo(0, 6); // 100000 · 0,1 - 10000
  expect(decodificarTerrainRgb(1, 135, 136)).toBeCloseTo(23.2, 6); // 100232 · 0,1 - 10000
  expect(decodificarTerrainRgb(0, 0, 0)).toBe(-10000);
});

test('pide teselas sin pérdida (pngraw) de 512 px hasta el zoom 14', () => {
  // Terrain-RGB: el tileset que Mapbox ofrece por la Raster Tiles API (Terrain-DEM v1 es solo para sus SDK)
  expect(FUENTE_DEM.url).toMatch(/\/v4\/mapbox\.terrain-rgb\/\{z\}\/\{x\}\/\{y\}@2x\.pngraw\?access_token=/);
  expect(FUENTE_DEM.tileSize).toBe(512);
  expect(FUENTE_DEM.maxZoom).toBe(14);
});

test('la luz viene del este-noreste: solo se oscurecen las laderas que le dan la espalda', () => {
  expect(brilloLadera(0, 0)).toBe(1); // Terreno plano: blanco (no cambia el mapa base al multiplicar)
  const sube = (grados: number, pendiente = 0.3) =>
    brilloLadera(Math.sin((grados * Math.PI) / 180) * pendiente, Math.cos((grados * Math.PI) / 180) * pendiente);
  // Una ladera que sube hacia el ENE mira al OSO: es la más oscura
  expect(sube(67.5)).toBeLessThan(sube(0));
  expect(sube(67.5)).toBeLessThan(sube(90));
  expect(sube(67.5)).toBeGreaterThanOrEqual(1 - INTENSIDAD);
  // Las que miran a la luz quedan como el terreno plano
  expect(sube(247.5)).toBe(1);
  expect(sube(270)).toBe(1);
  // El sur y el este no son simétricos: la luz no viene del norte ni del este puros
  expect(sube(0)).not.toBeCloseTo(sube(90), 3);
});

test('la escala de la pendiente usa la resolución de la tesela, nunca más fina que el zoom 14', () => {
  const fuente = crearRelieve().capa.getSource() as ImageTile;
  const mundo = getWidth(getProjection('EPSG:3857')!.getExtent());
  const resZ = (z: number) => mundo / 512 / 2 ** z; // Teselas de 512 px
  const lat = -37;
  const cos = Math.cos((lat * Math.PI) / 180);
  expect(metrosPorPixelTextura(fuente, resZ(11), lat)).toBeCloseTo(resZ(11) * cos, 6);
  // Más cerca que el zoom 14 se amplían las teselas de ese nivel: la pendiente no se exagera
  expect(metrosPorPixelTextura(fuente, resZ(17), lat)).toBeCloseTo(resZ(ZOOM_MAXIMO_DEM) * cos, 6);
});

test('el relieve va sobre el mapa base y bajo todas las capas temáticas', () => {
  const [base, tematicas] = createLayers();
  const enBase = base.getLayersArray().map((c) => c.get('title'));
  expect(enBase).toEqual(['Mapbox', TITULO_RELIEVE]);
  expect(tematicas.get('title')).toBe('Capas');
  expect(createLayers({ relieveVisible: false })[0].getLayersArray()[1].getVisible()).toBe(false);
});

test('el selector de capas lo enciende y apaga', async () => {
  localStorage.setItem(TUTORIAL_KEY, '1');
  render(<App />);
  const interruptor = screen.getByRole('switch', { name: 'Relieve sombreado' });
  const antes = interruptor.getAttribute('aria-checked');
  await userEvent.click(interruptor);
  expect(interruptor).toHaveAttribute('aria-checked', antes === 'true' ? 'false' : 'true');
});

test('viene apagado en pantallas de celular y encendido en escritorio', () => {
  const original = window.matchMedia;
  const conPantalla = (compacta: boolean) => {
    window.matchMedia = ((q: string) => ({ matches: compacta && q === PANTALLA_COMPACTA })) as unknown as typeof window.matchMedia;
  };
  localStorage.setItem(TUTORIAL_KEY, '1');
  try {
    for (const compacta of [true, false]) {
      conPantalla(compacta);
      const { unmount } = render(<App />);
      expect(esPantallaCompacta()).toBe(compacta);
      expect(screen.getByRole('switch', { name: 'Relieve sombreado' })).toHaveAttribute('aria-checked', String(!compacta));
      unmount();
    }
  } finally {
    window.matchMedia = original;
  }
});
