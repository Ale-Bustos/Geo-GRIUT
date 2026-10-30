/*
 * TutorialMapa — ventanas de bienvenida / recorrido guiado para el mapa
 * (adaptado de simbologia_mapa_web/tutorial-mapa.js). No depende de OpenLayers.
 *
 *   const tutorial = new TutorialMapa({ pasos: [...] });
 *   tutorial.iniciar();   // se muestra solo la primera vez
 *   tutorial.abrir();     // vuelve a mostrarlo (p. ej. desde un botón "?")
 *   tutorial.destruir();  // quita la ventana y sus eventos (al desmontar el mapa)
 *
 * Con modo 'recorrido' la misma tarjeta guía un relato sobre el mapa: sin velo (el mapa sigue
 * visible y se puede tocar), sin recordar si ya se vio y avisando cada cambio de paso (alCambiar).
 */

export interface PasoTutorial {
  titulo: string;
  texto: string; // Admite HTML simple
  saludo?: string;
  icono?: string; // URL
  objetivo?: string; // Selector CSS del elemento a destacar
  objetivoMovil?: string; // Selector en celular, si es distinto
}

export interface OpcionesTutorial {
  pasos: PasoTutorial[];
  clave?: string; // Clave de localStorage que recuerda que ya se vio
  textoFinal?: string;
  contenedor?: HTMLElement;
  alCerrar?: (indice: number) => void;
  alCambiar?: (indice: number) => void; // Se llama cada vez que se muestra un paso
  modo?: 'tutorial' | 'recorrido';
  textoSaltar?: string;
}

// Números en mapudungun (1–10) para el contador de pasos
const NUMEROS = ['Kiñe', 'Epu', 'Küla', 'Meli', 'Kechu', 'Kayu', 'Regle', 'Pura', 'Aylla', 'Mari'];
export const ANCHO_MOVIL = 640;
export const ALTO_MOVIL = 500; // Celular acostado: ancho de escritorio pero poco alto

function crear<K extends keyof HTMLElementTagNameMap>(tag: K, clase?: string | null, attrs?: Record<string, string>) {
  const e = document.createElement(tag);
  if (clase) e.className = clase;
  if (attrs) {
    Object.keys(attrs).forEach((k) => {
      if (k === 'texto') e.textContent = attrs[k];
      else if (k === 'html') e.innerHTML = attrs[k];
      else e.setAttribute(k, attrs[k]);
    });
  }
  return e;
}

function leer(clave: string) {
  try { return localStorage.getItem(clave); } catch { return null; }
}

function guardar(clave: string, v: string) {
  try { localStorage.setItem(clave, v); } catch { /* ignorar */ }
}

export default class TutorialMapa {
  private opciones: OpcionesTutorial;
  private pasos: PasoTutorial[];
  private clave: string;
  private recorrido: boolean;
  indice = 0;
  private _abierto = false;
  private _foco: Element | null = null;
  private _raiz?: HTMLDivElement;
  private _marco!: HTMLDivElement;
  private _tarjeta!: HTMLDivElement;
  private _contador!: HTMLSpanElement;
  private _saltar!: HTMLButtonElement;
  private _contenido!: HTMLDivElement;
  private _icono!: HTMLImageElement;
  private _saludo!: HTMLParagraphElement;
  private _titulo!: HTMLHeadingElement;
  private _texto!: HTMLDivElement;
  private _progreso!: HTMLDivElement;
  private _rombos: HTMLButtonElement[] = [];
  private _anterior!: HTMLButtonElement;
  private _siguiente!: HTMLButtonElement;

  constructor(opciones: OpcionesTutorial) {
    this.opciones = opciones;
    this.pasos = opciones.pasos || [];
    this.clave = opciones.clave || 'tutorialMapa.visto';
    this.recorrido = opciones.modo === 'recorrido';
  }

  get abierto() {
    return this._abierto;
  }

  /** La tarjeta, para que quien la use sepa qué parte de la pantalla tapa. */
  get tarjeta(): HTMLElement | null {
    return this._raiz ? this._tarjeta : null;
  }

  /** Muestra el tutorial si esta persona aún no lo ha visto. */
  iniciar() {
    if (leer(this.clave) !== '1') this.abrir(0);
  }

  abrir(indice = 0) {
    if (!this.pasos.length) return;
    const raiz = this._raiz ?? this._construir();
    this._foco = document.activeElement;
    this._abierto = true;
    raiz.hidden = false;
    document.addEventListener('keydown', this._alTeclado, true);
    window.addEventListener('resize', this._alRedimensionar);
    this.ir(indice);
    this._siguiente.focus();
  }

