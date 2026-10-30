// Tutorial de bienvenida (textos propuestos por GRIUT; el mapudungun está por validar con las comunidades)
import TutorialMapa from './TutorialMapa';

// Clave de localStorage que recuerda que ya se vio el tutorial
export const TUTORIAL_KEY = 'tutorialMapa.visto.v1';

export const crearTutorial = (alCerrar: () => void) => new TutorialMapa({
  clave: TUTORIAL_KEY, // Cambia el sufijo de la clave para que todos lo vuelvan a ver
  alCerrar,
  pasos: [
    {
      saludo: 'Mari mari kom pu che',
      titulo: 'Bienvenida al mapa del territorio',
      texto: '<p>Recorre el territorio desde <i lang="arn">Lafkenmapu</i>, la costa, hasta <i lang="arn">Nawelfuta</i>, con sus nombres originales, sus <i lang="arn">rewe</i> y su memoria.</p>'
    },
    {
      titulo: 'Elige qué ver',
      texto: '<p>En <strong>Capas</strong> enciende o apaga ríos, esteros, límites y puntos de interés. Cada capa muestra su símbolo para reconocerla en el mapa.</p>',
      objetivo: '.sc-panel', // Escritorio: la tarjeta de capas
      objetivoMovil: '.sc-fab' // Celular: el botón de capas
    },
    {
      icono: '/simbologia/rewe.png',
      titulo: 'Puntos con historia',
      texto: '<p>Toca un punto para conocer su historia: <i lang="arn">rewe</i>, sitios arqueológicos, batallas y conflictos socioambientales del territorio.</p>'
    },
    {
      titulo: 'Los nombres del territorio',
      texto: '<p>Los lugares aparecen con su nombre en mapudungun: <i lang="arn">Peguko</i> (Penco), <i lang="arn">Tralkawenu</i> (Talcahuano), <i lang="arn">Fio-Fio Lewfu</i> (río Biobío).</p>'
    },
    {
      titulo: 'Orientarse con el meli witran mapu',
      texto: '<p>Las cuatro tierras indican la orientación: <i lang="arn">Puelmapu</i> al este, <i lang="arn">Pikunmapu</i> al norte, <i lang="arn">Willimapu</i> al sur y <i lang="arn">Lafkenmapu</i> al oeste, hacia el mar. Arrastra la brújula para girar el mapa.</p><p>Pewkallal, ¡buen recorrido!</p>',
      objetivo: '#compass'
    }
  ]
});
