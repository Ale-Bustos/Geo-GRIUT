package datos

import (
	"strings"
	"testing"
)

func TestSQLTesela(t *testing.T) {
	sql := SQLTesela("rios", CapasTeselas["rios"])
	for _, parte := range []string{`t."Nombre"`, "FROM griut.rios t", "'rios', 4096", "margin => 64.0 / 4096", "4096, 64, true"} {
		if !strings.Contains(sql, parte) {
			t.Errorf("falta %q en:\n%s", parte, sql)
		}
	}
	// Todas las capas arman su consulta y sus columnas son identificadores simples
	for nombre, c := range CapasTeselas {
		if sqlTeselas[nombre] == "" {
			t.Errorf("%s sin consulta", nombre)
		}
		for _, col := range c.Columnas {
			if strings.ContainsAny(col, `"';`) {
				t.Errorf("%s: columna sospechosa %q", nombre, col)
			}
		}
	}
}
