// Recorrido "Del Lafkenmapu a Nawelfuta" (BORRADOR: los textos los valida GRIUT y el mapudungun,
// las comunidades). Cada capítulo dice dónde va la cámara y qué capas quedan encendidas
import type { DefinicionRecorrido } from './Recorrido';
import { NAWELFUTA, FIOFIO_LEWFU, ANCA_LIGHEN } from './PinturaTerritorio';

// Contexto que acompaña a casi todos los capítulos: nombres del territorio y agua
const NOMBRES_Y_AGUA = ['Toponimia', 'Ríos', 'Esteros'];

export const RECORRIDO_TERRITORIO: DefinicionRecorrido = {
  id: 'lafkenmapu-nawelfuta',
  titulo: 'Del Lafkenmapu a Nawelfuta',
  capitulos: [
    {
      saludo: 'Mari mari kom pu che',
      titulo: 'Lafkenmapu, la tierra del mar',
      texto: '<p>El recorrido empieza en la costa, en <i lang="arn">Lafkenmapu</i>. Antes de los nombres que hoy conocemos, la bahía ya tenía los suyos: <i lang="arn">Tralkawenu</i> (Talcahuano), <i lang="arn">Peguko</i> (Penco), <i lang="arn">Lenka</i>.</p>',
      vista: { centro: [-73.1, -36.74], zoom: 11.3 },
      capas: [...NOMBRES_Y_AGUA]
    },
    {
      titulo: 'Fio-Fio Lewfu',
      texto: '<p>El río que hoy llamamos Biobío es <i lang="arn">Fio-Fio Lewfu</i>. Por siglos fue camino, alimento y frontera, y sigue ordenando la vida de todo el territorio.</p>',
      vista: { centro: [-73.07, -36.86], zoom: 11.8 },
      capas: [...NOMBRES_Y_AGUA, FIOFIO_LEWFU.titulo]
    },
    {
      icono: '/simbologia/batalla.png',
      titulo: 'Anca-lighen',
      texto: '<p>El río Andalién es <i lang="arn">Anca-lighen</i>. En su desembocadura se libró en 1550 la batalla de Andalién, uno de los primeros enfrentamientos entre el pueblo mapuche y los españoles.</p><p>Toca el símbolo para leer más.</p>',
      vista: { centro: [-72.98, -36.78], zoom: 12 },
      capas: [...NOMBRES_Y_AGUA, ANCA_LIGHEN.titulo, 'Puntos Historicos']
    },
    {
      icono: '/simbologia/sitio_arqueologico.png',
      titulo: 'Memoria bajo tierra',
      texto: '<p>En la costa de Coronel, los conchales y los <i lang="arn">chemamüll</i> de Playa Maule guardan la memoria de quienes habitaron este borde mucho antes de la ciudad.</p>',
      vista: { centro: [-73.17, -37.01], zoom: 12.3 },
      capas: [...NOMBRES_Y_AGUA, 'Puntos Historicos']
    },
    {
      icono: '/simbologia/rewe.png',
      titulo: 'Rewe en la ciudad',
      texto: '<p>Hoy el territorio también se resignifica: <i lang="arn">rewe</i> levantados en Barrio Norte, en Guayo y en <i lang="arn">Lafken Palife</i>, tomas y manifestaciones que vuelven a nombrar la ciudad.</p><p>Toca un punto para conocer su historia.</p>',
      vista: { centro: [-73.08, -36.955], zoom: 10.8 },
      capas: [...NOMBRES_Y_AGUA, 'Puntos de Resignificación']
    },
    {
      titulo: 'Quiénes habitan hoy',
      texto: '<p>Según el Censo 2024, 66.187 personas de las manzanas censales del Gran Concepción se consideran parte de un pueblo originario. El color muestra el porcentaje en cada manzana.</p><p>Toca una manzana para ver su dato y compararlo con 2017.</p>',
      vista: { centro: [-73.05, -36.83], zoom: 13 },
      capas: ['Toponimia', 'Población indígena por manzana']
    },
    {
      titulo: 'Nawelfuta',
      texto: '<p>Al sur se levanta <i lang="arn">Nawelfuta</i>, la cordillera de la costa que cierra el horizonte del territorio.</p><p>Pewkallal, ¡buen recorrido!</p>',
      vista: { centro: [-73.1, -37.1], zoom: 10.2 },
      capas: [...NOMBRES_Y_AGUA, NAWELFUTA.titulo, FIOFIO_LEWFU.titulo]
    }
  ]
};
