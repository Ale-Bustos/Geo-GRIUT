// Contenido del selector de capas: grupos, nombres visibles, símbolos y leyendas.
// Los símbolos reproducen cómo se dibuja cada capa
import type Map from 'ol/Map';
import SelectorCapas from './SelectorCapas';
import { findLayer, POBLACION_CLASES, POBLACION_RESERVADA } from './capas';
import { NAWELFUTA, FIOFIO_LEWFU, ANCA_LIGHEN } from './PinturaTerritorio';

export const crearSelectorCapas = (map: Map) => new SelectorCapas({
  titulo: 'Capas',
  grupos: [
    {
      titulo: 'Territorio',
      capas: [
        { capa: findLayer(map, 'Toponimia'), nombre: 'Toponimia', simbolo: { tipo: 'texto', color: '#000' } },
        { capa: findLayer(map, 'Límite Provincial'), nombre: 'Límite provincial', simbolo: { tipo: 'linea', color: '#8B4513', ancho: 1.5, guiones: '3 2' } },
        { capa: findLayer(map, NAWELFUTA.titulo), nombre: 'Cordillera de Nawelfuta', simbolo: { tipo: 'area', relleno: NAWELFUTA.color, borde: '#6E823C' } }
      ]
    },
    {
      titulo: 'Hidrografía',
      capas: [
        { capa: findLayer(map, FIOFIO_LEWFU.titulo), nombre: 'Fio-Fio Lewfu (río Biobío)', simbolo: { tipo: 'area', relleno: FIOFIO_LEWFU.color, borde: '#2B5090' } },
        { capa: findLayer(map, ANCA_LIGHEN.titulo), nombre: 'Anca-lighen', simbolo: { tipo: 'area', relleno: ANCA_LIGHEN.color, borde: '#2B5090' } },
        { capa: findLayer(map, 'Ríos'), nombre: 'Ríos', simbolo: { tipo: 'onda', color: '#6dceff', ancho: 2 } },
        { capa: findLayer(map, 'Esteros'), nombre: 'Esteros', simbolo: { tipo: 'onda', color: '#6dceff', ancho: 2 } },
        { capa: findLayer(map, 'Quebradas'), nombre: 'Quebradas', simbolo: { tipo: 'onda', color: '#6dceff', ancho: 2 } }
      ]
    },
    {
      titulo: 'Población indígena',
      nombreCorto: 'Población',
      capas: [
        {
          capa: findLayer(map, 'Población indígena por manzana'),
          nombre: 'Por manzana',
          simbolo: { tipo: 'area', relleno: '#BF812D', borde: '#FFFFFF' },
          leyenda: [...POBLACION_CLASES, POBLACION_RESERVADA].map((clase) => ({ simbolo: { tipo: 'area' as const, relleno: clase.color, borde: '#A8A29E' }, texto: clase.texto }))
        },
        {
          capa: findLayer(map, 'Población indígena por localidad'),
          nombre: 'Por localidad rural',
          simbolo: { tipo: 'area', relleno: '#DFC27D', borde: '#543005' }
        }
      ]
    },
    {
      titulo: 'Puntos de interés',
      chips: 'capas', // En celular, un chip por capa en vez de uno por grupo
      capas: [
        {
          capa: findLayer(map, 'Puntos de Resignificación'),
          nombre: 'Puntos de resignificación', nombreCorto: 'Resignificación',
          simbolo: { tipo: 'icono', src: '/simbologia/rewe.png' },
          leyenda: [
            { icono: '/simbologia/rewe.png', texto: 'Rewe' },
            { simbolo: { tipo: 'punto', color: 'purple' }, texto: 'Otra resignificación' }
          ]
        },
        {
          capa: findLayer(map, 'Puntos Historicos'),
          nombre: 'Puntos históricos', nombreCorto: 'Históricos',
          simbolo: { tipo: 'icono', src: '/simbologia/relevancia_historica.png' },
          leyenda: [
            { icono: '/simbologia/batalla.png', texto: 'Batalla' },
            { icono: '/simbologia/relevancia_historica.png', texto: 'Relevancia histórica' },
            { icono: '/simbologia/sitio_arqueologico.png', texto: 'Sitio arqueológico / conchal' }
          ]
        },
        {
          capa: findLayer(map, 'Conflictos Socio-Ambientales'),
          nombre: 'Conflictos socioambientales', nombreCorto: 'Conflictos',
          simbolo: { tipo: 'punto', color: 'red' }
        }
      ]
    }
  ]
});
