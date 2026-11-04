import View from 'ol/View';
import { centroPara, zonaLibre, INITIAL_ROTATION } from './vista';

test('centroPara da el mismo centro que View#centerOn, también con el mapa girado', () => {
  for (const rotacion of [0, INITIAL_ROTATION, 0.7]) {
    const vista = new View({ center: [0, 0], resolution: 12, rotation: rotacion });
    const punto = [-8131000, -4413000];
    vista.centerOn(punto, [800, 600], [150, 420]);
    const centro = centroPara(punto, [800, 600], [150, 420], 12, rotacion);
    expect(centro[0]).toBeCloseTo(vista.getCenter()![0], 6);
    expect(centro[1]).toBeCloseTo(vista.getCenter()![1], 6);
  }
});

test('zonaLibre: a la derecha del panel en escritorio y arriba de la hoja en celular', () => {
  const panel = zonaLibre({ left: 12, top: 12, right: 392, bottom: 788 }, 1280, 800);
  expect(panel.centro).toEqual([836, 400]);
  expect(panel.contiene([200, 400])).toBe(false); // Bajo el panel
  expect(panel.contiene([900, 400])).toBe(true);

  const hoja = zonaLibre({ left: 0, top: 351, right: 360, bottom: 780 }, 360, 780);
  expect(hoja.centro).toEqual([180, 175.5]);
  expect(hoja.contiene([180, 600])).toBe(false);
  expect(hoja.contiene([180, 100])).toBe(true);

  // Teléfono en horizontal: la hoja angosta y centrada sigue siendo una hoja inferior
  expect(zonaLibre({ left: 110, top: 160, right: 670, bottom: 360 }, 780, 360).centro).toEqual([390, 80]);
});
