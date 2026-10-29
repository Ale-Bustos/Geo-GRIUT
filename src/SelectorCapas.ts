/*
 * SelectorCapas — selector de capas para OpenLayers (adaptado de simbologia_mapa_web/selector-capas.js)
 *
 * Escritorio: tarjeta con capas agrupadas, interruptores, símbolo de cada capa,
 *             opacidad y leyenda desplegables, y selector de mapa base.
 * Celular (≤ 640 px): chips de capas sobre el mapa + botón flotante con el mapa base
 *             y acceso a la lista completa como hoja inferior.
 */
import Control from 'ol/control/Control';
import { unByKey } from 'ol/Observable';
import type { EventsKey } from 'ol/events';
import type BaseLayer from 'ol/layer/Base';
import type Map from 'ol/Map';

// Mini símbolo que muestra en el selector cómo se dibuja la capa
export type Simbolo =
  | { tipo: 'icono'; src: string }
  | { tipo: 'texto'; color?: string; texto?: string }
  | { tipo: 'linea' | 'onda'; color?: string; ancho?: number; guiones?: string }
  | { tipo: 'area'; color?: string; relleno?: string; borde?: string }
  | { tipo: 'punto'; color?: string };

export interface ElementoLeyenda {
  icono?: string;
  simbolo?: Simbolo;
  texto: string;
}

export interface DefinicionCapa {
  capa: BaseLayer | null;
  nombre: string;
  nombreCorto?: string;
  simbolo?: Simbolo;
  opacidad?: boolean;
  leyenda?: ElementoLeyenda[];
}

export interface GrupoCapas {
  titulo: string;
  nombreCorto?: string;
  chips?: boolean | 'capas'; // En celular: un chip por grupo (por defecto), uno por capa o ninguno
  capas: DefinicionCapa[];
}

export interface MapaBase {
  nombre: string;
  capa: BaseLayer | null;
  miniatura?: string; // URL o color CSS
}

export interface OpcionesSelectorCapas {
  titulo?: string;
  grupos: GrupoCapas[];
  mapasBase?: MapaBase[];
  target?: HTMLElement | string;
}

interface Fila {
  capa: BaseLayer | null;
  fila: HTMLElement;
  interruptor: HTMLButtonElement;
  rango?: HTMLInputElement;
  valor?: HTMLOutputElement;
}

const CLAVE_MINIMIZADO = 'selectorCapas.minimizado';
export const ANCHO_MOVIL = 640;
let contadorIds = 0;

const ICONOS = {
  minimizar: '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><line x1="3" y1="8" x2="13" y2="8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  expandir: '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M4 10 L8 6 L12 10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  cerrar: '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M4 4 L12 12 M12 4 L4 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  chevron: '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M4 6 L8 10 L12 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  capas: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M12 4 L21 9.5 L12 15 L3 9.5 Z" fill="currentColor"/><path d="M3 14 L12 19.5 L21 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
};

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

function esc(s: string | number) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);
}

/** Mini símbolo de 22 × 22 px que muestra cómo se dibuja la capa. */
function simbolo(s?: Simbolo) {
  const cont = crear('span', 'sc-simbolo', { 'aria-hidden': 'true' });
  if (!s) return cont;
  if (s.tipo === 'icono') {
    cont.appendChild(crear('img', null, { src: s.src, alt: '' }));
    return cont;
  }
  const color = esc(s.color || '#6B7280');
  let dibujo = '';
  switch (s.tipo) {
    case 'texto':
      dibujo = '<text x="11" y="15.5" text-anchor="middle" font-size="12" font-weight="700" fill="' + color + '">' + esc(s.texto || 'Aa') + '</text>';
      break;
    case 'linea':
    case 'onda': {
      const ancho = s.ancho || 2;
      const guiones = s.guiones ? ' stroke-dasharray="' + esc(s.guiones) + '"' : '';
      dibujo = s.tipo === 'linea'
        ? '<line x1="2" y1="11" x2="20" y2="11" stroke="' + color + '" stroke-width="' + ancho + '"' + guiones + ' stroke-linecap="round"/>'
        : '<path d="M2 12 C7 5 11 18 20 9" fill="none" stroke="' + color + '" stroke-width="' + ancho + '"' + guiones + ' stroke-linecap="round"/>';
      break;
    }
    case 'area':
      dibujo = '<rect x="3" y="3" width="16" height="16" rx="4" fill="' + esc(s.relleno || '#CFE6D2') + '" stroke="' + esc(s.borde || color) + '" stroke-width="1"/>';
      break;
    case 'punto':
      dibujo = '<circle cx="11" cy="11" r="5" fill="' + color + '" stroke="#fff" stroke-width="1.5"/>';
      break;
  }
  cont.innerHTML = '<svg viewBox="0 0 22 22" width="22" height="22">' + dibujo + '</svg>';
  return cont;
}

