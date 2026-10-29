import { render, screen } from '@testing-library/react';
import App from './App';
import { TUTORIAL_KEY } from './MapComponent';

beforeEach(() => {
  localStorage.setItem(TUTORIAL_KEY, '1'); // Evita que el tutorial se inicie durante los tests
});

test('muestra el mapa, la brújula y el logo de GRIUT', () => {
  const { container } = render(<App />);
  // El visor de OpenLayers no tiene un rol accesible, así que se busca por su clase
  expect(container.querySelector('#map .ol-viewport')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /brújula/i })).toBeInTheDocument();
  expect(screen.getByAltText('Logo GRIUT')).toBeInTheDocument();
  expect(screen.getByText(/Grupo de Estudios Interculturales/)).toBeInTheDocument();
});

test('desmontar el componente elimina el mapa', () => {
  const { container, unmount } = render(<App />);
  unmount();
  expect(container.querySelector('.ol-viewport')).not.toBeInTheDocument();
});
