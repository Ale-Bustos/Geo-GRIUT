// Campos que se muestran en el popup, en orden. Los nombres de columna vienen de la exportación
// del SIG ("Copia_de_…"), así que aquí se asocia cada uno a una etiqueta legible.
const POPUP_FIELDS = [
  { key: 'Copia_de_T', label: 'Descripción' },
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
const MIRADAS = [
  { key: 'MiradaAmbiental', label: 'Mirada ambiental' },
  { key: 'MiradaMapuche', label: 'Mirada mapuche' }
];

// Campos con enlaces a fuentes; pueden traer varias URL separadas por espacios
const LINK_FIELDS = ['Copia_de10', 'Copia_de12'];

// Valores que en los datos significan "sin información"
const isEmpty = (value: unknown) => value === null || value === undefined || String(value).trim() === '' || String(value).trim() === '-';

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

type Properties = Record<string, unknown>;

// Una fuente es una URL o un texto sin enlace
type Source = { url: string; text?: never } | { text: string; url?: never };

// Separa un texto en URLs (que se muestran como enlaces) y texto normal
const parseSources = (properties: Properties) => LINK_FIELDS
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
interface Foto {
  src: string;
  credito: string;
}

const isFoto = (value: unknown): value is Foto => typeof value === 'object' && value !== null
  && typeof (value as Foto).src === 'string' && typeof (value as Foto).credito === 'string';

const parseFotos = (value: unknown) => (Array.isArray(value) ? value.filter(isFoto) : []);

// Las láminas son del propio GRIUT; lo demás son fotos de prensa con su medio
const creditLabel = (credito: string) => (/^lámina/i.test(credito) ? credito : 'Foto: ' + credito);

// Muestra el dominio del enlace en vez de la URL completa
const linkLabel = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
};

