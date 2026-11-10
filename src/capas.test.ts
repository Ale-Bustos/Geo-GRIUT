import LayerGroup from 'ol/layer/Group';
import VectorTileLayer from 'ol/layer/VectorTile';
import type BaseLayer from 'ol/layer/Base';
import type VectorTileSource from 'ol/source/VectorTile';
import { COBERTURA_Z16, createLayers } from './capas';

// Fuentes de teselas vectoriales del esquema griut, por título de capa
const fuentesTeselas = () => {
  const capas: BaseLayer[] = [];
  const recorrer = (capa: BaseLayer) => (capa instanceof LayerGroup ? capa.getLayers().forEach(recorrer) : capas.push(capa));
  createLayers().forEach(recorrer);
  return capas.filter((capa): capa is VectorTileLayer => capa instanceof VectorTileLayer)
    .map((capa) => capa.getSource() as VectorTileSource);
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
  expect(fuentes).toHaveLength(Object.keys(COBERTURA_Z16).length);
  for (const fuente of fuentes) {
    const url = fuente.getUrls()![0];
    const capa = Object.keys(COBERTURA_Z16).find((nombre) => url.includes(`:${nombre}@`) || url.includes(`/teselas/${nombre}/`));
    expect(capa, url).toBeDefined();
    expect(rangoTms(fuente, 16)).toEqual(COBERTURA_Z16[capa!]);
  }
});

test('en zooms lejanos el rango coincide con la cobertura de GeoWebCache (Límite provincial)', () => {
  const limite = fuentesTeselas().find((fuente) => fuente.getUrls()![0].includes(':prov_conce@'))!;
  // Coberturas informadas por GeoWebCache para griut:prov_conce
  expect(rangoTms(limite, 9)).toEqual([151, 198, 152, 200]);
  expect(rangoTms(limite, 10)).toEqual([302, 396, 305, 400]);
  expect(rangoTms(limite, 12)).toEqual([1211, 1587, 1220, 1602]);
  expect(rangoTms(limite, 14)).toEqual([4844, 6351, 4883, 6408]);
});
