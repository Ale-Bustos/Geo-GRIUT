package api

import (
	"bytes"
	"compress/gzip"
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/Ale-Bustos/Geo-GRIUT/backend/internal/datos"
)

// almacenFalso responde sin base de datos y recuerda con qué se llamó.
type almacenFalso struct {
	errSalud  error
	q         string
	limite    int
	elementos map[int]*datos.Elemento
	pánico    bool
	teselas   int    // Teselas pedidas a la base
	tesela    []byte // Lo que devuelve Tesela; por defecto, "<capa>-mvt"
	// Relacionados: con qué se llamó y qué devuelve (nil y sin error = punto sin vecinos)
	relCapa      string
	relID        int
	relRadio     float64
	relLimite    int
	relacionados []datos.Relacionado
	errRel       error
}

func (a *almacenFalso) Salud(context.Context) error { return a.errSalud }

func (a *almacenFalso) Buscar(_ context.Context, q string, limite int) ([]datos.Resultado, error) {
	if a.pánico {
		panic("falla")
	}
	a.q, a.limite = q, limite
	if q == "nada" {
		return nil, nil
	}
	return []datos.Resultado{{Capa: "toponimos", ID: 16, Nombre: "Tralkawenu", Lon: -73.1, Lat: -36.7}}, nil
}

func (a *almacenFalso) Elemento(_ context.Context, capa string, id int) (*datos.Elemento, error) {
	if e, ok := a.elementos[id]; ok {
		return e, nil
	}
	return nil, datos.ErrNoEncontrado
}

func (a *almacenFalso) Relacionados(_ context.Context, capa string, id int, radioM float64, limitePorCapa int) ([]datos.Relacionado, error) {
	a.relCapa, a.relID, a.relRadio, a.relLimite = capa, id, radioM, limitePorCapa
	return a.relacionados, a.errRel
}

func (a *almacenFalso) Comunas(context.Context) ([]datos.Comuna, error) {
	return nil, errors.New("sin tablas")
}

func (a *almacenFalso) Tesela(_ context.Context, capa string, z, x, y int) ([]byte, error) {
	a.teselas++
	if a.tesela != nil {
		return a.tesela, nil
	}
	return []byte(capa + "-mvt"), nil
}

func servidorDePrueba(a *almacenFalso) http.Handler {
	return NuevoServidor(a, "prueba", []string{"https://geo-griut.vercel.app", "https://*.vercel.app"}, slog.New(slog.NewTextHandler(io.Discard, nil))).Handler()
}

func pedir(t *testing.T, h http.Handler, metodo, ruta string, cabeceras map[string]string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(metodo, ruta, nil)
	for k, v := range cabeceras {
		req.Header.Set(k, v)
	}
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

func TestSalud(t *testing.T) {
	if rec := pedir(t, servidorDePrueba(&almacenFalso{}), "GET", "/api/salud", nil); rec.Code != http.StatusOK {
		t.Fatalf("estado %d", rec.Code)
	}
	rec := pedir(t, servidorDePrueba(&almacenFalso{errSalud: errors.New("caída")}), "GET", "/api/salud", nil)
	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("con la base caída se esperaba 503 y llegó %d", rec.Code)
	}
}

func TestBuscarValida(t *testing.T) {
	casos := []struct {
		ruta   string
		estado int
	}{
		{"/api/buscar", http.StatusBadRequest},
		{"/api/buscar?q=a", http.StatusBadRequest},
		{"/api/buscar?q=%20%20a%20", http.StatusBadRequest},
		{"/api/buscar?q=ñu", http.StatusOK}, // Dos letras aunque sean 3 bytes
		{"/api/buscar?q=tral&limite=0", http.StatusBadRequest},
		{"/api/buscar?q=tral&limite=51", http.StatusBadRequest},
		{"/api/buscar?q=tral&limite=x", http.StatusBadRequest},
		{"/api/buscar?q=tral&limite=50", http.StatusOK},
	}
	for _, c := range casos {
		if rec := pedir(t, servidorDePrueba(&almacenFalso{}), "GET", c.ruta, nil); rec.Code != c.estado {
			t.Errorf("%s: estado %d, se esperaba %d", c.ruta, rec.Code, c.estado)
		}
	}
}

