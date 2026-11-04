import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FichaLugar from './FichaLugar';
import { olvidarLugares } from './lugares';
import { servirPublic } from './pruebas';

beforeEach(() => {
  olvidarLugares();
  vi.stubGlobal('fetch', servirPublic()); // API caída: los relacionados salen de los GeoJSON locales
});

afterEach(() => vi.unstubAllGlobals());

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

test('muestra título, categoría, descripción y solo los campos con información (mapeo Copia_de_*)', () => {
  render(<FichaLugar properties={conflicto} category="Conflicto socioambiental" onClose={() => {}} />);
  expect(screen.getByRole('heading', { name: 'Terminal GNL Penco-Lirquen' })).toBeInTheDocument();
  expect(screen.getByText('Conflicto Socioambiental')).toBeInTheDocument();
  expect(screen.getByText('Eje temático')).toBeInTheDocument();
  expect(screen.getByText('Industrialización')).toBeInTheDocument();
  expect(screen.getByText('Si')).toBeInTheDocument();
  expect(screen.getByText('Participación indígena')).toBeInTheDocument();
  expect(screen.getByText('Organizaciones indígenas')).toBeInTheDocument();
  expect(screen.getByText('Instalación terminal marítimo GNL')).toBeInTheDocument(); // Copia_de_T: descripción
  // null y "-" se consideran vacíos
  expect(screen.queryByText('Sector')).not.toBeInTheDocument();
  expect(screen.queryByText('Otras organizaciones')).not.toBeInTheDocument();
});

test('muestra las fuentes como texto y enlaces seguros', () => {
  render(<FichaLugar properties={conflicto} category="Conflicto socioambiental" onClose={() => {}} />);
  expect(screen.getByText('Actas municipales')).toBeInTheDocument();
  const link = screen.getByRole('link', { name: 'example.org' });
  expect(link).toHaveAttribute('href', 'https://www.example.org/informe.pdf');
  expect(link).toHaveAttribute('rel', 'noopener noreferrer');
});

test('usa la categoría de la capa cuando el punto no trae una', () => {
  render(<FichaLugar properties={{ Name: 'Batalla de Andalien' }} category="Punto histórico" onClose={() => {}} />);
  expect(screen.getByText('Punto histórico')).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Batalla de Andalien' })).toBeInTheDocument();
  expect(screen.queryByText('Fuentes')).not.toBeInTheDocument();
});

test('numera los enlaces que son del mismo sitio', () => {
  const properties = { Name: 'Proyecto', Copia_de10: 'https://seia.sea.gob.cl/a https://seia.sea.gob.cl/b https://otro.cl/c' };
  render(<FichaLugar properties={properties} category="Conflicto socioambiental" onClose={() => {}} />);
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
  render(<FichaLugar properties={properties} category="Conflicto socioambiental" onClose={() => {}} />);
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
  const { unmount } = render(<FichaLugar properties={localidad} category="Población indígena · localidad rural" onClose={() => {}} />);
  expect(screen.getByRole('heading', { name: 'Agua de la gloria' })).toBeInTheDocument();
  expect(screen.getByText('Hualqui')).toBeInTheDocument();
  expect(screen.getByText('7,3 % · 20 de 275 personas')).toBeInTheDocument();
  expect(screen.getByText('4 personas')).toBeInTheDocument();
  expect(screen.getByText('4 % · 10 de 250 personas')).toBeInTheDocument(); // Comparación con 2017
  expect(screen.getByText(/^Censo 2024/)).toBeInTheDocument();
  unmount();
  // Las teselas omiten los campos vacíos: una manzana con la cifra reservada solo trae el total
  const { unmount: unmount2 } = render(<FichaLugar properties={{ censo: 2024, comuna: 'LOTA', total_personas: 18, reservado: 1 }} category="Población indígena · manzana" onClose={() => {}} />);
  expect(screen.getByRole('heading', { name: 'Manzana censal' })).toBeInTheDocument();
  expect(screen.getByText('Dato reservado por el INE · 18 personas')).toBeInTheDocument();
  expect(screen.queryByText('Censo 2017')).not.toBeInTheDocument();
  unmount2();
  render(<FichaLugar properties={{ censo: 2024, comuna: 'LOTA', total_personas: 0, reservado: 0 }} category="Población indígena · manzana" onClose={() => {}} />);
  expect(screen.getByText('Sin habitantes censados')).toBeInTheDocument();
});

