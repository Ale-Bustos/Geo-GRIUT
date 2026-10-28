// Añade los matchers de jest-dom (toBeInTheDocument, etc.) a expect de Vitest
import '@testing-library/jest-dom/vitest';

// jsdom no implementa ResizeObserver, que OpenLayers usa para detectar cambios de tamaño del mapa
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;
