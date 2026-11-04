// Package datos lee las capas del esquema griut de PostGIS.
package datos

import (
	"context"
	"encoding/json"
	"errors"
)

// ErrNoEncontrado indica que el elemento pedido no existe.
var ErrNoEncontrado = errors.New("no encontrado")

// Capas de puntos que se pueden buscar y consultar, con su tabla en el esquema griut.
// La API solo acepta estos nombres: nunca se arma SQL con lo que llega en la URL.
var Capas = map[string]string{
	"toponimos":              "griut.toponimos",
	"puntos-historicos":      "griut.puntos_historicos",
	"puntos-resignificacion": "griut.puntos_resignificacion",
	"conflictos":             "griut.conflictos",
}

// Resultado es un lugar encontrado por nombre.
type Resultado struct {
	Capa   string  `json:"capa"`
	ID     int     `json:"id"`
	Nombre string  `json:"nombre"`
	Lon    float64 `json:"lon"`
	Lat    float64 `json:"lat"`
}

// Elemento es la ficha completa de un punto como Feature GeoJSON.
type Elemento struct {
	Type        string          `json:"type"` // Siempre "Feature"
	ID          int             `json:"id"`
	Capa        string          `json:"capa"`
	Nombre      string          `json:"nombre"`
	Propiedades json.RawMessage `json:"properties"`
	Geometria   json.RawMessage `json:"geometry"`
}

// Relacionado es un lugar cercano a otro, con la distancia entre ambos sobre el elipsoide.
type Relacionado struct {
	Capa       string  `json:"capa"`
	ID         int     `json:"id"`
	Nombre     string  `json:"nombre"`
	DistanciaM float64 `json:"distancia_m"`
}

// Comuna resume la población indígena de una comuna en el Censo 2024 y en el de 2017.
// Las manzanas y localidades con dato reservado por el INE no suman personas indígenas:
// se informan aparte para no confundirlas con cero.
type Comuna struct {
	Comuna                string   `json:"comuna"`
	TotalPersonas         int64    `json:"total_personas"`
	PersonasIndigenas     int64    `json:"personas_indigenas"`
	PorcIndigena          *float64 `json:"porc_indigena"` // Sobre las personas de zonas no reservadas
	PersonasEnReservadas  int64    `json:"personas_en_reservadas"`
	ZonasReservadas       int64    `json:"zonas_reservadas"`
	TotalPersonas2017     *int64   `json:"total_personas_2017"`
	PersonasIndigenas2017 *int64   `json:"personas_indigenas_2017"`
	PorcIndigena2017      *float64 `json:"porc_indigena_2017"`
}

// Almacen es lo que la API necesita de la base de datos.
type Almacen interface {
	Salud(ctx context.Context) error
	Buscar(ctx context.Context, q string, limite int) ([]Resultado, error)
	Elemento(ctx context.Context, capa string, id int) (*Elemento, error)
	// Relacionados devuelve los lugares de todas las capas de Capas a menos de radioM metros del
	// punto capa/id (sin incluirlo), del más cercano al más lejano y como mucho limitePorCapa por
	// capa. ErrNoEncontrado si el punto no existe.
	Relacionados(ctx context.Context, capa string, id int, radioM float64, limitePorCapa int) ([]Relacionado, error)
	Comunas(ctx context.Context) ([]Comuna, error)
	// Tesela devuelve la tesela MVT z/x/y (esquema XYZ) de una capa de CapasTeselas; vacía si no hay nada
	Tesela(ctx context.Context, capa string, z, x, y int) ([]byte, error)
}
