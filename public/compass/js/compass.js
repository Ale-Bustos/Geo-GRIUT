import 'ol/ol.css';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';

// Crear el mapa
const map = new Map({
    target: 'map',
    layers: [
        new TileLayer({
            source: new OSM(),
        }),
    ],
    view: new View({
        center: [0, 0],
        zoom: 2,
        rotation: -Math.PI / 2  // Girar el mapa 90 grados para que el este esté hacia arriba
    }),
});

// Añadir la brújula
const compass = document.getElementById('compass');

// Función para actualizar la orientación de la brújula
map.getView().on('change:rotation', function () {
    const rotation = map.getView().getRotation();
    compass.style.transform = 'rotate(' + (rotation + Math.PI / 2) + 'rad)'; // Ajustar la brújula para que apunte al este
});
