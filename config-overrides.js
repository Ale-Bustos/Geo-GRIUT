const { override, addWebpackAlias } = require('customize-cra');
const path = require('path');

module.exports = override(
  addWebpackAlias({
    'ol/Map': path.resolve(__dirname, 'node_modules/ol/Map.js'),
    'ol/View': path.resolve(__dirname, 'node_modules/ol/View.js'),
    'ol/layer/Group': path.resolve(__dirname, 'node_modules/ol/layer/Group.js'),
    'ol/layer/Tile': path.resolve(__dirname, 'node_modules/ol/layer/Tile.js'),
    'ol/source/TileImage': path.resolve(__dirname, 'node_modules/ol/source/TileImage.js'),
    'ol/proj': path.resolve(__dirname, 'node_modules/ol/proj.js'),
    'ol/control': path.resolve(__dirname, 'node_modules/ol/control.js'),
    'ol/layer/Vector': path.resolve(__dirname, 'node_modules/ol/layer/Vector.js'),
    'ol/source/Vector': path.resolve(__dirname, 'node_modules/ol/source/Vector.js'),
    'ol/format/GeoJSON': path.resolve(__dirname, 'node_modules/ol/format/GeoJSON.js'),
    'ol/style': path.resolve(__dirname, 'node_modules/ol/style.js'),
    'ol-ext/control/LayerSwitcher': path.resolve(__dirname, 'node_modules/ol-ext/control/LayerSwitcher.js'),
    'ol/geom': path.resolve(__dirname, 'node_modules/ol/geom.js')
  })
);
