import {
  CAPAS_LUGAR, cargarLugares, distanciaM, enlaceLugar, escribirLugarUrl, leerClaveLugar, leerLugarUrl,
  obtenerRelacionados, olvidarLugares, relacionadosLocales, type CapaLugar, type Lugar
} from './lugares';
import { GEOJSON_PUBLIC, servirPublic } from './pruebas';

beforeEach(() => {
  olvidarLugares();
  window.history.replaceState(null, '', '/');
});

afterEach(() => vi.unstubAllGlobals());

test('cada GeoJSON de lugares tiene ids enteros, positivos y únicos (los mismos de griut.*)', () => {
  for (const { url } of Object.values(CAPAS_LUGAR)) {
    const { features } = JSON.parse(GEOJSON_PUBLIC[url]) as { features: { id: unknown }[] };
    const ids = features.map((f) => f.id);
    expect(ids.every((id) => Number.isInteger(id) && (id as number) > 0), url).toBe(true);
    expect(new Set(ids).size, url).toBe(ids.length);
  }
});

test('lee solo claves <capa>:<id> con una capa conocida y un id entero positivo', () => {
  expect(leerClaveLugar('conflictos:12')).toEqual({ capa: 'conflictos', id: 12 });
  expect(leerClaveLugar('puntos-historicos:1')).toEqual({ capa: 'puntos-historicos', id: 1 });
  for (const mala of ['rios:1', 'conflictos:0', 'conflictos:-1', 'conflictos:1.5', 'conflictos:1e3', 'conflictos:',
    'conflictos', ':3', 'conflictos:3:4', 'constructor:1', '__proto__:1', 'conflictos:9999999999', '', null]) {
    expect(leerClaveLugar(mala), String(mala)).toBeNull();
  }
});

test('escribe el lugar en la URL sin tocar los demás parámetros y arma un enlace limpio', () => {
  window.history.replaceState(null, '', '/?recorrido=lafkenmapu-nawelfuta&paso=2');
  escribirLugarUrl({ capa: 'toponimos', id: 3 });
  expect(window.location.search).toBe('?recorrido=lafkenmapu-nawelfuta&paso=2&lugar=toponimos%3A3');
  expect(leerLugarUrl()).toEqual({ capa: 'toponimos', id: 3 });
  expect(enlaceLugar({ capa: 'toponimos', id: 3 })).toBe(window.location.origin + '/?lugar=toponimos%3A3');
  escribirLugarUrl(null);
  expect(window.location.search).toBe('?recorrido=lafkenmapu-nawelfuta&paso=2');
});

test('la distancia es la del círculo máximo', () => {
  // Un grado de latitud ≈ 111,2 km
  expect(distanciaM({ lon: -73, lat: -36 }, { lon: -73, lat: -37 })).toBeCloseTo(111195, -1);
});

const lugar = (capa: CapaLugar, id: number, lon: number, lat: number): Lugar =>
  ({ capa, id, lon, lat, nombre: `${capa} ${id}`, propiedades: {} });

test('los relacionados locales excluyen el lugar, respetan el radio y el límite por capa', () => {
  const origen = lugar('conflictos', 1, -73, -36.8);
  const lugares = [
    origen,
    lugar('conflictos', 2, -73, -36.81), // ~1,1 km
    lugar('conflictos', 3, -73, -36.82), // ~2,2 km
    lugar('conflictos', 4, -73, -36.83), // ~3,3 km: pasa el límite de 2 por capa
    lugar('toponimos', 1, -73, -36.805), // ~0,6 km
    lugar('toponimos', 2, -73, -37) // ~22 km: fuera del radio
  ];
  const relacionados = relacionadosLocales(lugares, origen, 5000, 2);
  expect(relacionados.map((r) => `${r.capa}:${r.id}`)).toEqual(['toponimos:1', 'conflictos:2', 'conflictos:3']);
  expect(relacionados[0].distancia_m).toBe(556);
});

test('sin API, los relacionados se calculan con los GeoJSON locales', async () => {
  vi.stubGlobal('fetch', servirPublic());
  const lugares = await cargarLugares();
  expect(lugares).toHaveLength(60);
  const relacionados = await obtenerRelacionados({ capa: 'toponimos', id: 1 });
  expect(relacionados.length).toBeGreaterThan(0);
  expect(relacionados.some((r) => r.capa === 'toponimos' && r.id === 1)).toBe(false);
  expect(relacionados.every((r) => r.distancia_m <= 5000)).toBe(true);
});

test('con API, usa sus relacionados con el nombre de los datos locales', async () => {
  const api = vi.fn(() => Response.json([
    { capa: 'puntos-historicos', id: 3, nombre: 'Nombre de la base', distancia_m: 886 },
    { capa: 'rios', id: 1, nombre: 'Capa desconocida', distancia_m: 900 }
  ]));
  vi.stubGlobal('fetch', servirPublic(api));
  const relacionados = await obtenerRelacionados({ capa: 'toponimos', id: 1 });
  expect(api).toHaveBeenCalledWith(expect.stringContaining('/api/lugares/toponimos/1/relacionados?radio=5000'));
  expect(relacionados).toEqual([{ capa: 'puntos-historicos', id: 3, nombre: 'Batalla de Andalien', distancia_m: 886 }]);
});

test('sin API ni datos locales no hay relacionados', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('sin red'); }));
  expect(await obtenerRelacionados({ capa: 'toponimos', id: 1 })).toEqual([]);
});