export default class SelectorCapas extends Control {
  private opciones: OpcionesSelectorCapas;
  private grupos: GrupoCapas[];
  private mapasBase: (MapaBase & { capa: BaseLayer })[];
  private _id: string;
  private _claves: EventsKey[] = [];
  private _filas: Fila[] = [];
  private _chips: { b: HTMLButtonElement; capas: BaseLayer[] }[] = [];
  private _botonesBase: { mb: MapaBase & { capa: BaseLayer }; b: HTMLButtonElement }[] = [];
  private _panel!: HTMLElement;
  private _contador!: HTMLElement;
  private _botonMin!: HTMLButtonElement;
  private _fab!: HTMLButtonElement;
  private _pop!: HTMLDivElement;
  private _alPulsarFuera?: (e: PointerEvent) => void;

  constructor(opciones: OpcionesSelectorCapas) {
    const elemento = crear('div', 'sc ol-unselectable');
    // La raíz cubre todo el mapa: sin esto OpenLayers le pone pointer-events: auto y bloquea
    // el zoom y el arrastre del mapa. Solo el panel, los chips y el botón reciben clics (ver CSS)
    elemento.style.pointerEvents = 'none';
    super({ element: elemento, target: opciones.target });
    this.opciones = opciones;
    this.grupos = opciones.grupos || [];
    this.mapasBase = (opciones.mapasBase || []).filter((m): m is MapaBase & { capa: BaseLayer } => Boolean(m && m.capa));
    this._id = 'sc' + (++contadorIds);
    this._construir();
  }

  /* ---------- construcción ---------- */

