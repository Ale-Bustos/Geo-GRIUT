// Buscador de lugares: consulta la API de GRIUT (backend en Go) y avisa qué lugar se eligió.
// Si la API no responde, el buscador no se muestra y el mapa sigue igual
import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { apiDisponible, buscarLugares, CAPAS_API, type ResultadoBusqueda } from './api';
import './css/buscador.css';

const ESPERA_MS = 250; // Espera tras la última tecla antes de consultar
const LARGO_MINIMO = 2;

// Nombre corto de cada capa, bajo el nombre del lugar
const ETIQUETA_CAPA: Record<string, string> = {
  'toponimos': 'Topónimo',
  'puntos-historicos': 'Punto histórico',
  'puntos-resignificacion': 'Resignificación cultural',
  'conflictos': 'Conflicto socioambiental'
};

interface BuscadorProps {
  alElegir: (resultado: ResultadoBusqueda) => void;
}

const Buscador = ({ alElegir }: BuscadorProps) => {
  const [disponible, setDisponible] = useState(false);
  const [abierto, setAbierto] = useState(false); // En celular el campo se despliega desde un botón
  const [texto, setTexto] = useState('');
  // Última respuesta de la API y el texto al que responde: si ya no coincide, no se muestra
  const [respuesta, setRespuesta] = useState<{ q: string; resultados: ResultadoBusqueda[] } | null>(null);
  const [activo, setActivo] = useState(-1);
  const campoRef = useRef<HTMLInputElement>(null);
  const id = useId();

  useEffect(() => {
    const control = new AbortController();
    apiDisponible(control.signal).then((ok) => !control.signal.aborted && setDisponible(ok));
    return () => control.abort();
  }, []);

  const q = texto.trim();
  const resultados = respuesta?.q === q ? respuesta.resultados : [];

  useEffect(() => {
    if (q.length < LARGO_MINIMO) return;
    const control = new AbortController();
    const espera = setTimeout(() => {
      buscarLugares(q, control.signal)
        .then((r) => setRespuesta({ q, resultados: r.filter((x) => x.capa in CAPAS_API) }))
        .catch(() => !control.signal.aborted && setRespuesta({ q, resultados: [] }));
    }, ESPERA_MS);
    return () => {
      clearTimeout(espera);
      control.abort();
    };
  }, [q]);

  useEffect(() => {
    if (abierto) campoRef.current?.focus();
  }, [abierto]);

  if (!disponible) return null;

  const cerrar = () => {
    setTexto('');
    setAbierto(false);
  };

  const elegir = (r: ResultadoBusqueda) => {
    alElegir(r);
    setTexto('');
    setAbierto(false);
    campoRef.current?.blur();
  };

  const alTeclado = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' && resultados.length) {
      e.preventDefault();
      setActivo((i) => (i + 1) % resultados.length);
    } else if (e.key === 'ArrowUp' && resultados.length) {
      e.preventDefault();
      setActivo((i) => (i <= 0 ? resultados.length - 1 : i - 1));
    } else if (e.key === 'Enter' && resultados.length) {
      e.preventDefault();
      elegir(resultados[Math.max(activo, 0)]);
    } else if (e.key === 'Escape') {
      e.stopPropagation(); // Que no cierre también el popup
      cerrar();
    }
  };

  const listaVisible = q.length >= LARGO_MINIMO && respuesta?.q === q;

  return (
    <div className={'buscador' + (abierto ? ' buscador-abierto' : '')} role="search">
      <button type="button" className="buscador-boton" aria-label="Buscar un lugar" aria-expanded={abierto}
        onClick={() => setAbierto((a) => !a)}>
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <circle cx="10.5" cy="10.5" r="6" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M15 15l5 5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      </button>
      <div className="buscador-campo">
        <svg className="buscador-lupa" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <circle cx="10.5" cy="10.5" r="6" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M15 15l5 5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
        <input ref={campoRef} type="search" value={texto} placeholder="Buscar un lugar"
          aria-label="Buscar un lugar" role="combobox" aria-autocomplete="list"
          aria-expanded={listaVisible} aria-controls={id + '-lista'}
          aria-activedescendant={activo >= 0 ? `${id}-${activo}` : undefined}
          onChange={(e) => { setTexto(e.target.value); setActivo(-1); }} onKeyDown={alTeclado} />
      </div>
      {listaVisible && (
        <ul className="buscador-lista" id={id + '-lista'} role="listbox" aria-label="Lugares encontrados">
          {resultados.map((r, i) => (
            <li key={r.capa + r.id} id={`${id}-${i}`} role="option" aria-selected={i === activo}
              className={i === activo ? 'buscador-activo' : undefined}
              onMouseDown={(e) => e.preventDefault()} onClick={() => elegir(r)}>
              <span className="buscador-nombre">{r.nombre}</span>
              <span className="buscador-capa">{ETIQUETA_CAPA[r.capa]}</span>
            </li>
          ))}
          {resultados.length === 0 && <li className="buscador-vacio" role="presentation">Sin resultados</li>}
        </ul>
      )}
    </div>
  );
};

export default Buscador;
