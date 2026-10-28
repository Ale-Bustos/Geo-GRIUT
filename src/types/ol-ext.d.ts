// ol-ext no publica tipos; se declara solo lo que usa la aplicación
declare module 'ol-ext/control/LayerSwitcher' {
  import Control from 'ol/control/Control';

  interface LayerSwitcherOptions {
    activationMode?: 'mouseover' | 'click';
    startActive?: boolean;
    tipLabel?: string;
    groupSelectStyle?: 'none' | 'children' | 'group';
    collapseTipLabel?: string;
  }

  export default class LayerSwitcher extends Control {
    constructor(options?: LayerSwitcherOptions);
    element: HTMLElement;
  }
}