  private _construir() {
    const raiz = this.element as HTMLElement; // Creado en el constructor
    const titulo = this.opciones.titulo || 'Capas';

    // Tarjeta (escritorio) / hoja inferior (celular)
    const panel = (this._panel = crear('section', 'sc-panel', { 'aria-label': titulo }));
    const cabecera = crear('header', 'sc-cabecera');
    const textos = crear('div', 'sc-titulos');
    textos.appendChild(crear('h2', 'sc-titulo', { texto: titulo }));
    this._contador = crear('p', 'sc-contador', { 'aria-live': 'polite' });
    textos.appendChild(this._contador);
    cabecera.appendChild(textos);

    this._botonMin = crear('button', 'sc-boton sc-minimizar', { type: 'button', 'aria-expanded': 'true', title: 'Minimizar', html: ICONOS.minimizar });
    this._botonMin.addEventListener('click', () => this._minimizar(!panel.classList.contains('sc-minimizado'), true));
    const botonCerrar = crear('button', 'sc-boton sc-cerrar', { type: 'button', title: 'Cerrar', 'aria-label': 'Cerrar', html: ICONOS.cerrar });
    botonCerrar.addEventListener('click', () => raiz.classList.remove('sc-hoja-abierta'));
    cabecera.appendChild(this._botonMin);
    cabecera.appendChild(botonCerrar);
    panel.appendChild(cabecera);

    const cuerpo = crear('div', 'sc-cuerpo');
    this.grupos.forEach((g, i) => {
      const idTitulo = this._id + '-g' + i;
      const seccion = crear('div', 'sc-grupo', { role: 'group', 'aria-labelledby': idTitulo });
      seccion.appendChild(crear('h3', 'sc-grupo-titulo', { id: idTitulo, texto: g.titulo }));
      (g.capas || []).forEach((def) => seccion.appendChild(this._fila(def)));
      cuerpo.appendChild(seccion);
    });

    if (this.mapasBase.length) {
      const base = crear('div', 'sc-grupo sc-base');
      base.appendChild(crear('h3', 'sc-grupo-titulo', { texto: 'Mapa base' }));
      const segmentos = crear('div', 'sc-segmentos', { role: 'radiogroup', 'aria-label': 'Mapa base' });
      this.mapasBase.forEach((mb) => {
        const b = crear('button', 'sc-segmento', { type: 'button', role: 'radio', 'aria-checked': 'false', texto: mb.nombre });
        b.addEventListener('click', () => this.elegirMapaBase(mb));
        this._botonesBase.push({ mb, b });
        segmentos.appendChild(b);
      });
      base.appendChild(segmentos);
      cuerpo.appendChild(base);
    }
    panel.appendChild(cuerpo);
    raiz.appendChild(panel);

    // Celular: botón flotante + ventana de mapa base
    const fab = (this._fab = crear('button', 'sc-fab', { type: 'button', 'aria-label': 'Capas y mapa base', 'aria-expanded': 'false', html: ICONOS.capas }));
    const pop = (this._pop = crear('div', 'sc-popover'));
    pop.hidden = true;
    if (this.mapasBase.length) {
      pop.appendChild(crear('h3', 'sc-pop-titulo', { texto: 'Mapa base' }));
      const minis = crear('div', 'sc-minis', { role: 'radiogroup', 'aria-label': 'Mapa base' });
      this.mapasBase.forEach((mb) => {
        const b = crear('button', 'sc-mini', { type: 'button', role: 'radio', 'aria-checked': 'false' });
        const img = crear('span', 'sc-mini-img');
        const m = mb.miniatura || '#D9D5CC';
        if (/^(#|rgb|hsl)/.test(m)) img.style.backgroundColor = m;
        else img.style.backgroundImage = 'url("' + m.replace(/"/g, '%22') + '")';
        b.appendChild(img);
        b.appendChild(crear('span', 'sc-mini-nombre', { texto: mb.nombre }));
        b.addEventListener('click', () => this.elegirMapaBase(mb));
        this._botonesBase.push({ mb, b });
        minis.appendChild(b);
      });
      pop.appendChild(minis);
    }
    const todas = crear('button', 'sc-todas', { type: 'button', texto: 'Ver todas las capas' });
    todas.addEventListener('click', () => {
      this._cerrarPopover();
      raiz.classList.add('sc-hoja-abierta');
    });
    pop.appendChild(todas);
    fab.addEventListener('click', () => (pop.hidden ? this._abrirPopover() : this._cerrarPopover()));

    // Celular: chips
    const barra = crear('div', 'sc-chips', { role: 'toolbar', 'aria-label': 'Capas' });
    this.grupos.forEach((g) => {
      const capas = (g.capas || []).filter((d): d is DefinicionCapa & { capa: BaseLayer } => Boolean(d.capa));
      if (g.chips === false || !capas.length) return;
      if (g.chips === 'capas') {
        capas.forEach((d) => this._chip(barra, d.nombreCorto || d.nombre, [d.capa]));
      } else {
        this._chip(barra, g.nombreCorto || g.titulo, capas.map((d) => d.capa));
      }
    });

    raiz.appendChild(fab);
    raiz.appendChild(pop);
    raiz.appendChild(barra);

    try {
      if (localStorage.getItem(CLAVE_MINIMIZADO) === '1') this._minimizar(true, false);
    } catch { /* sin almacenamiento: queda abierto */ }
  }

  private _fila(def: DefinicionCapa) {
    const capa = def.capa;
    if (!capa) console.warn('SelectorCapas: no se encontró la capa de "' + def.nombre + '".');
    const idNombre = this._id + '-c' + this._filas.length;
    const fila = crear('div', 'sc-fila');
    const linea = crear('div', 'sc-linea');
    linea.appendChild(simbolo(def.simbolo));
    const nombre = crear('span', 'sc-nombre', { id: idNombre, texto: def.nombre });
    linea.appendChild(nombre);

    const interruptor = crear('button', 'sc-switch', { type: 'button', role: 'switch', 'aria-checked': 'false', 'aria-labelledby': idNombre });
    const registro: Fila = { capa, fila, interruptor };
    const conOpacidad = def.opacidad !== false;
    if (capa && (conOpacidad || def.leyenda)) {
      const mas = crear('button', 'sc-boton sc-mas', { type: 'button', 'aria-expanded': 'false', 'aria-label': 'Más opciones de ' + def.nombre, html: ICONOS.chevron });
      const detalle = crear('div', 'sc-detalle');
      detalle.hidden = true;
      if (conOpacidad) {
        const etiqueta = crear('label', 'sc-opacidad');
        etiqueta.appendChild(crear('span', null, { texto: 'Opacidad' }));
        const rango = crear('input', null, { type: 'range', min: '0', max: '100', step: '5' });
        const valor = crear('output', 'sc-valor');
        rango.addEventListener('input', () => capa.setOpacity(Number(rango.value) / 100));
        etiqueta.appendChild(rango);
        etiqueta.appendChild(valor);
        detalle.appendChild(etiqueta);
        registro.rango = rango;
        registro.valor = valor;
      }
      if (def.leyenda && def.leyenda.length) {
        const lista = crear('ul', 'sc-leyenda');
        def.leyenda.forEach((it) => {
          const li = crear('li');
          li.appendChild(it.icono ? simbolo({ tipo: 'icono', src: it.icono }) : simbolo(it.simbolo));
          li.appendChild(crear('span', null, { texto: it.texto }));
          lista.appendChild(li);
        });
        detalle.appendChild(lista);
      }
      mas.addEventListener('click', () => {
        const abrir = detalle.hidden;
        detalle.hidden = !abrir;
        mas.setAttribute('aria-expanded', String(abrir));
      });
      linea.appendChild(mas);
      fila.appendChild(linea);
      fila.appendChild(detalle);
    } else {
      fila.appendChild(linea);
    }

    if (capa) {
      interruptor.addEventListener('click', () => capa.setVisible(!capa.getVisible()));
      // El nombre funciona como la etiqueta del interruptor: tocarlo también enciende o apaga la capa,
      // así la zona táctil abarca casi toda la fila
      nombre.addEventListener('click', () => interruptor.click());
      nombre.classList.add('sc-nombre-activo');
    } else {
      interruptor.disabled = true;
    }
    linea.appendChild(interruptor);
    this._filas.push(registro);
    return fila;
  }

  private _chip(barra: HTMLElement, texto: string, capas: BaseLayer[]) {
    const b = crear('button', 'sc-chip', { type: 'button', 'aria-pressed': 'false', texto });
    b.addEventListener('click', () => {
      const encender = b.getAttribute('aria-pressed') !== 'true';
      capas.forEach((c) => c.setVisible(encender));
    });
    this._chips.push({ b, capas });
    barra.appendChild(b);
  }

  /* ---------- estado ---------- */

  setMap(map: Map | null) {
    unByKey(this._claves);
    this._claves = [];
    if (this._alPulsarFuera) document.removeEventListener('pointerdown', this._alPulsarFuera, true);
    super.setMap(map);
    if (!map) return;

    const capas = this._filas.map((f) => f.capa)
      .concat(this.mapasBase.map((m) => m.capa))
      .filter((c): c is BaseLayer => Boolean(c));
    capas.forEach((c) => this._claves.push(
      c.on('change:visible', () => this.actualizar()),
      c.on('change:opacity', () => this.actualizar())
    ));

    // Un solo mapa base visible
    if (this.mapasBase.length) {
      const visible = this.mapasBase.filter((m) => m.capa.getVisible())[0];
      this.elegirMapaBase(visible || this.mapasBase[0]);
    }

    this._alPulsarFuera = (e) => {
      const objetivo = e.target as Node;
      if (!this._pop.hidden && !this._pop.contains(objetivo) && !this._fab.contains(objetivo)) this._cerrarPopover();
    };
    document.addEventListener('pointerdown', this._alPulsarFuera, true);
    this.actualizar();
  }

  /** Vuelve a leer visibilidad y opacidad de las capas. */
  actualizar() {
    let activas = 0, total = 0;
    this._filas.forEach((f) => {
      if (!f.capa) return;
      const on = f.capa.getVisible();
      total++;
      if (on) activas++;
      f.interruptor.setAttribute('aria-checked', String(on));
      f.fila.classList.toggle('sc-apagada', !on);
      if (f.rango && f.valor) {
        const pct = Math.round(f.capa.getOpacity() * 100);
        if (document.activeElement !== f.rango) f.rango.value = String(pct);
        f.rango.style.setProperty('--sc-pct', pct + '%');
        f.valor.textContent = pct + ' %';
      }
    });
    this._contador.textContent = activas + ' de ' + total + ' activas';
    this._chips.forEach((ch) => {
      const on = ch.capas.some((c) => c.getVisible());
      ch.b.setAttribute('aria-pressed', String(on));
    });
    this._botonesBase.forEach((x) => {
      x.b.setAttribute('aria-checked', String(x.mb.capa.getVisible()));
    });
  }

  elegirMapaBase(mb: MapaBase & { capa: BaseLayer }) {
    this.mapasBase.forEach((m) => m.capa.setVisible(m === mb));
    this.actualizar();
  }

  private _minimizar(si: boolean, guardar: boolean) {
    this._panel.classList.toggle('sc-minimizado', si);
    this._botonMin.setAttribute('aria-expanded', String(!si));
    this._botonMin.title = si ? 'Mostrar capas' : 'Minimizar';
    this._botonMin.innerHTML = si ? ICONOS.expandir : ICONOS.minimizar;
    if (guardar) {
      try { localStorage.setItem(CLAVE_MINIMIZADO, si ? '1' : '0'); } catch { /* ignorar */ }
    }
  }

  private _abrirPopover() {
    this._pop.hidden = false;
    this._fab.setAttribute('aria-expanded', 'true');
  }

  private _cerrarPopover() {
    this._pop.hidden = true;
    this._fab.setAttribute('aria-expanded', 'false');
  }
}
