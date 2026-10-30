// Recorrido "Del Lafkenmapu a Nawelfuta" (BORRADOR: los textos los valida GRIUT y el mapudungun,
// las comunidades). Cada capítulo dice dónde va la cámara y qué capas quedan encendidas.
// Fuentes de los significados:
// - Asta-Buruaga, "Diccionario geográfico de la República de Chile" (2ª ed., 1899), que cita al
//   padre Diego de Rosales: Andalién, Biobío, Chiguayante
// - Memoria Chilena, Biblioteca Nacional: "Toponimia chilena", topónimos de origen autóctono
//   (Nahuelbuta; tralka, "trueno", en Talca)
// - GRIUT, "Descripción topónimos y conflictos": Wallpen, Millawinkul, Manquemávida, miradas
// - Subdere: Hualpén, "mira a tu alrededor"
import type { DefinicionRecorrido } from './Recorrido';
import { NAWELFUTA, FIOFIO_LEWFU, ANCA_LIGHEN } from './PinturaTerritorio';

// Contexto que acompaña a casi todos los capítulos: nombres del territorio y agua
const NOMBRES_Y_AGUA = ['Toponimia', 'Ríos', 'Esteros'];
const CONFLICTOS = 'Conflictos Socio-Ambientales';
const ASTA_BURUAGA = 'Asta-Buruaga, Diccionario geográfico de la República de Chile (1899)';