func TestBuscarResponde(t *testing.T) {
	a := &almacenFalso{}
	rec := pedir(t, servidorDePrueba(a), "GET", "/api/buscar?q=%20Tral%20", nil)
	if a.q != "Tral" || a.limite != limitePorDefecto {
		t.Errorf("se buscó %q con límite %d", a.q, a.limite)
	}
	var r []datos.Resultado
	if err := json.Unmarshal(rec.Body.Bytes(), &r); err != nil || len(r) != 1 || r[0].Nombre != "Tralkawenu" {
		t.Fatalf("respuesta inesperada: %s", rec.Body)
	}
	if rec.Header().Get("Cache-Control") != cachePublica {
		t.Errorf("Cache-Control = %q", rec.Header().Get("Cache-Control"))
	}

	rec = pedir(t, servidorDePrueba(a), "GET", "/api/buscar?q=nada", nil)
	if body := rec.Body.String(); body != "[]\n" {
		t.Errorf("sin resultados se esperaba [] y llegó %q", body)
	}
}

func TestElemento(t *testing.T) {
	a := &almacenFalso{elementos: map[int]*datos.Elemento{3: {Type: "Feature", ID: 3, Capa: "conflictos", Nombre: "Humedal",
		Propiedades: json.RawMessage(`{"Orden":26}`), Geometria: json.RawMessage(`{"type":"Point","coordinates":[-73,-37]}`)}}}
	h := servidorDePrueba(a)
	casos := map[string]int{
		"/api/capas/conflictos/elementos/3":    http.StatusOK,
		"/api/capas/conflictos/elementos/4":    http.StatusNotFound,
		"/api/capas/conflictos/elementos/0":    http.StatusNotFound,
		"/api/capas/conflictos/elementos/x":    http.StatusNotFound,
		"/api/capas/rios/elementos/3":          http.StatusNotFound, // Fuera de la lista de capas
		"/api/capas/griut.rios;--/elementos/3": http.StatusNotFound,
	}
	for ruta, estado := range casos {
		if rec := pedir(t, h, "GET", ruta, nil); rec.Code != estado {
			t.Errorf("%s: estado %d, se esperaba %d", ruta, rec.Code, estado)
		}
	}
	rec := pedir(t, h, "GET", "/api/capas/conflictos/elementos/3", nil)
	var f map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &f); err != nil || f["type"] != "Feature" || f["properties"].(map[string]any)["Orden"] != 26.0 {
		t.Errorf("ficha inesperada: %s", rec.Body)
	}
}

func TestErrorInternoNoMuestraDetalle(t *testing.T) {
	rec := pedir(t, servidorDePrueba(&almacenFalso{}), "GET", "/api/poblacion/comunas", nil)
	if rec.Code != http.StatusInternalServerError || rec.Body.String() != "{\"error\":\"error interno\"}\n" {
		t.Errorf("estado %d, cuerpo %q", rec.Code, rec.Body)
	}
}

func TestPanicoSeRecupera(t *testing.T) {
	rec := pedir(t, servidorDePrueba(&almacenFalso{pánico: true}), "GET", "/api/buscar?q=tral", nil)
	if rec.Code != http.StatusInternalServerError {
		t.Errorf("estado %d", rec.Code)
	}
}

func TestCORS(t *testing.T) {
	h := servidorDePrueba(&almacenFalso{})
	casos := map[string]bool{
		"https://geo-griut.vercel.app":            true,
		"https://geo-griut-git-feat-x.vercel.app": true,
		"http://geo-griut.vercel.app":             false,
		"https://malicioso.com":                   false,
		"https://vercel.app.malicioso.com":        false,
		"https://a/b.vercel.app":                  false,
	}
	for origen, permitido := range casos {
		rec := pedir(t, h, "GET", "/api/salud", map[string]string{"Origin": origen})
		if got := rec.Header().Get("Access-Control-Allow-Origin") == origen; got != permitido {
			t.Errorf("%s: permitido=%v, se esperaba %v", origen, got, permitido)
		}
	}
	rec := pedir(t, h, "OPTIONS", "/api/buscar", map[string]string{"Origin": "https://geo-griut.vercel.app"})
	if rec.Code != http.StatusNoContent {
		t.Errorf("preflight: estado %d", rec.Code)
	}
}

