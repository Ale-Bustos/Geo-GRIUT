// Qué muestra la ficha de cada lugar y de qué columna sale. Los nombres de columna vienen de la
// exportación del SIG ("Copia_de_…"), así que aquí se asocia cada uno a una etiqueta legible.

export type Propiedades = Record<string, unknown>;

// Campos que completará el GRIUT. Las claves son PROVISORIAS hasta que el GRIUT las confirme:
// cambiarlas aquí basta. Mientras ningún lugar las traiga, sus secciones no aparecen
export const CAMPOS_GRIUT = {
  nombreMapudungun: 'NombreMapudungun', // Texto: tiene precedencia como título de la ficha
  desglose: 'Desglose', // Lista de { parte, significado }: partes del topónimo y qué significa cada una
  audio: 'Audio' // { src, credito }: pronunciación del nombre
} as const;

// Descripción del lugar: la de la investigación (Copia_de_T) o la de los puntos de KML (descriptio)
export const CAMPOS_DESCRIPCION = [
  { key: 'Copia_de_T', label: 'Descripción' },
  { key: 'descriptio', label: 'Descripción' }
];

// Otros campos que se muestran, en orden
export const CAMPOS_DETALLE = [
  { key: 'Copia_de_1', label: 'Eje temático' },
  { key: 'Copia_de_2', label: 'Comuna' },
  { key: 'Copia_de_3', label: 'Sector' },
  { key: 'Copia_de_6', label: 'Organizaciones indígenas' },
  { key: 'Copia_de_4', label: 'Otras organizaciones' },
  { key: 'Copia_de_5', label: 'Participación indígena' },
  { key: 'Copia_de_7', label: 'Instrumento de planificación' },
  { key: 'PoliticasPublicas', label: 'Políticas públicas' },
  { key: 'PoliticaIndigena', label: 'Política pública indígena' }
];

// Textos de la investigación de GRIUT sobre cada lugar: dos maneras de mirarlo
export const MIRADAS = [
  { key: 'MiradaAmbiental', label: 'Mirada ambiental' },
  { key: 'MiradaMapuche', label: 'Mirada mapuche' }
];

// Campos con enlaces a fuentes; pueden traer varias URL separadas por espacios
const LINK_FIELDS = ['Copia_de10', 'Copia_de12'];

// Valores que en los datos significan "sin información"
export const isEmpty = (value: unknown) => value === null || value === undefined || String(value).trim() === '' || String(value).trim() === '-';

export const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

const texto = (value: unknown) => (isEmpty(value) ? '' : String(value).trim());

// Nombre con que la capa identifica al lugar (el de los datos originales)
export const nombreOriginal = (p: Propiedades) => texto(p.PopupInfo) || texto(p.Name) || texto(p.Nombre);

/** Título de la ficha: el nombre en mapudungun si el GRIUT lo registró; si no, el de los datos. */
export const nombreLugar = (p: Propiedades) => texto(p[CAMPOS_GRIUT.nombreMapudungun]) || nombreOriginal(p);

/** Primera descripción con texto, o '' */
export const descripcionLugar = (p: Propiedades) =>
  CAMPOS_DESCRIPCION.map(({ key }) => texto(p[key])).find((d) => d !== '') ?? '';

export interface ParteDesglose {
  parte: string;
  significado: string;
}

export const parseDesglose = (value: unknown): ParteDesglose[] => (Array.isArray(value) ? value : [])
  .filter((v): v is ParteDesglose => typeof v === 'object' && v !== null
    && !isEmpty((v as ParteDesglose).parte) && !isEmpty((v as ParteDesglose).significado))
  .map((v) => ({ parte: String(v.parte).trim(), significado: String(v.significado).trim() }));

export interface Audio {
  src: string;
  credito?: string;
}

export const parseAudio = (value: unknown): Audio | null => {
  if (typeof value !== 'object' || value === null || isEmpty((value as Audio).src)) return null;
  const { src, credito } = value as Audio;
  return { src: String(src).trim(), credito: isEmpty(credito) ? undefined : String(credito).trim() };
};

// Una fuente es una URL o un texto sin enlace
export type Source = { url: string; text?: never } | { text: string; url?: never };

// Separa un texto en URLs (que se muestran como enlaces) y texto normal
export const parseSources = (properties: Propiedades) => LINK_FIELDS
  .filter((key) => !isEmpty(properties[key]))
  .flatMap((key) => String(properties[key]).split(/\s+/))
  .filter((part) => part !== '')
  .reduce<Source[]>((sources, part) => {
    const last = sources[sources.length - 1];
    if (/^https?:\/\//i.test(part)) {
      sources.push({ url: part });
    } else if (last && last.text !== undefined) {
      last.text += ' ' + part; // Junta palabras sueltas en un solo texto
    } else {
      sources.push({ text: part });
    }
    return sources;
  }, []);

// Foto o lámina del punto; el crédito dice de dónde viene
export interface Foto {
  src: string;
  credito: string;
}

const isFoto = (value: unknown): value is Foto => typeof value === 'object' && value !== null
  && typeof (value as Foto).src === 'string' && typeof (value as Foto).credito === 'string';

export const parseFotos = (value: unknown) => (Array.isArray(value) ? value.filter(isFoto) : []);

// Las láminas son del propio GRIUT; lo demás son fotos de prensa con su medio
export const creditLabel = (credito: string) => (/^lámina/i.test(credito) ? credito : 'Foto: ' + credito);

// Muestra el dominio del enlace en vez de la URL completa
const linkLabel = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
};

// Etiqueta de cada enlace; si varios son del mismo sitio se numeran para distinguirlos
export const linkLabels = (sources: Source[]) => {
  const domains = sources.map((source) => (source.url ? linkLabel(source.url) : ''));
  const seen: Record<string, number> = {};
  return domains.map((domain) => {
    if (!domain || domains.filter((other) => other === domain).length === 1) {
      return domain;
    }
    seen[domain] = (seen[domain] ?? 0) + 1;
    return `${domain} (${seen[domain]})`;
  });
};

/** "850 m" o "2,3 km" */
export const formatoDistancia = (metros: number) => (metros < 1000
  ? `${Math.round(metros / 10) * 10} m`
  : `${(metros / 1000).toLocaleString('es-CL', { maximumFractionDigits: 1 })} km`);