test('sin datos del GRIUT no muestra desglose, audio, imágenes ni fuentes, y sin id no hay compartir ni relacionados', async () => {
  render(<FichaLugar properties={{ Name: 'Ulchakura' }} category="Topónimo" onClose={() => {}} />);
  expect(screen.getByRole('dialog', { name: 'Ulchakura' })).toBeInTheDocument();
  for (const seccion of ['Desglose del nombre', 'Pronunciación', 'Fuentes', 'Lugares relacionados']) {
    expect(screen.queryByRole('heading', { name: seccion })).not.toBeInTheDocument();
  }
  expect(screen.queryByRole('region', { name: 'Imágenes' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Compartir/ })).not.toBeInTheDocument();
  expect(fetch).not.toHaveBeenCalled();
});

test('el nombre en mapudungun tiene precedencia y el de los datos queda debajo', () => {
  const properties = { PopupInfo: 'Río Andalién', NombreMapudungun: 'Anca-lighen' };
  render(<FichaLugar properties={properties} category="Topónimo" onClose={() => {}} />);
  const titulo = screen.getByRole('heading', { level: 2 });
  expect(titulo).toHaveTextContent('Anca-lighen');
  expect(titulo).toHaveAttribute('lang', 'arn');
  expect(screen.getByText('Río Andalién')).toBeInTheDocument();
});

test('muestra el desglose y el audio solo con datos válidos', () => {
  const properties = {
    Name: 'Lugar de prueba',
    Desglose: [{ parte: 'aaa', significado: 'primera parte' }, { parte: '', significado: 'sin parte: se omite' }],
    Audio: { src: '/audio/prueba.mp3', credito: 'Grabación de prueba' }
  };
  render(<FichaLugar properties={properties} category="Topónimo" onClose={() => {}} />);
  expect(screen.getByRole('heading', { name: 'Desglose del nombre' })).toBeInTheDocument();
  expect(screen.getByText('aaa')).toHaveAttribute('lang', 'arn');
  expect(screen.getByText('primera parte')).toBeInTheDocument();
  expect(screen.queryByText('sin parte: se omite')).not.toBeInTheDocument();
  expect(screen.getByLabelText('Pronunciación de Lugar de prueba')).toHaveAttribute('src', '/audio/prueba.mp3');
  expect(screen.getByText('Grabación de prueba')).toBeInTheDocument();
});

test('al abrir, el foco va al título; Esc cierra; al desmontar, el foco vuelve a donde estaba', async () => {
  const antes = document.createElement('button');
  document.body.append(antes);
  antes.focus();
  const onClose = vi.fn();
  const { unmount } = render(<FichaLugar properties={{ Name: 'Wallpen' }} category="Topónimo" onClose={onClose} />);
  expect(screen.getByRole('heading', { name: 'Wallpen' })).toHaveFocus();
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(onClose).toHaveBeenCalledTimes(1);
  unmount();
  expect(antes).toHaveFocus();
  antes.remove();
});

test('Tab y Mayús+Tab dan la vuelta dentro de la ficha', async () => {
  const user = userEvent.setup();
  render(<FichaLugar properties={{ Name: 'Proyecto', Copia_de10: 'https://otro.cl/c' }} category="Conflicto socioambiental"
    lugar={{ capa: 'conflictos', id: 2 }} onClose={() => {}} />);
  const enlace = screen.getByRole('link', { name: 'otro.cl' });
  await waitFor(() => expect(screen.getByRole('heading', { name: 'Lugares relacionados' })).toBeInTheDocument());
  const relacionados = screen.getAllByRole('button').filter((b) => b.closest('.ficha-relacionados'));
  const ultimo = relacionados[relacionados.length - 1];
  ultimo.focus();
  await user.tab();
  // Vuelve al primer control de la ficha (el asa en celular, compartir en escritorio)
  expect(screen.getByRole('dialog')).toContainElement(document.activeElement as HTMLElement);
  expect(document.activeElement).toHaveClass(/ficha-(asa|boton)/);
  await user.tab({ shift: true });
  expect(ultimo).toHaveFocus();
  enlace.focus();
  await user.tab();
  expect(relacionados[0]).toHaveFocus();
});