  cerrar() {
    if (!this._abierto || !this._raiz) return;
    this._abierto = false;
    this._raiz.hidden = true;
    this._raiz.classList.remove('tu-con-objetivo');
    if (!this.recorrido) guardar(this.clave, '1');
    this._quitarEventos();
    if (this._foco instanceof HTMLElement) this._foco.focus();
    this.opciones.alCerrar?.(this.indice);
  }

  /** Quita la ventana y sus eventos sin marcar el tutorial como visto. */
  destruir() {
    this._abierto = false;
    this._quitarEventos();
    this._raiz?.remove();
    this._raiz = undefined;
  }

  ir(i: number) {
    const n = this.pasos.length;
    if (i < 0 || i >= n) return;
    this.indice = i;
    const p = this.pasos[i];

    this._saludo.textContent = p.saludo || '';
    this._saludo.hidden = !p.saludo;
    this._contador.textContent = (NUMEROS[i] ? NUMEROS[i] + ' · ' : '') + 'Paso ' + (i + 1) + ' de ' + n;
    this._titulo.textContent = p.titulo || '';
    this._texto.innerHTML = p.texto || '';
    if (p.icono) {
      this._icono.src = p.icono;
      this._icono.hidden = false;
    } else {
      this._icono.removeAttribute('src');
      this._icono.hidden = true;
    }

    this._rombos.forEach((r, k) => {
      r.className = 'tu-rombo' + (k < i ? ' tu-hecho' : k === i ? ' tu-actual' : '');
    });
    this._progreso.setAttribute('aria-valuenow', String(i + 1));
    this._progreso.setAttribute('aria-valuetext', 'Paso ' + (i + 1) + ' de ' + n);

    this._anterior.hidden = i === 0;
    const ultimo = i === n - 1;
    this._siguiente.textContent = ultimo ? (this.opciones.textoFinal || 'Comenzar a explorar') : 'Siguiente';
    this._saltar.hidden = ultimo && !this.recorrido; // En el recorrido siempre se puede salir

    // Reinicia la animación del contenido
    this._contenido.classList.remove('tu-entra');
    void this._contenido.offsetWidth;
    this._contenido.classList.add('tu-entra');

    this._posicionar();
    this.opciones.alCambiar?.(i);
  }

  private _construir() {
    const raiz = (this._raiz = crear('div', this.recorrido ? 'tu tu-recorrido' : 'tu'));
    raiz.hidden = true;
    const velo = crear('div', 'tu-velo');
    velo.addEventListener('click', () => this.cerrar());
    this._marco = crear('div', 'tu-marco', { 'aria-hidden': 'true' });

    // En el recorrido el mapa sigue disponible: la tarjeta no es modal
    const tarjeta = (this._tarjeta = crear('div', 'tu-tarjeta', { role: 'dialog', 'aria-modal': String(!this.recorrido), 'aria-labelledby': 'tu-titulo', 'aria-describedby': 'tu-texto' }));
    tarjeta.appendChild(crear('div', 'tu-banda', { 'aria-hidden': 'true' }));

    const cuerpo = crear('div', 'tu-cuerpo');
    const cab = crear('div', 'tu-cabecera');
    this._contador = crear('span', 'tu-contador');
    this._saltar = crear('button', 'tu-saltar', { type: 'button', texto: this.opciones.textoSaltar || 'Saltar' });
    this._saltar.addEventListener('click', () => this.cerrar());
    cab.appendChild(this._contador);
    cab.appendChild(this._saltar);
    cuerpo.appendChild(cab);

    const contenido = (this._contenido = crear('div', 'tu-contenido'));
    this._icono = crear('img', 'tu-icono', { alt: '' });
    this._saludo = crear('p', 'tu-saludo');
    this._titulo = crear('h2', 'tu-titulo', { id: 'tu-titulo' });
    this._texto = crear('div', 'tu-texto', { id: 'tu-texto' });
    contenido.appendChild(this._icono);
    contenido.appendChild(this._saludo);
    contenido.appendChild(this._titulo);
    contenido.appendChild(this._texto);
    cuerpo.appendChild(contenido);

    const pie = crear('div', 'tu-pie');
    this._progreso = crear('div', 'tu-progreso', { role: 'progressbar', 'aria-valuemin': '1', 'aria-valuemax': String(this.pasos.length), 'aria-label': this.recorrido ? 'Avance del recorrido' : 'Avance del tutorial' });
    this._rombos = this.pasos.map((_, k) => {
      const r = crear('button', 'tu-rombo', { type: 'button', 'aria-label': 'Ir al paso ' + (k + 1), tabindex: '-1' });
      r.addEventListener('click', () => this.ir(k));
      this._progreso.appendChild(r);
      return r;
    });
    const acciones = crear('div', 'tu-acciones');
    this._anterior = crear('button', 'tu-boton tu-anterior', { type: 'button', texto: 'Anterior' });
    this._siguiente = crear('button', 'tu-boton tu-siguiente', { type: 'button', texto: 'Siguiente' });
    this._anterior.addEventListener('click', () => this.ir(this.indice - 1));
    this._siguiente.addEventListener('click', () => {
      if (this.indice >= this.pasos.length - 1) this.cerrar();
      else this.ir(this.indice + 1);
    });
    acciones.appendChild(this._anterior);
    acciones.appendChild(this._siguiente);
    pie.appendChild(this._progreso);
    pie.appendChild(acciones);
    cuerpo.appendChild(pie);
    tarjeta.appendChild(cuerpo);

    if (!this.recorrido) raiz.appendChild(velo);
    raiz.appendChild(this._marco);
    raiz.appendChild(tarjeta);
    (this.opciones.contenedor || document.body).appendChild(raiz);
    return raiz;
  }

