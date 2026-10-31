package datos

import (
	"context"
	"fmt"
	"strings"
)

// CapaTeselas describe una capa que se sirve como teselas vectoriales (MVT).
type CapaTeselas struct {
	Tabla    string
	Columnas []string // Propiedades que lleva cada elemento; las que usa el mapa para estilos, nombres y popup
	ZoomMin  int      // Más lejos la tesela va vacía: el mapa no muestra la capa a ese zoom
}

// Capas que se sirven como teselas. Como en Capas, la URL solo elige entre estos nombres.
var CapasTeselas = map[string]CapaTeselas{
	"rios":       {Tabla: "griut.rios", Columnas: []string{"Nombre"}, ZoomMin: 10},
	"esteros":    {Tabla: "griut.esteros", Columnas: []string{"Nombre"}, ZoomMin: 10},
	"quebradas":  {Tabla: "griut.quebradas", Columnas: []string{"Nombre"}, ZoomMin: 10},
	"prov_conce": {Tabla: "griut.prov_conce", Columnas: []string{"Comuna", "Provincia"}, ZoomMin: 0},
	"poblacion_indigena_mz_2024": {Tabla: "griut.poblacion_indigena_mz_2024", ZoomMin: 11, Columnas: []string{
		"censo", "comuna", "entidad", "total_personas", "personas_indigenas", "porc_indigena", "reservado",
		"lengua_indigena", "viviendas_indigenas", "total_personas_2017", "personas_indigenas_2017", "porc_indigena_2017"}},
	"poblacion_indigena_loc_2024": {Tabla: "griut.poblacion_indigena_loc_2024", ZoomMin: 9, Columnas: []string{
		"censo", "comuna", "localidad", "total_personas", "personas_indigenas", "porc_indigena", "reservado",
		"lengua_indigena", "viviendas_indigenas", "total_personas_2017", "personas_indigenas_2017", "porc_indigena_2017"}},
}

const (
	extensionMVT = 4096 // Resolución de la tesela, la de siempre en MVT
	bordeMVT     = 64   // Margen fuera de la tesela, para que líneas y contornos no se corten en el borde
)

// SQLTesela arma la consulta de una capa: recorta en 3857 lo que toca la tesela (con margen) y la
// codifica con ST_AsMVT. La capa dentro de la tesela se llama como la capa de la API.
func SQLTesela(nombre string, c CapaTeselas) string {
	cols := make([]string, len(c.Columnas))
	for i, col := range c.Columnas {
		cols[i] = `t."` + col + `"`
	}
	props := ""
	if len(cols) > 0 {
		props = ", " + strings.Join(cols, ", ")
	}
	return fmt.Sprintf(`WITH b AS (
			SELECT ST_TileEnvelope($1, $2, $3) AS env,
				ST_Transform(ST_TileEnvelope($1, $2, $3, margin => %[1]d.0 / %[2]d), 4326) AS env4326
		), m AS (
			SELECT ST_AsMVTGeom(ST_Transform(t.geom, 3857), b.env, %[2]d, %[1]d, true) AS geom%[3]s
			FROM %[4]s t, b
			WHERE t.geom && b.env4326
		)
		SELECT coalesce(ST_AsMVT(m.*, '%[5]s', %[2]d, 'geom'), ''::bytea) FROM m WHERE geom IS NOT NULL`,
		bordeMVT, extensionMVT, props, c.Tabla, nombre)
}

func (p *Postgres) Tesela(ctx context.Context, capa string, z, x, y int) ([]byte, error) {
	c, ok := CapasTeselas[capa]
	if !ok {
		return nil, ErrNoEncontrado
	}
	if z < c.ZoomMin {
		return []byte{}, nil
	}
	var mvt []byte
	err := p.pool.QueryRow(ctx, sqlTeselas[capa], z, x, y).Scan(&mvt)
	return mvt, err
}

// Consultas armadas una sola vez al arrancar
var sqlTeselas = func() map[string]string {
	m := make(map[string]string, len(CapasTeselas))
	for nombre, c := range CapasTeselas {
		m[nombre] = SQLTesela(nombre, c)
	}
	return m
}()
