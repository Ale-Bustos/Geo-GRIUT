import { screen } from '@testing-library/react';
import TutorialMapa from './TutorialMapa';

const CLAVE = 'tutorialMapa.test';

const crearTutorial = () => new TutorialMapa({
  clave: CLAVE,
  pasos: [
    { saludo: 'Mari mari', titulo: 'Paso uno', texto: '<p>Uno</p>' },
    { titulo: 'Paso dos', texto: '<p>Dos</p>' }
  ]
});

afterEach(() => {
  localStorage.clear();
  document.body.innerHTML = '';
});

test('se muestra la primera vez con el contador en mapudungun', () => {
  crearTutorial().iniciar();
  expect(screen.getByRole('dialog', { name: 'Paso uno' })).toBeVisible();
  expect(screen.getByText('Kiñe · Paso 1 de 2')).toBeInTheDocument();
  expect(screen.getByText('Mari mari')).toBeInTheDocument();
});

test('avanza, termina y no vuelve a mostrarse', () => {
  crearTutorial().iniciar();
  screen.getByRole('button', { name: 'Siguiente' }).click();
  expect(screen.getByText('Epu · Paso 2 de 2')).toBeInTheDocument();
  screen.getByRole('button', { name: 'Comenzar a explorar' }).click();
  expect(localStorage.getItem(CLAVE)).toBe('1');

  document.body.innerHTML = '';
  crearTutorial().iniciar();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

test('destruir quita la ventana sin marcarla como vista', () => {
  const tutorial = crearTutorial();
  tutorial.iniciar();
  tutorial.destruir();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(localStorage.getItem(CLAVE)).toBeNull();
});

test('en modo recorrido no hay velo, avisa cada paso y no se marca como visto', () => {
  const pasos: number[] = [];
  const recorrido = new TutorialMapa({
    clave: CLAVE,
    modo: 'recorrido',
    textoSaltar: 'Salir del recorrido',
    alCambiar: (i) => pasos.push(i),
    pasos: [{ titulo: 'Paso uno', texto: '' }, { titulo: 'Paso dos', texto: '' }]
  });
  recorrido.abrir();
  expect(document.querySelector('.tu-velo')).toBeNull();
  expect(screen.getByRole('dialog', { name: 'Paso uno' })).toHaveAttribute('aria-modal', 'false');
  screen.getByRole('button', { name: 'Siguiente' }).click();
  expect(pasos).toEqual([0, 1]);
  screen.getByRole('button', { name: 'Salir del recorrido' }).click(); // También en el último paso
  expect(localStorage.getItem(CLAVE)).toBeNull();
});
