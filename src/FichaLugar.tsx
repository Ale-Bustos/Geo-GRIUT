// Ficha de un lugar del mapa: panel lateral en escritorio y hoja inferior arrastrable en celulares
// (ver css/ficha-lugar.css). Cada sección aparece solo si el lugar trae ese dato
import {
  useEffect, useId, useLayoutEffect, useRef, useState,
  type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent
} from 'react';
import type { Relacionado } from './api';
import {
  CAMPOS_DETALLE, CAMPOS_GRIUT, MIRADAS, capitalize, creditLabel, descripcionLugar, formatoDistancia, isEmpty,
  linkLabels, nombreLugar, nombreOriginal, parseAudio, parseDesglose, parseFotos, parseSources, type Propiedades
} from './fichaCampos';
import { CAPAS_LUGAR, claveLugar, enlaceLugar, esCapaLugar, obtenerRelacionados, type RefLugar } from './lugares';

export interface FichaLugarProps {
  properties: Propiedades;
  category: string;
  lugar?: RefLugar | null; // Solo los puntos con id tienen enlace propio y relacionados
  onClose: () => void;
  onElegirRelacionado?: (ref: RefLugar) => void;
  onMedir?: (caja: DOMRect) => void; // Al abrir o cambiar de lugar, para que el mapa no quede tapado
}

// Alturas de la hoja inferior, en fracción del alto visible
const ALTURAS = { baja: 0.3, media: 0.55, alta: 0.92 } as const;
type Altura = keyof typeof ALTURAS;
const ORDEN: Altura[] = ['baja', 'media', 'alta'];
const NOMBRE_ALTURA: Record<Altura, string> = { baja: 'baja', media: 'media', alta: 'completa' };
const CIERRE_AL_ARRASTRAR = 0.18; // Bajarla de esta altura la cierra
const ARRASTRE_MINIMO_PX = 6; // Menos que esto es un toque, no un arrastre

const ENFOCABLES = 'a[href], button:not([disabled]), audio[controls], input, select, textarea, [tabindex]:not([tabindex="-1"])';

const formatNumber = (value: number) => value.toLocaleString('es-CL', { maximumFractionDigits: 1 });

const toNumber = (value: unknown) => (isEmpty(value) || !Number.isFinite(Number(value)) ? null : Number(value));

const formatPorcentaje = (porcentaje: number, indigenas: number, total: number) =>
  `${formatNumber(porcentaje)} % · ${formatNumber(indigenas)} de ${formatNumber(total)} personas`;

// Polígonos del Censo 2024 (manzana o localidad rural) con su porcentaje de población indígena
// y, cuando la misma unidad existía en 2017, el dato de ese censo para comparar
const PoblacionContent = ({ properties, tituloId }: { properties: Propiedades; tituloId: string }) => {
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
      <h2 className="ficha-titulo" id={tituloId} tabIndex={-1}>{lugar}</h2>
      <dl className="ficha-detalle">
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
      <p className="ficha-nota">
        {properties.censo === undefined ? 'Censo 2017' : 'Censo 2024'}: personas que se consideran pertenecientes a un pueblo originario.
      </p>
    </>
  );
};