test('comparte el enlace del lugar con el menú del sistema', async () => {
  const share = vi.fn(async () => {});
  vi.stubGlobal('navigator', { ...navigator, share });
  render(<FichaLugar properties={{ PopupInfo: 'Terminal GNL' }} category="Conflicto socioambiental"
    lugar={{ capa: 'conflictos', id: 3 }} onClose={() => {}} />);
  await userEvent.click(screen.getByRole('button', { name: 'Compartir enlace a Terminal GNL' }));
  expect(share).toHaveBeenCalledWith({ title: 'Terminal GNL', url: window.location.origin + '/?lugar=conflictos%3A3' });
  expect(screen.getByRole('status')).toBeEmptyDOMElement();
});

test('sin Web Share copia el enlace y lo avisa', async () => {
  const writeText = vi.fn(async () => {});
  vi.stubGlobal('navigator', { ...navigator, share: undefined, clipboard: { writeText } });
  render(<FichaLugar properties={{ PopupInfo: 'Terminal GNL' }} category="Conflicto socioambiental"
    lugar={{ capa: 'conflictos', id: 3 }} onClose={() => {}} />);
  await userEvent.click(screen.getByRole('button', { name: /Compartir/ }));
  expect(writeText).toHaveBeenCalledWith(window.location.origin + '/?lugar=conflictos%3A3');
  expect(await screen.findByRole('status')).toHaveTextContent('Enlace copiado');
});

test('los relacionados abren su ficha al elegirlos (calculados sin API)', async () => {
  const onElegir = vi.fn();
  render(<FichaLugar properties={{ Name: 'Anca-lighen' }} category="Topónimo" lugar={{ capa: 'toponimos', id: 1 }}
    onClose={() => {}} onElegirRelacionado={onElegir} />);
  const boton = await screen.findByRole('button', { name: /Batalla de Andalien/ });
  expect(boton).toHaveTextContent(/Punto histórico · \d+ m/);
  await userEvent.click(boton);
  expect(onElegir).toHaveBeenCalledWith({ capa: 'puntos-historicos', id: 3 });
});

test('los relacionados vienen de la API cuando responde', async () => {
  vi.stubGlobal('fetch', servirPublic((url) => (url.includes('/relacionados')
    ? Response.json([{ capa: 'conflictos', id: 2, nombre: 'x', distancia_m: 2345 }]) : undefined)));
  render(<FichaLugar properties={{ PopupInfo: 'Pescadores vs Central Santa María' }} category="Conflicto socioambiental"
    lugar={{ capa: 'conflictos', id: 1 }} onClose={() => {}} />);
  expect(await screen.findByRole('button', { name: /2,3 km/ })).toHaveTextContent('Conflicto socioambiental · 2,3 km');
});

test('la hoja inferior cambia de altura con el asa (toque y flechas)', async () => {
  render(<FichaLugar properties={{ Name: 'Wallpen' }} category="Topónimo" onClose={() => {}} />);
  const asa = screen.getByRole('button', { name: /Altura de la ficha: media/ });
  await userEvent.click(asa);
  expect(asa).toHaveAccessibleName(/completa/);
  fireEvent.keyDown(asa, { key: 'ArrowDown' });
  fireEvent.keyDown(asa, { key: 'ArrowDown' });
  expect(asa).toHaveAccessibleName(/baja/);
  await act(async () => { fireEvent.keyDown(asa, { key: 'ArrowUp' }); });
  expect(asa).toHaveAccessibleName(/media/);
});
