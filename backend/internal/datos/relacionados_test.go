package datos

import (
	"context"
	"errors"
	"os"
	"regexp"
	"strings"
	"testing"
)

func TestSQLRelacionadosUsaParametros(t *testing.T) {
	if len(sqlRelacionados) != len(Capas) {
		t.Fatalf("%d consultas para %d capas", len(sqlRelacionados), len(Capas))
	}
	tablas := regexp.MustCompile(`FROM (griut\.[a-z_]+)`)
	for capa, sql := range sqlRelacionados {
		for _, p := range []string{"$1", "$2", "$3", "$4", "::geography", "ST_DWithin("} {
			if !strings.Contains(sql, p) {
				t.Errorf("%s: falta %s", capa, p)
			}
		}
		if !strings.HasPrefix(sql, "WITH o AS (SELECT geom::geography AS g FROM "+Capas[capa]+" WHERE id = $1)") {
			t.Errorf("%s: el origen no sale de su tabla", capa)
		}
		for _, m := range tablas.FindAllStringSubmatch(sql, -1) {
			if !esTablaPermitida(m[1]) {
				t.Errorf("%s: tabla fuera de la lista blanca %s", capa, m[1])
			}
		}
	}
}

func esTablaPermitida(tabla string) bool {
	for _, permitida := range Capas {
		if permitida == tabla {
			return true
		}
	}
	return false
}

func TestRelacionadosCapaDesconocida(t *testing.T) {
	var p Postgres // Sin conexión: la capa se rechaza antes de consultar
	if _, err := p.Relacionados(context.Background(), "griut.rios; --", 1, 1000, 5); !errors.Is(err, ErrNoEncontrado) {
		t.Fatalf("se esperaba ErrNoEncontrado y llegó %v", err)
	}
}

// Contra una base real con las tablas griut.* cargadas, p. ej.
// PRUEBA_DATABASE_URL=postgres://… go test ./internal/datos -run Postgres
func TestRelacionadosPostgres(t *testing.T) {
	url := os.Getenv("PRUEBA_DATABASE_URL")
	if url == "" {
		t.Skip("sin PRUEBA_DATABASE_URL")
	}
	ctx := context.Background()
	p, err := NuevoPostgres(ctx, url)
	if err != nil {
		t.Fatal(err)
	}
	defer p.Cerrar()

	if _, err := p.Relacionados(ctx, "conflictos", 999999, 5000, 5); !errors.Is(err, ErrNoEncontrado) {
		t.Errorf("punto inexistente: %v", err)
	}
	vacio, err := p.Relacionados(ctx, "conflictos", 1, 1, 5)
	if err != nil || vacio == nil || len(vacio) != 0 {
		t.Errorf("radio de 1 m: %v %v", vacio, err)
	}
	rel, err := p.Relacionados(ctx, "toponimos", 1, 20000, 2)
	if err != nil {
		t.Fatal(err)
	}
	porCapa := map[string]int{}
	for i, r := range rel {
		porCapa[r.Capa]++
		if r.Capa == "toponimos" && r.ID == 1 {
			t.Error("el propio lugar aparece entre sus relacionados")
		}
		if r.DistanciaM > 20000 || (i > 0 && r.DistanciaM < rel[i-1].DistanciaM) {
			t.Errorf("distancias fuera de orden o de radio: %v", rel)
		}
	}
	for capa, n := range porCapa {
		if n > 2 {
			t.Errorf("%s: %d relacionados con límite 2", capa, n)
		}
	}
	if len(rel) == 0 {
		t.Error("sin relacionados a 20 km de Anca-lighen")
	}
}
