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

test('muestra fotos con su crédito y las miradas del lugar', () => {
  const properties = {
    PopupInfo: 'Conflicto península de Hualpén',
    MiradaAmbiental: 'Conservación versus loteo.',
    MiradaMapuche: null,
    Fotos: [
      { src: '/fotos/peninsula-hualpen.webp', credito: 'Municipalidad de Hualpén' },
      { src: '/fotos/lamina-usos-hualpen.webp', credito: 'Lámina GRIUT: usos de suelo' }
    ]
  };
  render(<FeaturePopup properties={properties} category="Conflicto socioambiental" onClose={() => {}} />);
  expect(screen.getByText('Foto: Municipalidad de Hualpén')).toBeInTheDocument();
  expect(screen.getByText('Lámina GRIUT: usos de suelo')).toBeInTheDocument(); // Las láminas no llevan "Foto:"
  expect(screen.getByRole('link', { name: /Municipalidad de Hualpén/ })).toHaveAttribute('href', '/fotos/peninsula-hualpen.webp');
  expect(screen.getByRole('heading', { name: 'Mirada ambiental' })).toBeInTheDocument();
  expect(screen.getByText('Conservación versus loteo.')).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Mirada mapuche' })).not.toBeInTheDocument();
});

test('muestra el porcentaje de población indígena de una manzana o localidad', () => {
  const localidad = { censo: 2024, comuna: 'HUALQUI', localidad: 'AGUA DE LA GLORIA', total_personas: 275, personas_indigenas: 20, porc_indigena: 7.3,
    lengua_indigena: 4, total_personas_2017: 250, personas_indigenas_2017: 10, porc_indigena_2017: 4 };
  const { unmount } = render(<FeaturePopup properties={localidad} category="Población indígena · localidad rural" onClose={() => {}} />);
  expect(screen.getByRole('heading', { name: 'Agua de la gloria' })).toBeInTheDocument();
  expect(screen.getByText('Hualqui')).toBeInTheDocument();
  expect(screen.getByText('7,3 % · 20 de 275 personas')).toBeInTheDocument();
  expect(screen.getByText('4 personas')).toBeInTheDocument();
  expect(screen.getByText('4 % · 10 de 250 personas')).toBeInTheDocument(); // Comparación con 2017
  expect(screen.getByText(/^Censo 2024/)).toBeInTheDocument();
  unmount();
  // Las teselas omiten los campos vacíos: una manzana con la cifra reservada solo trae el total
  const { unmount: unmount2 } = render(<FeaturePopup properties={{ censo: 2024, comuna: 'LOTA', total_personas: 18, reservado: 1 }} category="Población indígena · manzana" onClose={() => {}} />);
  expect(screen.getByRole('heading', { name: 'Manzana censal' })).toBeInTheDocument();
  expect(screen.getByText('Dato reservado por el INE · 18 personas')).toBeInTheDocument();
  expect(screen.queryByText('Censo 2017')).not.toBeInTheDocument();
  unmount2();
  render(<FeaturePopup properties={{ censo: 2024, comuna: 'LOTA', total_personas: 0, reservado: 0 }} category="Población indígena · manzana" onClose={() => {}} />);
  expect(screen.getByText('Sin habitantes censados')).toBeInTheDocument();
});
