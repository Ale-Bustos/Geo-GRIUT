import Map from 'ol/Map';
import VectorLayer from 'ol/layer/Vector';
import SelectorCapas, { type GrupoCapas } from './SelectorCapas';

// Monta el selector en un mapa y devuelve su elemento raíz
const montar = (grupos: GrupoCapas[]) => {
  const target = document.createElement('div');
  document.body.appendChild(target);
  const map = new Map({ target, controls: [] });
  map.addControl(new SelectorCapas({ grupos }));
  return target.querySelector<HTMLElement>('.sc');
};

afterEach(() => {
  document.body.innerHTML = '';
});

test('la raíz del selector deja pasar los eventos al mapa (zoom y arrastre)', () => {
  expect(montar([])?.style.pointerEvents).toBe('none');
});

test('el interruptor muestra y oculta la capa', () => {
  const capa = new VectorLayer({ visible: false });
  const interruptor = montar([{ titulo: 'Grupo', capas: [{ capa, nombre: 'Capa' }] }])
    ?.querySelector<HTMLButtonElement>('.sc-switch');
  interruptor?.click();
  expect(capa.getVisible()).toBe(true);
  expect(interruptor).toHaveAttribute('aria-checked', 'true');
  interruptor?.click();
  expect(capa.getVisible()).toBe(false);
});
