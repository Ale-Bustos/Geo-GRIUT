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
  { key: 'Copia_de_7', label: 'Instrumento de planificación' }
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

// Contenido del popup de un punto del mapa
const FeaturePopup = ({ properties, category, onClose }: FeaturePopupProps) => {
  const title = String(properties.PopupInfo || properties.Name || properties.Nombre || '').trim();
  const fields = POPUP_FIELDS.filter(({ key }) => !isEmpty(properties[key]));
  const sources = parseSources(properties);
  const labels = linkLabels(sources);

  return (
    <div className="feature-popup" role="dialog" aria-label={title}>
      <div className="feature-popup-banda" aria-hidden="true"></div>
      <button type="button" className="ol-popup-closer" onClick={onClose} aria-label="Cerrar" title="Cerrar"></button>
      <div className="feature-popup-cuerpo">
        <p className="feature-popup-category">{String(properties.Copia_de11 || category)}</p>
        <h2 className="feature-popup-title">{title}</h2>
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