  private _quitarEventos() {
    document.removeEventListener('keydown', this._alTeclado, true);
    window.removeEventListener('resize', this._alRedimensionar);
  }

  private _alTeclado = (e: KeyboardEvent) => {
    if (!this._abierto) return;
    // En el recorrido las flechas solo cambian de paso desde la tarjeta: sobre el mapa lo desplazan
    const enCampo = e.target instanceof HTMLInputElement || (this.recorrido && !this._tarjeta.contains(document.activeElement));
    if (e.key === 'Escape') {
      e.preventDefault();
      this.cerrar();
    } else if (e.key === 'ArrowRight' && !enCampo) {
      this.ir(this.indice + 1);
    } else if (e.key === 'ArrowLeft' && !enCampo) {
      this.ir(this.indice - 1);
    } else if (e.key === 'Tab' && !this.recorrido) {
      // Mantiene el foco dentro de la ventana
      const f = Array.from(this._tarjeta.querySelectorAll('button')).filter((b) => !b.hidden && b.tabIndex >= 0);
      if (!f.length) return;
      const primero = f[0], ultimo = f[f.length - 1];
      if (e.shiftKey && document.activeElement === primero) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault();
        primero.focus();
      }
    }
  };

  // Al girar el teléfono el diseño cambia; se espera un cuadro para medir con el diseño nuevo
  private _alRedimensionar = () => requestAnimationFrame(() => this._posicionar());

  /** Destaca el elemento del paso (si existe) y ubica la tarjeta a su lado. */
  private _posicionar() {
    if (!this._abierto || !this._raiz) return;
    const p = this.pasos[this.indice];
    const movil = window.innerWidth <= ANCHO_MOVIL; // Vertical: tarjeta abajo
    const celular = movil || window.innerHeight <= ALTO_MOVIL; // También acostado: controles de celular
    const sel = (celular && p.objetivoMovil) || p.objetivo;
    const objetivo = sel ? document.querySelector(sel) : null;
    const r = objetivo?.getBoundingClientRect();
    const visible = Boolean(r && r.width > 0 && r.height > 0);
    const t = this._tarjeta.style;
    t.left = t.top = t.right = t.bottom = '';
    this._raiz.classList.toggle('tu-con-objetivo', visible);
    if (!r || !visible) return;

    const m = 6;
    const marco = this._marco.style;
    marco.left = r.left - m + 'px';
    marco.top = r.top - m + 'px';
    marco.width = r.width + 2 * m + 'px';
    marco.height = r.height + 2 * m + 'px';
    if (movil) return; // En celular la tarjeta queda abajo (CSS)

    const tw = this._tarjeta.offsetWidth, th = this._tarjeta.offsetHeight;
    const vw = window.innerWidth, vh = window.innerHeight, sep = 18;
    let left: number | undefined, top: number;
    if (r.left - sep - tw >= 12) left = r.left - sep - tw; // A la izquierda
    else if (r.right + sep + tw <= vw - 12) left = r.right + sep; // A la derecha
    if (left !== undefined) {
      top = Math.min(Math.max(12, r.top + r.height / 2 - th / 2), vh - th - 12);
    } else { // Abajo o arriba
      left = Math.min(Math.max(12, r.left + r.width / 2 - tw / 2), vw - tw - 12);
      top = r.bottom + sep + th <= vh - 12 ? r.bottom + sep : Math.max(12, r.top - sep - th);
    }
    t.left = left + 'px';
    t.top = top + 'px';
  }
}