func TestTeselaValida(t *testing.T) {
	h := servidorDePrueba(&almacenFalso{})
	casos := map[string]int{
		"/api/teselas/rios/12/1216/2513.pbf": http.StatusOK,
		"/api/teselas/rios/0/0/0.pbf":        http.StatusOK,
		"/api/teselas/rios/12/1216/2513":     http.StatusNotFound, // Sin .pbf
		"/api/teselas/conflictos/12/1/1.pbf": http.StatusNotFound, // No es capa de teselas
		"/api/teselas/rios/17/1/1.pbf":       http.StatusNotFound, // Más allá del zoom máximo
		"/api/teselas/rios/-1/0/0.pbf":       http.StatusNotFound,
		"/api/teselas/rios/2/4/0.pbf":        http.StatusNotFound, // x fuera de la grilla (4 columnas)
		"/api/teselas/rios/2/0/4.pbf":        http.StatusNotFound,
		"/api/teselas/rios/2/a/0.pbf":        http.StatusNotFound,
	}
	for ruta, estado := range casos {
		if rec := pedir(t, h, "GET", ruta, nil); rec.Code != estado {
			t.Errorf("%s: estado %d, se esperaba %d", ruta, rec.Code, estado)
		}
	}
}

func TestTeselaCacheYEtag(t *testing.T) {
	a := &almacenFalso{}
	h := servidorDePrueba(a)
	ruta := "/api/teselas/rios/12/1216/2513.pbf"
	rec := pedir(t, h, "GET", ruta, nil)
	if rec.Body.String() != "rios-mvt" || rec.Header().Get("Content-Type") != "application/vnd.mapbox-vector-tile" {
		t.Fatalf("respuesta inesperada: %q %q", rec.Body, rec.Header().Get("Content-Type"))
	}
	etag := rec.Header().Get("ETag")
	if etag == "" || rec.Header().Get("Cache-Control") != cacheTesela {
		t.Errorf("faltan ETag o Cache-Control: %v", rec.Header())
	}
	if rec = pedir(t, h, "GET", ruta, nil); rec.Body.String() != "rios-mvt" || a.teselas != 1 {
		t.Errorf("la segunda vez debía salir de la caché (pedidas a la base: %d)", a.teselas)
	}
	if rec = pedir(t, h, "GET", ruta, map[string]string{"If-None-Match": etag}); rec.Code != http.StatusNotModified || rec.Body.Len() != 0 {
		t.Errorf("con el mismo ETag se esperaba 304 vacío y llegó %d", rec.Code)
	}
}