export const RECORRIDO_TERRITORIO: DefinicionRecorrido = {
  id: 'lafkenmapu-nawelfuta',
  titulo: 'Del Lafkenmapu a Nawelfuta',
  capitulos: [
    {
      saludo: 'Mari mari kom pu che',
      titulo: 'Antes de los nombres de hoy',
      glosa: { nombre: 'Lafkenmapu', significado: 'tierra del mar' },
      texto: '<p>Este recorrido mira el territorio con el este arriba, como el <i lang="arn">meli witran mapu</i>: <i lang="arn">Puelmapu</i> al frente y el mar, <i lang="arn">Lafkenmapu</i>, a la espalda.</p><p>Cada cerro, río y caleta de la bahía tuvo antes su nombre en mapudungun, y cada nombre guarda una forma de mirar el lugar. Algunos los conocemos bien; otros hay que leerlos con cuidado. <i lang="arn">Peguko</i>, Penco, se ha traducido como «agua de peumo» y también como «divisando el agua».</p>',
      vista: { centro: [-73.08, -36.74], zoom: 10.8 },
      capas: [...NOMBRES_Y_AGUA]
    },
    {
      titulo: 'El cielo que truena',
      glosa: { nombre: 'Tralkawenu', significado: 'cielo tronador' },
      foto: { src: '/fotos/humedal-lenga.webp', credito: 'Resumen' },
      texto: '<p><i lang="arn">Tralka</i> es el trueno y <i lang="arn">wenu</i>, lo de arriba. Donde hoy está Talcahuano, el nombre recuerda un cielo que retumba sobre la península.</p><p>Sus humedales, como el de <i lang="arn">Lenka</i>, fueron rellenados y drenados para levantar industria y vivienda. Con ellos se pierde agua, hábitat y suelo firme: lo construido encima queda más expuesto a inundaciones y a la licuefacción en los terremotos.</p>',
      fuente: 'Tralka, «trueno»: Memoria Chilena, Biblioteca Nacional. Mirada del territorio: GRIUT.',
      vista: { centro: [-73.13, -36.75], zoom: 12.2 },
      capas: [...NOMBRES_Y_AGUA, CONFLICTOS]
    },
    {
      titulo: 'El mirador de la bahía',
      glosa: { nombre: 'Wallpen', significado: 'desde donde se mira todo alrededor' },
      foto: { src: '/fotos/peninsula-hualpen.webp', credito: 'Municipalidad de Hualpén' },
      texto: '<p>Desde la península de Hualpén se ve la bahía, el mar abierto y la desembocadura del <i lang="arn">Fio-Fio Lewfu</i>. Sus cerros, <i lang="arn">Millawinkul</i> y Reque, son cerros de abundancia.</p><p>Hoy en la península chocan dos miradas: quienes la cuidan como santuario de la naturaleza y espacio común, y quienes quieren lotearla por su paisaje. A su lado crece el polo industrial de la refinería.</p>',
      fuente: 'Significado: GRIUT; la Subdere lo traduce como «mira a tu alrededor».',
      vista: { centro: [-73.16, -36.79], zoom: 12.4 },
      capas: [...NOMBRES_Y_AGUA, CONFLICTOS]
    },
    {
      icono: '/simbologia/batalla.png',
      titulo: 'Un río de plata',
      glosa: { nombre: 'Anca-lighen', significado: 'cuerpo de plata' },
      texto: '<p><i lang="arn">Anca</i> es cuerpo y <i lang="arn">lighen</i>, plata: un río que brilla. El cronista Diego de Rosales anotó otro nombre, <i lang="arn">Antulien</i>, «plata de sol».</p><p>En sus orillas se libró en 1550 la batalla de Andalién, uno de los primeros enfrentamientos entre el pueblo mapuche y los españoles. Hoy el río corre encajonado entre la ciudad, y cada crecida recuerda que el agua conserva su espacio.</p>',
      fuente: ASTA_BURUAGA + ', citando a Diego de Rosales.',
      vista: { centro: [-72.98, -36.78], zoom: 12 },
      capas: [...NOMBRES_Y_AGUA, ANCA_LIGHEN.titulo, 'Puntos Historicos']
    },
    {
      titulo: 'El Gran Río',
      glosa: { nombre: 'Fio-Fio', significado: 'el sonido de las olas mansas' },
      texto: '<p>Rosales escribió que el nombre imita «el sonido que hacen las olas mansas cuando se encrespan», porque el río hace olas como el mar. También lo llamaban Gran Río.</p><p>En la mirada mapuche, su cauce es un camino para el descanso de las almas que parten, y en él habita un espíritu desde su nacimiento hasta la desembocadura. Su agua es necesaria en las ceremonias. Hoy recibe desechos, represas y extracción de áridos.</p>',
      fuente: ASTA_BURUAGA + ', citando a Rosales. Mirada mapuche: GRIUT.',
      vista: { centro: [-73.07, -36.86], zoom: 11.8 },
      capas: [...NOMBRES_Y_AGUA, FIOFIO_LEWFU.titulo]
    },
    {
      titulo: 'Entre la neblina',
      glosa: { nombre: 'Chiwayantu', significado: 'día de neblina' },
      foto: { src: '/fotos/ruka-chiguayante.webp', credito: 'Colectiva La Zarzamora' },
      texto: '<p><i lang="arn">Chiway</i> es la neblina y <i lang="arn">antü</i>, el sol y el día. Chiguayante amanece así, con la niebla del río subiendo hacia los cerros.</p><p>Sobre la ciudad está el <i lang="arn">Manquemávida</i>, de <i lang="arn">mañke</i>, cóndor, y <i lang="arn">mawida</i>, cerro: un <i lang="arn">txen txen</i> con cascadas, esteros y bosque nativo de donde sale medicina. Abajo, el borde del río enfrenta la presión inmobiliaria, y una comunidad busca levantar su <i lang="arn">ruka</i>.</p>',
      fuente: 'Chiguayante: ' + ASTA_BURUAGA + '. Manquemávida y miradas: GRIUT.',
      vista: { centro: [-73.03, -36.93], zoom: 12.2 },
      capas: [...NOMBRES_Y_AGUA, 'Puntos de Resignificación', CONFLICTOS]
    },
    {
      icono: '/simbologia/sitio_arqueologico.png',
      titulo: 'Memoria bajo tierra',
      glosa: { nombre: 'Chemamüll', significado: 'gente de madera' },
      texto: '<p>En la costa de Coronel, los conchales y los <i lang="arn">chemamüll</i> de Playa Maule guardan la memoria de quienes vivieron de este mar mucho antes de la ciudad. Un poco más al sur, en Marihueñu, se libró en 1554 una de las batallas más recordadas de la guerra de Arauco.</p><p>Hoy esta misma costa reúne termoeléctricas y pesqueras industriales, y los pescadores artesanales defienden sus aguas.</p>',
      vista: { centro: [-73.17, -37.06], zoom: 11.6 },
      capas: [...NOMBRES_Y_AGUA, 'Puntos Historicos', CONFLICTOS]
    },
    {
      icono: '/simbologia/rewe.png',
      titulo: 'Rewe en la ciudad',
      foto: { src: '/fotos/rewe-lafken-palife.webp', credito: 'Radio Aukinko' },
      texto: '<p>El <i lang="arn">rewe</i> es el altar donde se hace la ceremonia. Hoy vuelve a levantarse en la ciudad: en Barrio Norte, en Guayo, en <i lang="arn">Lafken Palife</i> y en el cerro Chepe, un cerro sagrado que hoy atraviesa un túnel ferroviario.</p><p>Tomas, ceremonias y manifestaciones vuelven a nombrar el territorio. Toca un punto para conocer su historia.</p>',
      fuente: 'Mirada del territorio: GRIUT.',
      vista: { centro: [-73.08, -36.955], zoom: 10.8 },
      capas: [...NOMBRES_Y_AGUA, 'Puntos de Resignificación']
    },
    {
      titulo: 'Quiénes habitan hoy',
      texto: '<p>Según el Censo 2024, 66.187 personas de las manzanas urbanas del Gran Concepción y 1.545 de sus localidades rurales se consideran parte de un pueblo originario. El color muestra el porcentaje en cada manzana.</p><p>Toca una manzana para ver su dato y compararlo con 2017.</p>',
      fuente: 'INE, Censo de Población y Vivienda 2024 y Censo 2017.',
      vista: { centro: [-73.05, -36.83], zoom: 13 },
      capas: ['Toponimia', 'Población indígena por manzana']
    },
    {
      titulo: 'La cordillera del nawel',
      glosa: { nombre: 'Nawelfuta', significado: 'cordillera donde hay tigres grandes' },
      texto: '<p><i lang="arn">Nawel</i> es el felino que los cronistas llamaron tigre y <i lang="arn">futa</i>, grande. La cordillera de la costa cierra el horizonte del territorio por el sur.</p><p>Gran parte de ella está cubierta por monocultivos de pino y eucalipto, que traen sequía, pérdida de biodiversidad y riesgo de incendios, y la ciudad sube por sus cerros buscando vista. Seguir nombrándola <i lang="arn">Nawelfuta</i> es también una forma de cuidarla.</p><p>Pewkallal, ¡buen recorrido!</p>',
      fuente: 'Significado: Memoria Chilena, Biblioteca Nacional. Mirada del territorio: GRIUT.',
      vista: { centro: [-73.1, -37.1], zoom: 10.2 },
      capas: [...NOMBRES_Y_AGUA, NAWELFUTA.titulo, FIOFIO_LEWFU.titulo]
    }
  ]
};
