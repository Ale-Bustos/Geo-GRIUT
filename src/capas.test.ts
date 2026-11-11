import LayerGroup from 'ol/layer/Group';
import VectorTileLayer from 'ol/layer/VectorTile';
import { get as getProjection } from 'ol/proj';
import type BaseLayer from 'ol/layer/Base';
import type VectorTileSource from 'ol/source/VectorTile';
import type { TileCoord } from 'ol/tilecoord';
import { COBERTURA_Z16, createLayers, geoServerTileUrl } from './capas';

const EPSG_3857 = getProjection('EPSG:3857')!;

// URL que la fuente pide para una tesela
const urlTesela = (fuente: VectorTileSource, coord: TileCoord) => fuente.getTileUrlFunction()(coord, 1, EPSG_3857)!;

// Fuentes de teselas vectoriales del esquema griut, con el nombre de su capa
const fuentesTeselas = () => {
  const capas: BaseLayer[] = [];
  const recorrer = (capa: BaseLayer) => (capa instanceof LayerGroup ? capa.getLayers().forEach(recorrer) : capas.push(capa));
  createLayers().forEach(recorrer);
  return capas.filter((capa): capa is VectorTileLayer => capa instanceof VectorTileLayer).map((capa) => {
    const fuente = capa.getSource() as VectorTileSource;
    const url = urlTesela(fuente, [12, 0, 0]);
    const nombre = /griut:([a-z0-9_]+)@|\/teselas\/([a-z0-9_]+)\//.exec(url)!;
    return { capa: nombre[1] ?? nombre[2], fuente };
  });
};

// Rango de teselas que la fuente pediría en un zoom, en numeración TMS como la informa GeoWebCache
const rangoTms = (fuente: VectorTileSource, z: number) => {
  const grilla = fuente.getTileGrid()!;
  const rango = grilla.getTileRangeForExtentAndZ(grilla.getExtent()!, z);
  const filas = 2 ** z;
  return [rango.minX, filas - 1 - rango.maxY, rango.maxX, filas - 1 - rango.minY];
};

test('cada capa de GeoServer pide solo las teselas que GeoWebCache tiene', () => {
  const fuentes = fuentesTeselas();
  expect(fuentes.map(({ capa }) => capa).sort()).toEqual(Object.keys(COBERTURA_Z16).sort());
  for (const { capa, fuente } of fuentes) {
    expect(rangoTms(fuente, 16), capa).toEqual(COBERTURA_Z16[capa]);
  }
});

test('en zooms lejanos el rango coincide con la cobertura de GeoWebCache (Límite provincial)', () => {
  const limite = fuentesTeselas().find(({ capa }) => capa === 'prov_conce')!.fuente;
  // Coberturas informadas por GeoWebCache para griut:prov_conce
  expect(rangoTms(limite, 9)).toEqual([151, 198, 152, 200]);
  expect(rangoTms(limite, 10)).toEqual([302, 396, 305, 400]);
  expect(rangoTms(limite, 12)).toEqual([1211, 1587, 1220, 1602]);
  expect(rangoTms(limite, 14)).toEqual([4844, 6351, 4883, 6408]);
});

test('la URL de GeoServer usa la fila TMS del mundo, no la de la grilla recortada', () => {
  // Centro de Concepción en z12: XYZ 1216/2498 → TMS 1216/1597 (tesela con manzanas censales)
  expect(geoServerTileUrl('poblacion_indigena_mz_2024', [12, 1216, 2498]))
    .toMatch(/griut:poblacion_indigena_mz_2024@EPSG:900913@pbf\/12\/1216\/1597\.pbf$/);
  for (const { capa, fuente } of fuentesTeselas()) {
    if (capa === 'rios') continue; // XYZ desde la API; el respaldo de GeoServer usa geoServerTileUrl
    const url = urlTesela(fuente, [12, 1216, 2498]);
    expect(url, capa).toMatch(/\/12\/1216\/1597\.pbf$/);
  }
});
