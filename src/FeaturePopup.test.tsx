import { render, screen } from '@testing-library/react';
import FeaturePopup from './FeaturePopup';

const conflicto = {
  PopupInfo: 'Terminal GNL Penco-Lirquen\n',
  Copia_de11: 'Conflicto Socioambiental',
  Copia_de_T: 'Instalación terminal marítimo GNL',
  Copia_de_1: 'Industrialización',
  Copia_de_2: 'Penco',
  Copia_de_3: null,
  Copia_de_4: '-',
  Copia_de_5: 'si',
  Copia_de_6: 'Asociación Indígena Koñintu Lafken Mapu',
  Copia_de10: 'Actas municipales https://www.example.org/informe.pdf',
  Copia_de12: null
};

test('muestra título, categoría y solo los campos con información', () => {
  render(<FeaturePopup properties={conflicto} category="Conflicto socioambiental" onClose={() => {}} />);
  expect(screen.getByRole('heading', { name: 'Terminal GNL Penco-Lirquen' })).toBeInTheDocument();
  expect(screen.getByText('Conflicto Socioambiental')).toBeInTheDocument();
  expect(screen.getByText('Eje temático')).toBeInTheDocument();
  expect(screen.getByText('Industrialización')).toBeInTheDocument();
  expect(screen.getByText('Si')).toBeInTheDocument();
  // null y "-" se consideran vacíos
  expect(screen.queryByText('Sector')).not.toBeInTheDocument();
  expect(screen.queryByText('Otras organizaciones')).not.toBeInTheDocument();
});

test('muestra las fuentes como texto y enlaces seguros', () => {
  render(<FeaturePopup properties={conflicto} category="Conflicto socioambiental" onClose={() => {}} />);
  expect(screen.getByText('Actas municipales')).toBeInTheDocument();
  const link = screen.getByRole('link', { name: 'example.org' });
  expect(link).toHaveAttribute('href', 'https://www.example.org/informe.pdf');
  expect(link).toHaveAttribute('rel', 'noopener noreferrer');
});

test('usa la categoría de la capa cuando el punto no trae una', () => {
  render(<FeaturePopup properties={{ Name: 'Batalla de Andalien' }} category="Punto histórico" onClose={() => {}} />);
  expect(screen.getByText('Punto histórico')).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Batalla de Andalien' })).toBeInTheDocument();
  expect(screen.queryByText('Fuentes')).not.toBeInTheDocument();
});

test('numera los enlaces que son del mismo sitio', () => {
  const properties = { Name: 'Proyecto', Copia_de10: 'https://seia.sea.gob.cl/a https://seia.sea.gob.cl/b https://otro.cl/c' };
  render(<FeaturePopup properties={properties} category="Conflicto socioambiental" onClose={() => {}} />);
  expect(screen.getByRole('link', { name: 'seia.sea.gob.cl (1)' })).toHaveAttribute('href', 'https://seia.sea.gob.cl/a');
  expect(screen.getByRole('link', { name: 'seia.sea.gob.cl (2)' })).toHaveAttribute('href', 'https://seia.sea.gob.cl/b');
  expect(screen.getByRole('link', { name: 'otro.cl' })).toBeInTheDocument();
});
