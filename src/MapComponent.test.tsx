// Enlace propio de cada lugar: ?lugar=<capa>:<id> abre su ficha al cargar el mapa
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { TUTORIAL_KEY } from './configTutorial';
import { olvidarLugares } from './lugares';
import { servirPublic } from './pruebas';

const ESPERA_TUTORIAL_MS = 1100; // El tutorial y el recorrido arrancan un segundo después de montar el mapa

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

beforeEach(() => {
  olvidarLugares();
  localStorage.removeItem(TUTORIAL_KEY); // El tutorial aparecería si nada lo impide
  vi.stubGlobal('fetch', servirPublic()); // API caída
});

afterEach(() => {
  vi.unstubAllGlobals();
  window.history.replaceState(null, '', '/');
});

test('?lugar= abre la ficha de ese lugar en vez del tutorial y del recorrido', async () => {
  window.history.replaceState(null, '', '/?lugar=conflictos:1&recorrido=lafkenmapu-nawelfuta&paso=3');
  const { container, unmount } = render(<App />);
  expect(await screen.findByRole('dialog', { name: 'Pescadores vs Central Santa María' })).toBeInTheDocument();
  expect(new URLSearchParams(window.location.search).get('lugar')).toBe('conflictos:1');
  await esperar(ESPERA_TUTORIAL_MS);
  expect(container.ownerDocument.querySelector('.tu')).not.toBeInTheDocument();
  unmount();
});

test('al cerrar la ficha el lugar sale de la URL; un relacionado abre su ficha y cambia la URL', async () => {
  window.history.replaceState(null, '', '/?lugar=toponimos:1');
  const { unmount } = render(<App />);
  await screen.findByRole('dialog', { name: 'Anca-lighen' });
  await userEvent.click(await screen.findByRole('button', { name: /Batalla de Andalien/ }));
  expect(await screen.findByRole('dialog', { name: 'Batalla de Andalien' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Batalla de Andalien' })).toHaveFocus();
  await waitFor(() => expect(new URLSearchParams(window.location.search).get('lugar')).toBe('puntos-historicos:3'));
  await userEvent.keyboard('{Escape}');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(window.location.search).toBe('');
  unmount();
});

test.each(['conflictos:999', 'rios:1', 'conflictos:abc'])('un enlace que no lleva a un lugar (%s) se descarta y sigue el tutorial', async (valor) => {
  window.history.replaceState(null, '', '/?lugar=' + valor);
  const { unmount } = render(<App />);
  await waitFor(() => expect(new URLSearchParams(window.location.search).has('lugar')).toBe(false));
  await esperar(ESPERA_TUTORIAL_MS);
  expect(screen.queryByRole('dialog', { name: /Pescadores/ })).not.toBeInTheDocument();
  expect(document.querySelector('.tu')).toBeInTheDocument();
  unmount();
});