func TestTeselaGzip(t *testing.T) {
	original := bytes.Repeat([]byte("geometría repetida "), 200)
	a := &almacenFalso{tesela: original}
	h := servidorDePrueba(a)
	ruta := "/api/teselas/rios/12/1216/2513.pbf"

	rec := pedir(t, h, "GET", ruta, map[string]string{"Accept-Encoding": "br, gzip"})
	if rec.Header().Get("Content-Encoding") != "gzip" || rec.Body.Len() >= len(original) {
		t.Fatalf("se esperaba gzip más liviano: %q, %d bytes", rec.Header().Get("Content-Encoding"), rec.Body.Len())
	}
	if !strings.Contains(rec.Header().Get("Vary"), "Accept-Encoding") {
		t.Errorf("falta Vary: Accept-Encoding: %v", rec.Header())
	}
	z, err := gzip.NewReader(rec.Body)
	if err != nil {
		t.Fatal(err)
	}
	if descomprimida, _ := io.ReadAll(z); !bytes.Equal(descomprimida, original) {
		t.Error("la tesela descomprimida no es la original")
	}
	etagGzip := rec.Header().Get("ETag")

	// Sin Accept-Encoding (o con gzip;q=0) sale tal cual, con otro ETag
	for _, acepta := range []string{"", "gzip;q=0", "br"} {
		rec = pedir(t, h, "GET", ruta, map[string]string{"Accept-Encoding": acepta})
		if rec.Header().Get("Content-Encoding") != "" || !bytes.Equal(rec.Body.Bytes(), original) {
			t.Errorf("Accept-Encoding %q: se esperaba la tesela sin comprimir", acepta)
		}
		if rec.Header().Get("ETag") == etagGzip {
			t.Errorf("Accept-Encoding %q: el ETag debe distinguir la forma comprimida", acepta)
		}
	}
	if a.teselas != 1 {
		t.Errorf("la tesela se pidió %d veces a la base", a.teselas)
	}
	// Una caché intermedia revalida con el ETag marcado como débil
	rec = pedir(t, h, "GET", ruta, map[string]string{"Accept-Encoding": "gzip", "If-None-Match": "W/" + etagGzip})
	if rec.Code != http.StatusNotModified {
		t.Errorf("revalidación: estado %d", rec.Code)
	}

	// Una tesela chica no gana nada comprimida: sale tal cual
	rec = pedir(t, servidorDePrueba(&almacenFalso{}), "GET", ruta, map[string]string{"Accept-Encoding": "gzip"})
	if rec.Header().Get("Content-Encoding") != "" || rec.Body.String() != "rios-mvt" {
		t.Errorf("tesela chica: %q %q", rec.Header().Get("Content-Encoding"), rec.Body)
	}
}

func TestTeselaCORSAbierto(t *testing.T) {
	h := servidorDePrueba(&almacenFalso{})
	for _, origen := range []string{"https://geo-griut.vercel.app", "https://otro.sitio", ""} {
		rec := pedir(t, h, "GET", "/api/teselas/rios/12/1216/2513.pbf", map[string]string{"Origin": origen})
		if rec.Header().Get("Access-Control-Allow-Origin") != "*" {
			t.Errorf("origen %q: las teselas se leen desde cualquier origen", origen)
		}
		if strings.Contains(strings.Join(rec.Header().Values("Vary"), ","), "Origin") {
			t.Errorf("origen %q: la respuesta no debe variar por origen (caché compartida)", origen)
		}
	}
	// El resto de la API sigue restringido
	rec := pedir(t, h, "GET", "/api/salud", map[string]string{"Origin": "https://otro.sitio"})
	if rec.Header().Get("Access-Control-Allow-Origin") != "" {
		t.Error("la API fuera de las teselas no debe abrirse a cualquier origen")
	}
}

func TestCacheTeselasDescartaLaMenosUsada(t *testing.T) {
	tesela := func(clave string) *teselaGuardada { return &teselaGuardada{clave: clave, datos: make([]byte, 744)} } // 1000 con el costo fijo
	c := nuevoCacheTeselas(2500)
	c.guardar(tesela("a"))
	c.guardar(tesela("b"))
	c.obtener("a") // "b" queda como la menos usada
	c.guardar(tesela("c"))
	if _, ok := c.obtener("b"); ok {
		t.Error("b debía salir de la caché")
	}
	for _, clave := range []string{"a", "c"} {
		if _, ok := c.obtener(clave); !ok {
			t.Errorf("%s debía seguir en la caché", clave)
		}
	}
	if c.usado != 2000 {
		t.Errorf("usado = %d, se esperaba 2000", c.usado)
	}
	c.guardar(&teselaGuardada{clave: "grande", datos: make([]byte, 5000)})
	if _, ok := c.obtener("grande"); ok || c.usado != 2000 {
		t.Error("una tesela más grande que toda la caché no se guarda")
	}
}