// Contenido de un punto: nombre, descripción, desglose, audio, imágenes, detalles y fuentes
const LugarContent = ({ properties, tituloId }: { properties: Propiedades; tituloId: string }) => {
  const nombre = nombreLugar(properties);
  const original = nombreOriginal(properties);
  const enMapudungun = !isEmpty(properties[CAMPOS_GRIUT.nombreMapudungun]);
  const descripcion = descripcionLugar(properties);
  const desglose = parseDesglose(properties[CAMPOS_GRIUT.desglose]);
  const audio = parseAudio(properties[CAMPOS_GRIUT.audio]);
  const fotos = parseFotos(properties.Fotos);
  const miradas = MIRADAS.filter(({ key }) => !isEmpty(properties[key]));
  const detalles = CAMPOS_DETALLE.filter(({ key }) => !isEmpty(properties[key]));
  const sources = parseSources(properties);
  const labels = linkLabels(sources);

  return (
    <>
      <h2 className="ficha-titulo" id={tituloId} tabIndex={-1} lang={enMapudungun ? 'arn' : undefined}>{nombre}</h2>
      {enMapudungun && original && original !== nombre && <p className="ficha-otro-nombre">{original}</p>}
      {descripcion && (
        <section className="ficha-seccion" aria-label="Descripción">
          <p className="ficha-descripcion">{capitalize(descripcion)}</p>
        </section>
      )}
      {desglose.length > 0 && (
        <section className="ficha-seccion">
          <h3>Desglose del nombre</h3>
          <dl className="ficha-desglose">
            {desglose.map(({ parte, significado }, k) => (
              <div key={k}>
                <dt lang="arn">{parte}</dt>
                <dd>{significado}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
      {audio && (
        <section className="ficha-seccion">
          <h3>Pronunciación</h3>
          <audio className="ficha-audio" controls preload="none" src={audio.src} aria-label={'Pronunciación de ' + nombre} />
          {audio.credito && <p className="ficha-credito">{audio.credito}</p>}
        </section>
      )}
      {fotos.length > 0 && (
        <section className="ficha-seccion" aria-label="Imágenes">
          {fotos.map((foto) => (
            <figure key={foto.src} className="ficha-foto">
              {/* Tocar la imagen la abre en grande (las láminas tienen texto chico) */}
              <a href={foto.src} target="_blank" rel="noopener noreferrer" aria-label={'Ver imagen en grande: ' + creditLabel(foto.credito)}>
                <img src={foto.src} alt="" loading="lazy" />
              </a>
              <figcaption>{creditLabel(foto.credito)}</figcaption>
            </figure>
          ))}
        </section>
      )}
      {miradas.map(({ key, label }) => (
        <section key={key} className="ficha-mirada">
          <h3>{label}</h3>
          <p>{String(properties[key]).trim()}</p>
        </section>
      ))}
      {detalles.length > 0 && (
        <dl className="ficha-detalle">
          {detalles.map(({ key, label }) => (
            <div key={key}>
              <dt>{label}</dt>
              <dd>{capitalize(String(properties[key]).trim())}</dd>
            </div>
          ))}
        </dl>
      )}
      {sources.length > 0 && (
        <section className="ficha-seccion ficha-fuentes">
          <h3>Fuentes</h3>
          <ul>
            {sources.map((source, index) => (
              <li key={index}>
                {source.url
                  ? <a href={source.url} target="_blank" rel="noopener noreferrer">{labels[index]}</a>
                  : source.text}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
};

const Relacionados = ({ lugar, onElegir }: { lugar: RefLugar; onElegir?: (ref: RefLugar) => void }) => {
  const [relacionados, setRelacionados] = useState<{ clave: string; lista: Relacionado[] } | null>(null);
  const clave = claveLugar(lugar);

  useEffect(() => {
    const control = new AbortController();
    obtenerRelacionados({ capa: lugar.capa, id: lugar.id }, control.signal)
      .then((lista) => setRelacionados({ clave, lista }))
      .catch(() => { /* Abortado: ya se abrió otro lugar */ });
    return () => control.abort();
  }, [clave, lugar.capa, lugar.id]);

  const lista = relacionados?.clave === clave ? relacionados.lista : [];
  if (lista.length === 0) return null;
  return (
    <section className="ficha-seccion ficha-relacionados">
      <h3>Lugares relacionados</h3>
      <ul>
        {lista.map((r) => (
          <li key={r.capa + ':' + r.id}>
            <button type="button" onClick={() => esCapaLugar(r.capa) && onElegir?.({ capa: r.capa, id: r.id })}>
              <span className="ficha-relacionado-nombre">{r.nombre}</span>
              <span className="ficha-relacionado-dato">
                {esCapaLugar(r.capa) ? CAPAS_LUGAR[r.capa].categoria : r.capa} · {formatoDistancia(r.distancia_m)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
};

/** Comparte el enlace con el menú del sistema; si no hay, lo copia. Devuelve el aviso que se muestra. */
export const compartirLugar = async (titulo: string, url: string): Promise<string> => {
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ title: titulo, url });
      return '';
    } catch (error) {
      if ((error as Error)?.name === 'AbortError') return ''; // La persona cerró el menú
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    return 'Enlace copiado';
  } catch {
    return 'No se pudo copiar el enlace: ' + url;
  }
};

const FichaLugar = ({ properties, category, lugar, onClose, onElegirRelacionado, onMedir }: FichaLugarProps) => {
  const fichaRef = useRef<HTMLDivElement>(null);
  const tituloId = useId();
  const [altura, setAltura] = useState<Altura>('media');
  const [aviso, setAviso] = useState({ clave: '', texto: '' }); // Solo vale para el lugar en que se compartió
  const arrastre = useRef<{ y: number; alto: number; movio: boolean } | null>(null);
  const enfocadoAntes = useRef<Element | null>(typeof document === 'undefined' ? null : document.activeElement);
  const esPoblacion = 'censo' in properties || 'porc_indigena' in properties; // Las teselas omiten los campos vacíos
  // Identifica lo que se muestra: los polígonos de población no tienen id, así que valen sus datos
  const clave = lugar ? claveLugar(lugar) : category + JSON.stringify(properties);
  const nombre = esPoblacion ? category : nombreLugar(properties);
  // Los manejadores más recientes, para los efectos que no deben repetirse cuando cambian
  const onCloseRef = useRef(onClose);
  const onMedirRef = useRef(onMedir);
  useLayoutEffect(() => {
    onCloseRef.current = onClose;
    onMedirRef.current = onMedir;
  });

  // Al abrir o cambiar de lugar: el foco va al título y el mapa se acomoda a la ficha
  useLayoutEffect(() => {
    const ficha = fichaRef.current;
    ficha?.querySelector<HTMLElement>('.ficha-titulo')?.focus({ preventScroll: true });
    ficha?.querySelector('.ficha-cuerpo')?.scrollTo?.({ top: 0 });
    if (ficha) onMedirRef.current?.(ficha.getBoundingClientRect());
  }, [clave]);

  // Al cerrar, el foco vuelve a donde estaba (el buscador, un botón…)
  useEffect(() => () => {
    const antes = enfocadoAntes.current;
    if (antes instanceof HTMLElement && antes.isConnected && antes !== document.body) antes.focus({ preventScroll: true });
  }, []);

  // Esc cierra la ficha desde cualquier parte
  useEffect(() => {
    const alTeclado = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) onCloseRef.current();
    };
    document.addEventListener('keydown', alTeclado);
    return () => document.removeEventListener('keydown', alTeclado);
  }, []);

  // Tab y Mayús+Tab dan la vuelta dentro de la ficha
  const alTeclado = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab' || !fichaRef.current) return;
    // El asa de la hoja inferior no se muestra en escritorio
    const enfocables = [...fichaRef.current.querySelectorAll<HTMLElement>(ENFOCABLES)]
      .filter((el) => getComputedStyle(el).display !== 'none');
    if (enfocables.length === 0) return;
    const primero = enfocables[0];
    const ultimo = enfocables[enfocables.length - 1];
    const activo = document.activeElement;
    if (e.shiftKey && (activo === primero || !fichaRef.current.contains(activo))) {
      e.preventDefault();
      ultimo.focus();
    } else if (!e.shiftKey && (activo === ultimo || !fichaRef.current.contains(activo))) {
      e.preventDefault();
      primero.focus();
    }
  };

  const compartir = async () => {
    if (!lugar) return;
    const deClave = clave;
    setAviso({ clave: deClave, texto: '' });
    setAviso({ clave: deClave, texto: await compartirLugar(nombre, enlaceLugar(lugar)) });
  };

  // Hoja inferior: se arrastra desde el asa y, al soltarla, queda en la altura más cercana
  const altoVisible = () => window.visualViewport?.height ?? window.innerHeight;

  const alPresionarAsa = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const ficha = fichaRef.current;
    if (!ficha) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    arrastre.current = { y: e.clientY, alto: ficha.getBoundingClientRect().height, movio: false };
  };

  const alMoverAsa = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const a = arrastre.current;
    const ficha = fichaRef.current;
    if (!a || !ficha) return;
    const dy = a.y - e.clientY;
    if (Math.abs(dy) >= ARRASTRE_MINIMO_PX) a.movio = true;
    if (!a.movio) return;
    const fraccion = Math.min(ALTURAS.alta, Math.max(0.1, (a.alto + dy) / altoVisible()));
    ficha.style.setProperty('--ficha-alto', String(fraccion * 100));
    ficha.classList.add('ficha-arrastrando');
  };

  const alSoltarAsa = () => {
    const a = arrastre.current;
    const ficha = fichaRef.current;
    if (!a?.movio || !ficha) return;
    const fraccion = ficha.getBoundingClientRect().height / altoVisible();
    ficha.classList.remove('ficha-arrastrando');
    ficha.style.removeProperty('--ficha-alto');
    if (fraccion < CIERRE_AL_ARRASTRAR) {
      onClose();
      return;
    }
    setAltura(ORDEN.reduce((mejor, k) => (Math.abs(ALTURAS[k] - fraccion) < Math.abs(ALTURAS[mejor] - fraccion) ? k : mejor)));
  };

  const alClicAsa = () => {
    const a = arrastre.current;
    arrastre.current = null;
    if (a?.movio) return; // Fue un arrastre, ya se acomodó al soltar
    setAltura((h) => ORDEN[(ORDEN.indexOf(h) + 1) % ORDEN.length]);
  };

  const alTecladoAsa = (e: ReactKeyboardEvent<HTMLButtonElement>) => {
    const paso = e.key === 'ArrowUp' ? 1 : e.key === 'ArrowDown' ? -1 : 0;
    if (!paso) return;
    e.preventDefault();
    setAltura((h) => ORDEN[Math.min(ORDEN.length - 1, Math.max(0, ORDEN.indexOf(h) + paso))]);
  };

  return (
    <div ref={fichaRef} className={'ficha-lugar ficha-' + altura} role="dialog" aria-labelledby={tituloId}
      onKeyDown={alTeclado} style={{ '--ficha-fraccion': String(ALTURAS[altura] * 100) } as CSSProperties}>
      <button type="button" className="ficha-asa" aria-label={`Altura de la ficha: ${NOMBRE_ALTURA[altura]}. Cambiar altura`}
        onPointerDown={alPresionarAsa} onPointerMove={alMoverAsa} onPointerUp={alSoltarAsa} onPointerCancel={alSoltarAsa}
        onClick={alClicAsa} onKeyDown={alTecladoAsa}>
        <span aria-hidden="true"></span>
      </button>
      <div className="ficha-banda" aria-hidden="true"></div>
      <div className="ficha-cabecera">
        <p className="ficha-categoria">{String((!esPoblacion && !isEmpty(properties.Copia_de11) && properties.Copia_de11) || category)}</p>
        <div className="ficha-acciones">
          {lugar && (
            <button type="button" className="ficha-boton" onClick={compartir} aria-label={'Compartir enlace a ' + nombre} title="Compartir">
              {/* Nodos unidos: compartir */}
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                <circle cx="18" cy="5" r="2.6" fill="currentColor" />
                <circle cx="6" cy="12" r="2.6" fill="currentColor" />
                <circle cx="18" cy="19" r="2.6" fill="currentColor" />
                <path d="M8.3 10.8l7.4-4.4M8.3 13.2l7.4 4.4" stroke="currentColor" strokeWidth="1.8" />
              </svg>
            </button>
          )}
          <button type="button" className="ficha-boton ficha-cerrar" onClick={onClose} aria-label="Cerrar ficha" title="Cerrar">
            <span aria-hidden="true">×</span>
          </button>
        </div>
      </div>
      <div className="ficha-cuerpo">
        {esPoblacion
          ? <PoblacionContent properties={properties} tituloId={tituloId} />
          : <LugarContent properties={properties} tituloId={tituloId} />}
        {lugar && <Relacionados lugar={lugar} onElegir={onElegirRelacionado} />}
      </div>
      <p className="ficha-aviso" role="status" aria-live="polite">{aviso.clave === clave ? aviso.texto : ''}</p>
    </div>
  );
};

export default FichaLugar;
