import { act, fireEvent, render, screen } from '@testing-library/react';
import Buscador from './Buscador';

const TRALKAWENU = { capa: 'toponimos', id: 16, nombre: 'Tralkawenu', lon: -73.12, lat: -36.72 };

// Simula la API: /api/salud responde según `saludOk`; /api/buscar devuelve un resultado
const simularApi = (saludOk: boolean) => {
  const fetchFalso = vi.fn(async (url: string) => {
    if (url.endsWith('/api/salud')) {
      if (!saludOk) throw new TypeError('Failed to fetch');
      return new Response('{"estado":"ok"}');
    }
    return new Response(JSON.stringify([TRALKAWENU, { ...TRALKAWENU, capa: 'desconocida', id: 1 }]));
  });
  vi.stubGlobal('fetch', fetchFalso);
  return fetchFalso;
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

test('no se muestra si la API no responde', async () => {
  simularApi(false);
  const { container } = render(<Buscador alElegir={() => {}} />);
  await act(async () => {});
  expect(container).toBeEmptyDOMElement();
});

test('busca tras dejar de escribir y avisa el lugar elegido', async () => {
  const fetchFalso = simularApi(true);
  const alElegir = vi.fn();
  render(<Buscador alElegir={alElegir} />);
  const campo = await screen.findByRole('combobox', { name: 'Buscar un lugar' });

  vi.useFakeTimers();
  fireEvent.change(campo, { target: { value: 't' } });
  await act(async () => { vi.advanceTimersByTime(500); });
  expect(fetchFalso).toHaveBeenCalledTimes(1); // Con una letra no se busca

  fireEvent.change(campo, { target: { value: 'tral' } });
  await act(async () => { vi.advanceTimersByTime(500); });
  expect(fetchFalso).toHaveBeenLastCalledWith('/api/buscar?q=tral', expect.anything());
  vi.useRealTimers();

  const opciones = await screen.findAllByRole('option');
  expect(opciones).toHaveLength(1); // La capa desconocida se descarta
  expect(opciones[0]).toHaveTextContent('Tralkawenu');

  fireEvent.keyDown(campo, { key: 'ArrowDown' });
  expect(campo).toHaveAttribute('aria-activedescendant', opciones[0].id);
  fireEvent.keyDown(campo, { key: 'Enter' });
  expect(alElegir).toHaveBeenCalledWith(TRALKAWENU);
  expect(campo).toHaveValue('');
});