func TestRelacionadosValida(t *testing.T) {
	casos := []struct {
		ruta   string
		estado int
	}{
		{"/api/lugares/rios/1/relacionados", http.StatusNotFound}, // Fuera de la lista blanca
		{"/api/lugares/griut.conflictos/1/relacionados", http.StatusNotFound},
		{"/api/lugares/conflictos/uno/relacionados", http.StatusNotFound},
		{"/api/lugares/conflictos/1.5/relacionados", http.StatusNotFound},
		{"/api/lugares/conflictos/0/relacionados", http.StatusNotFound},
		{"/api/lugares/conflictos/-3/relacionados", http.StatusNotFound},
		{"/api/lugares/conflictos/1%20OR%201=1/relacionados", http.StatusNotFound},
		{"/api/lugares/conflictos/1/relacionados?radio=0", http.StatusBadRequest},
		{"/api/lugares/conflictos/1/relacionados?radio=-100", http.StatusBadRequest},
		{"/api/lugares/conflictos/1/relacionados?radio=20001", http.StatusBadRequest},
		{"/api/lugares/conflictos/1/relacionados?radio=1e4", http.StatusBadRequest},
		{"/api/lugares/conflictos/1/relacionados?radio=abc", http.StatusBadRequest},
		{"/api/lugares/conflictos/1/relacionados?radio=20000", http.StatusOK},
		{"/api/lugares/toponimos/25/relacionados", http.StatusOK},
	}
	for _, c := range casos {
		a := &almacenFalso{}
		if rec := pedir(t, servidorDePrueba(a), "GET", c.ruta, nil); rec.Code != c.estado {
			t.Errorf("%s: estado %d, se esperaba %d", c.ruta, rec.Code, c.estado)
		} else if c.estado != http.StatusOK && a.relCapa != "" {
			t.Errorf("%s: una petición inválida llegó a la base", c.ruta)
		}
	}
}

func TestRelacionadosResponde(t *testing.T) {
	a := &almacenFalso{relacionados: []datos.Relacionado{
		{Capa: "toponimos", ID: 3, Nombre: "Wallpen", DistanciaM: 812.5},
		{Capa: "conflictos", ID: 9, Nombre: "Península de Hualpén", DistanciaM: 1500},
	}}
	rec := pedir(t, servidorDePrueba(a), "GET", "/api/lugares/puntos-historicos/4/relacionados?radio=3000", nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("estado %d", rec.Code)
	}
	if a.relCapa != "puntos-historicos" || a.relID != 4 || a.relRadio != 3000 || a.relLimite != relacionadosCapa {
		t.Errorf("se pidió %s/%d radio %v límite %d", a.relCapa, a.relID, a.relRadio, a.relLimite)
	}
	var cuerpo []map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &cuerpo); err != nil {
		t.Fatal(err)
	}
	if len(cuerpo) != 2 || cuerpo[0]["capa"] != "toponimos" || cuerpo[0]["id"] != 3.0 ||
		cuerpo[0]["nombre"] != "Wallpen" || cuerpo[0]["distancia_m"] != 812.5 {
		t.Errorf("cuerpo %s", rec.Body)
	}
	if rec.Header().Get("Cache-Control") != cachePublica {
		t.Errorf("Cache-Control %q", rec.Header().Get("Cache-Control"))
	}

	pedir(t, servidorDePrueba(a), "GET", "/api/lugares/conflictos/2/relacionados", nil)
	if a.relRadio != radioPorDefecto {
		t.Errorf("sin radio se esperaba %d y se pidió %v", radioPorDefecto, a.relRadio)
	}
}

func TestRelacionadosSinVecinosYNoEncontrado(t *testing.T) {
	rec := pedir(t, servidorDePrueba(&almacenFalso{}), "GET", "/api/lugares/conflictos/2/relacionados", nil)
	if rec.Code != http.StatusOK || rec.Body.String() != "[]\n" {
		t.Errorf("sin vecinos se esperaba [] y llegó %d %q", rec.Code, rec.Body)
	}
	rec = pedir(t, servidorDePrueba(&almacenFalso{errRel: datos.ErrNoEncontrado}), "GET", "/api/lugares/conflictos/99/relacionados", nil)
	if rec.Code != http.StatusNotFound {
		t.Errorf("punto inexistente: estado %d", rec.Code)
	}
	rec = pedir(t, servidorDePrueba(&almacenFalso{errRel: errors.New("detalle secreto")}), "GET", "/api/lugares/conflictos/2/relacionados", nil)
	if rec.Code != http.StatusInternalServerError || strings.Contains(rec.Body.String(), "secreto") {
		t.Errorf("error interno: %d %q", rec.Code, rec.Body)
	}
}
