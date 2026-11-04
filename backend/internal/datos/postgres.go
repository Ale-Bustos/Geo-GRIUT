package datos

import (
	"context"
	"errors"
	"sort"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Postgres implementa Almacen sobre PostGIS.
type Postgres struct {
	pool *pgxpool.Pool
}

func NuevoPostgres(ctx context.Context, url string) (*Postgres, error) {
	pool, err := pgxpool.New(ctx, url)
	if err != nil {
		return nil, err
	}
	return &Postgres{pool: pool}, nil
}

func (p *Postgres) Cerrar() { p.pool.Close() }

func (p *Postgres) Salud(ctx context.Context) error { return p.pool.Ping(ctx) }

// sqlLugares une todas las capas de puntos (capa, id, nombre, geom); se arma una sola vez desde la
// lista fija Capas, nunca con lo que llega en la URL.
var sqlLugares = func() string {
	nombres := make([]string, 0, len(Capas))
	for capa := range Capas {
		nombres = append(nombres, capa)
	}
	sort.Strings(nombres) // SQL estable entre arranques
	partes := make([]string, len(nombres))
	for i, capa := range nombres {
		partes[i] = "SELECT '" + capa + "'::text AS capa, id, nombre, geom FROM " + Capas[capa]
	}
	return strings.Join(partes, " UNION ALL ")
}()

// sqlBusqueda busca por nombre en todas las capas de puntos.
var sqlBusqueda = func() string {
	// griut.normalizar quita tildes y pasa a minúsculas; el % de LIKE se escapa en escaparLike
	return `WITH lugares AS (` + sqlLugares + `)
		SELECT capa, id, nombre, ST_X(geom), ST_Y(geom) FROM lugares
		WHERE griut.normalizar(nombre) LIKE '%' || griut.normalizar($1) || '%'
		ORDER BY griut.normalizar(nombre) LIKE griut.normalizar($1) || '%' DESC,
			similarity(griut.normalizar(nombre), griut.normalizar($1)) DESC, nombre
		LIMIT $2`
}()

func escaparLike(s string) string {
	return strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`).Replace(s)
}

func (p *Postgres) Buscar(ctx context.Context, q string, limite int) ([]Resultado, error) {
	filas, err := p.pool.Query(ctx, sqlBusqueda, escaparLike(q), limite)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(filas, func(f pgx.CollectableRow) (Resultado, error) {
		var r Resultado
		err := f.Scan(&r.Capa, &r.ID, &r.Nombre, &r.Lon, &r.Lat)
		return r, err
	})
}

func (p *Postgres) Elemento(ctx context.Context, capa string, id int) (*Elemento, error) {
	tabla, ok := Capas[capa]
	if !ok {
		return nil, ErrNoEncontrado
	}
	e := &Elemento{Type: "Feature", Capa: capa}
	err := p.pool.QueryRow(ctx,
		`SELECT id, nombre, propiedades, ST_AsGeoJSON(geom)::json FROM `+tabla+` WHERE id = $1`, id,
	).Scan(&e.ID, &e.Nombre, &e.Propiedades, &e.Geometria)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNoEncontrado
	}
	if err != nil {
		return nil, err
	}
	return e, nil
}

// sqlRelacionados tiene una consulta por capa de origen: la tabla sale de la lista fija Capas y todo
// lo demás va como parámetro ($1 id, $2 radio en metros, $3 límite por capa, $4 nombre de la capa).
// El LEFT JOIN deja una fila con nulos si el punto existe pero no tiene vecinos, y ninguna si no existe.
var sqlRelacionados = func() map[string]string {
	consultas := make(map[string]string, len(Capas))
	for capa, tabla := range Capas {
		consultas[capa] = `WITH o AS (SELECT geom::geography AS g FROM ` + tabla + ` WHERE id = $1)
			SELECT r.capa, r.id, r.nombre, round(r.d)::float8 FROM o LEFT JOIN LATERAL (
				SELECT capa, id, nombre, d FROM (
					SELECT l.capa, l.id, l.nombre, ST_Distance(o.g, l.geom::geography) AS d,
						row_number() OVER (PARTITION BY l.capa ORDER BY ST_Distance(o.g, l.geom::geography), l.id) AS n
					FROM (` + sqlLugares + `) l
					WHERE ST_DWithin(o.g, l.geom::geography, $2) AND NOT (l.capa = $4::text AND l.id = $1)
				) c WHERE n <= $3
			) r ON true
			ORDER BY r.d, r.capa, r.id`
	}
	return consultas
}()

func (p *Postgres) Relacionados(ctx context.Context, capa string, id int, radioM float64, limitePorCapa int) ([]Relacionado, error) {
	consulta, ok := sqlRelacionados[capa]
	if !ok {
		return nil, ErrNoEncontrado
	}
	filas, err := p.pool.Query(ctx, consulta, id, radioM, limitePorCapa, capa)
	if err != nil {
		return nil, err
	}
	existe := false
	relacionados, err := pgx.CollectRows(filas, func(f pgx.CollectableRow) (*Relacionado, error) {
		existe = true
		var (
			c, nombre *string
			i         *int
			d         *float64
		)
		if err := f.Scan(&c, &i, &nombre, &d); err != nil || c == nil {
			return nil, err // c nulo: el punto existe pero no tiene vecinos
		}
		return &Relacionado{Capa: *c, ID: *i, Nombre: *nombre, DistanciaM: *d}, nil
	})
	if err != nil {
		return nil, err
	}
	if !existe {
		return nil, ErrNoEncontrado
	}
	resultado := []Relacionado{}
	for _, r := range relacionados {
		if r != nil {
			resultado = append(resultado, *r)
		}
	}
	return resultado, nil
}

// Suma manzanas urbanas y localidades rurales por comuna. reservado = 1 marca los datos que el
// INE no publica (personas_indigenas viene nulo)
const sqlComunas = `
	WITH zonas AS (
		SELECT comuna, total_personas, personas_indigenas, reservado,
			total_personas_2017, personas_indigenas_2017 FROM griut.poblacion_indigena_mz_2024
		UNION ALL
		SELECT comuna, total_personas, personas_indigenas, reservado,
			total_personas_2017, personas_indigenas_2017 FROM griut.poblacion_indigena_loc_2024
	), c AS (
		SELECT comuna,
			coalesce(sum(total_personas), 0) AS total,
			coalesce(sum(personas_indigenas) FILTER (WHERE reservado = 0), 0) AS indigenas,
			coalesce(sum(total_personas) FILTER (WHERE reservado = 0), 0) AS total_publicado,
			coalesce(sum(total_personas) FILTER (WHERE reservado = 1), 0) AS en_reservadas,
			count(*) FILTER (WHERE reservado = 1) AS reservadas,
			sum(total_personas_2017) AS total_2017,
			sum(personas_indigenas_2017) AS indigenas_2017
		FROM zonas GROUP BY comuna
	)
	SELECT comuna, total, indigenas,
		round(100.0 * indigenas / nullif(total_publicado, 0), 2)::float8,
		en_reservadas, reservadas, total_2017, indigenas_2017,
		round(100.0 * indigenas_2017 / nullif(total_2017, 0), 2)::float8
	FROM c ORDER BY comuna`

func (p *Postgres) Comunas(ctx context.Context) ([]Comuna, error) {
	filas, err := p.pool.Query(ctx, sqlComunas)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(filas, func(f pgx.CollectableRow) (Comuna, error) {
		var c Comuna
		err := f.Scan(&c.Comuna, &c.TotalPersonas, &c.PersonasIndigenas, &c.PorcIndigena,
			&c.PersonasEnReservadas, &c.ZonasReservadas, &c.TotalPersonas2017, &c.PersonasIndigenas2017, &c.PorcIndigena2017)
		return c, err
	})
}