// Etiqueta de cada enlace; si varios son del mismo sitio se numeran para distinguirlos
const linkLabels = (sources: Source[]) => {
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

interface FeaturePopupProps {
  properties: Properties;
  category: string;
  onClose: () => void;
}

const formatNumber = (value: number) => value.toLocaleString('es-CL', { maximumFractionDigits: 1 });

const toNumber = (value: unknown) => (isEmpty(value) || !Number.isFinite(Number(value)) ? null : Number(value));

const formatPorcentaje = (porcentaje: number, indigenas: number, total: number) =>
  `${formatNumber(porcentaje)} % · ${formatNumber(indigenas)} de ${formatNumber(total)} personas`;

// Polígonos del Censo 2024 (manzana o localidad rural) con su porcentaje de población indígena
// y, cuando la misma unidad existía en 2017, el dato de ese censo para comparar
const PoblacionContent = ({ properties }: { properties: Properties }) => {
  const total = toNumber(properties.total_personas);
  const indigenas = toNumber(properties.personas_indigenas);
  const porcentaje = toNumber(properties.porc_indigena);
  const lengua = toNumber(properties.lengua_indigena);
  const total2017 = toNumber(properties.total_personas_2017);
  const indigenas2017 = toNumber(properties.personas_indigenas_2017);
  const porcentaje2017 = toNumber(properties.porc_indigena_2017);
  const lugar = isEmpty(properties.localidad) ? 'Manzana censal' : capitalize(String(properties.localidad).toLowerCase());

  let poblacion = 'Sin dato';
  if (total === 0) {
    poblacion = 'Sin habitantes censados';
  } else if (Number(properties.reservado) === 1) {
    poblacion = `Dato reservado por el INE · ${formatNumber(total!)} personas`;
  } else if (porcentaje !== null && indigenas !== null && total !== null) {
    poblacion = formatPorcentaje(porcentaje, indigenas, total);
  }

  return (
    <>
      <h2 className="feature-popup-title">{lugar}</h2>
      <dl>
        {!isEmpty(properties.comuna) && (
          <div>
            <dt>Comuna</dt>
            <dd>{capitalize(String(properties.comuna).toLowerCase())}</dd>
          </div>
        )}
        <div>
          <dt>Población indígena</dt>
          <dd>{poblacion}</dd>
        </div>
        {!isEmpty(properties.entidad) && (
          <div>
            <dt>Entidad</dt>
            <dd>{capitalize(String(properties.entidad).toLowerCase())}</dd>
          </div>
        )}
        {lengua !== null && lengua > 0 && (
          <div>
            <dt>Habla o entiende una lengua indígena</dt>
            <dd>{formatNumber(lengua)} {lengua === 1 ? 'persona' : 'personas'}</dd>
          </div>
        )}
        {porcentaje2017 !== null && indigenas2017 !== null && total2017 !== null && (
          <div>
            <dt>Censo 2017</dt>
            <dd>{formatPorcentaje(porcentaje2017, indigenas2017, total2017)}</dd>
          </div>
        )}
      </dl>
      <p className="feature-popup-nota">
        {properties.censo === undefined ? 'Censo 2017' : 'Censo 2024'}: personas que se consideran pertenecientes a un pueblo originario.
      </p>
    </>
  );
};

// Contenido del popup de un punto del mapa
const FeaturePopup = ({ properties, category, onClose }: FeaturePopupProps) => {
  // Las teselas omiten los campos vacíos: 'censo' siempre viene en los datos de 2024
  if ('censo' in properties || 'porc_indigena' in properties) {
    return (
      <div className="feature-popup" role="dialog" aria-label={category}>
        <div className="feature-popup-banda" aria-hidden="true"></div>
        <button type="button" className="ol-popup-closer" onClick={onClose} aria-label="Cerrar" title="Cerrar"></button>
        <div className="feature-popup-cuerpo">
          <p className="feature-popup-category">{category}</p>
          <PoblacionContent properties={properties} />
        </div>
      </div>
    );
  }

  const title = String(properties.PopupInfo || properties.Name || properties.Nombre || '').trim();
  const fields = POPUP_FIELDS.filter(({ key }) => !isEmpty(properties[key]));
  const sources = parseSources(properties);
  const labels = linkLabels(sources);
  const fotos = parseFotos(properties.Fotos);
  const miradas = MIRADAS.filter(({ key }) => !isEmpty(properties[key]));

  return (
    <div className="feature-popup" role="dialog" aria-label={title}>
      <div className="feature-popup-banda" aria-hidden="true"></div>
      <button type="button" className="ol-popup-closer" onClick={onClose} aria-label="Cerrar" title="Cerrar"></button>
      <div className="feature-popup-cuerpo">
        <p className="feature-popup-category">{String(properties.Copia_de11 || category)}</p>
        <h2 className="feature-popup-title">{title}</h2>
        {fotos.map((foto) => (
          <figure key={foto.src} className="feature-popup-foto">
            {/* Tocar la imagen la abre en grande (las láminas tienen texto chico) */}
            <a href={foto.src} target="_blank" rel="noopener noreferrer" aria-label={'Ver imagen en grande: ' + creditLabel(foto.credito)}>
              <img src={foto.src} alt="" loading="lazy" />
            </a>
            <figcaption>{creditLabel(foto.credito)}</figcaption>
          </figure>
        ))}
        {miradas.map(({ key, label }) => (
          <section key={key} className="feature-popup-mirada">
            <h3>{label}</h3>
            <p>{String(properties[key]).trim()}</p>
          </section>
        ))}
        {fields.length > 0 && (
          <dl>
            {fields.map(({ key, label }) => (
              <div key={key}>
                <dt>{label}</dt>
                <dd>{capitalize(String(properties[key]).trim())}</dd>
              </div>
            ))}
          </dl>
        )}
        {sources.length > 0 && (
          <div className="feature-popup-sources">
            <span>Fuentes</span>
            <ul>
              {sources.map((source, index) => (
                <li key={index}>
                  {source.url
                    ? <a href={source.url} target="_blank" rel="noopener noreferrer">{labels[index]}</a>
                    : source.text}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default FeaturePopup;
