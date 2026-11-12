// Package api expone los datos de Geo-GRIUT por HTTP.
package api

import (
	"bytes"
	"compress/gzip"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/Ale-Bustos/Geo-GRIUT/backend/internal/datos"
)

const (
	limitePorDefecto = 10
	limiteMaximo     = 50
	largoMinimo      = 2   // Letras mínimas para buscar
	largoMaximo      = 100 // Más largo no es un nombre de lugar
	cachePublica     = "public, max-age=300"
	cacheTesela      = "public, max-age=86400" // Las capas cambian rara vez
	zoomMaximo       = 16                      // Igual que GeoServer: más cerca, el mapa amplía las teselas de este nivel
	memoriaTeselas   = 64 << 20                // 64 MB de teselas en memoria
	radioPorDefecto  = 5000                    // Metros alrededor del lugar para buscar relacionados
	radioMaximo      = 20000
	relacionadosCapa = 5 // Relacionados como mucho por capa, para que una capa no tape a las demás
)

// Servidor reúne las rutas de la API.
type Servidor struct {
	almacen  datos.Almacen
	version  string
	origenes map[string]bool
	log      *slog.Logger
	teselas  *cacheTeselas
}

func NuevoServidor(almacen datos.Almacen, version string, origenes []string, log *slog.Logger) *Servidor {
	s := &Servidor{almacen: almacen, version: version, origenes: map[string]bool{}, log: log, teselas: nuevoCacheTeselas(memoriaTeselas)}
	for _, o := range origenes {
		if o = strings.TrimSpace(o); o != "" {
			s.origenes[o] = true
		}
	}
	return s
}

// Handler devuelve las rutas envueltas en CORS, registro y recuperación de pánicos.
func (s *Servidor) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/salud", s.salud)
	mux.HandleFunc("GET /api/buscar", s.buscar)
	mux.HandleFunc("GET /api/capas/{capa}/elementos/{id}", s.elemento)
	mux.HandleFunc("GET /api/lugares/{capa}/{id}/relacionados", s.relacionados)
	mux.HandleFunc("GET /api/poblacion/comunas", s.comunas)
	mux.HandleFunc("GET /api/teselas/{capa}/{z}/{x}/{y}", s.tesela)
	return s.recuperar(s.registrar(s.cors(mux)))
}

func (s *Servidor) salud(w http.ResponseWriter, r *http.Request) {
	if err := s.almacen.Salud(r.Context()); err != nil {
		s.log.Error("base de datos sin respuesta", "error", err)
		responderError(w, http.StatusServiceUnavailable, "base de datos sin respuesta")
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	responderJSON(w, http.StatusOK, map[string]string{"estado": "ok", "version": s.version})
}

func (s *Servidor) buscar(w http.ResponseWriter, r *http.Request) {
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	if n := utf8.RuneCountInString(q); n < largoMinimo || n > largoMaximo {
		responderError(w, http.StatusBadRequest, "q debe tener entre 2 y 100 caracteres")
		return
	}
	limite := limitePorDefecto
	if v := r.URL.Query().Get("limite"); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil || n < 1 || n > limiteMaximo {
			responderError(w, http.StatusBadRequest, "limite debe ser un número entre 1 y 50")
			return
		}
		limite = n
	}
	resultados, err := s.almacen.Buscar(r.Context(), q, limite)
	if err != nil {
		s.fallo(w, r, err)
		return
	}
	if resultados == nil {
		resultados = []datos.Resultado{} // [] y no null
	}
	w.Header().Set("Cache-Control", cachePublica)
	responderJSON(w, http.StatusOK, resultados)
}

func (s *Servidor) elemento(w http.ResponseWriter, r *http.Request) {
	capa := r.PathValue("capa")
	id, err := strconv.Atoi(r.PathValue("id"))
	if _, ok := datos.Capas[capa]; !ok || err != nil || id < 1 {
		responderError(w, http.StatusNotFound, "no encontrado")
		return
	}
	e, err := s.almacen.Elemento(r.Context(), capa, id)
	if errors.Is(err, datos.ErrNoEncontrado) {
		responderError(w, http.StatusNotFound, "no encontrado")
		return
	}
	if err != nil {
		s.fallo(w, r, err)
		return
	}
	w.Header().Set("Cache-Control", cachePublica)
	responderJSON(w, http.StatusOK, e)
}

// relacionados sirve /api/lugares/{capa}/{id}/relacionados?radio=<metros>
func (s *Servidor) relacionados(w http.ResponseWriter, r *http.Request) {
	capa := r.PathValue("capa")
	id, err := strconv.Atoi(r.PathValue("id"))
	if _, ok := datos.Capas[capa]; !ok || err != nil || id < 1 {
		responderError(w, http.StatusNotFound, "no encontrado")
		return
	}
	radio := radioPorDefecto
	if v := r.URL.Query().Get("radio"); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil || n < 1 || n > radioMaximo {
			responderError(w, http.StatusBadRequest, "radio debe ser un número de metros entre 1 y 20000")
			return
		}
		radio = n
	}
	relacionados, err := s.almacen.Relacionados(r.Context(), capa, id, float64(radio), relacionadosCapa)
	if errors.Is(err, datos.ErrNoEncontrado) {
		responderError(w, http.StatusNotFound, "no encontrado")
		return
	}
	if err != nil {
		s.fallo(w, r, err)
		return
	}
	if relacionados == nil {
		relacionados = []datos.Relacionado{}
	}
	w.Header().Set("Cache-Control", cachePublica)
	responderJSON(w, http.StatusOK, relacionados)
}

func (s *Servidor) comunas(w http.ResponseWriter, r *http.Request) {
	comunas, err := s.almacen.Comunas(r.Context())
	if err != nil {
		s.fallo(w, r, err)
		return
	}
	if comunas == nil {
		comunas = []datos.Comuna{}
	}
	w.Header().Set("Cache-Control", cachePublica)
	responderJSON(w, http.StatusOK, comunas)
}

// tesela sirve /api/teselas/{capa}/{z}/{x}/{y}.pbf en esquema XYZ (fila 0 arriba)
func (s *Servidor) tesela(w http.ResponseWriter, r *http.Request) {
	capa := r.PathValue("capa")
	yTexto, ok := strings.CutSuffix(r.PathValue("y"), ".pbf")
	z, errZ := strconv.Atoi(r.PathValue("z"))
	x, errX := strconv.Atoi(r.PathValue("x"))
	y, errY := strconv.Atoi(yTexto)
	if _, existe := datos.CapasTeselas[capa]; !existe || !ok || errZ != nil || errX != nil || errY != nil ||
		z < 0 || z > zoomMaximo || x < 0 || y < 0 || x >= 1<<z || y >= 1<<z {
		responderError(w, http.StatusNotFound, "no encontrado")
		return
	}

	clave := capa + "/" + strconv.Itoa(z) + "/" + strconv.Itoa(x) + "/" + strconv.Itoa(y)
	t, guardada := s.teselas.obtener(clave)
	if !guardada {
		mvt, err := s.almacen.Tesela(r.Context(), capa, z, x, y)
		if err != nil {
			s.fallo(w, r, err)
			return
		}
		suma := sha256.Sum256(mvt)
		etag := hex.EncodeToString(suma[:8])
		t = &teselaGuardada{clave: clave, datos: mvt, etag: `"` + etag + `"`, etagGzip: `"` + etag + `-gz"`, gzip: comprimir(mvt)}
		s.teselas.guardar(t)
	}

	// La misma tesela sale comprimida o no según lo que acepte quien la pide; cada forma tiene su ETag
	cuerpo, etag := t.datos, t.etag
	w.Header().Set("Cache-Control", cacheTesela)
	w.Header().Add("Vary", "Accept-Encoding")
	if t.gzip != nil && aceptaGzip(r.Header.Get("Accept-Encoding")) {
		cuerpo, etag = t.gzip, t.etagGzip
		w.Header().Set("Content-Encoding", "gzip")
	}
	w.Header().Set("ETag", etag)
	// Contains y no ==: una caché intermedia puede mandar varios ETag o marcarlo como débil (W/"…")
	if strings.Contains(r.Header.Get("If-None-Match"), etag) {
		w.WriteHeader(http.StatusNotModified)
		return
	}
	w.Header().Set("Content-Type", "application/vnd.mapbox-vector-tile")
	w.Header().Set("Content-Length", strconv.Itoa(len(cuerpo)))
	_, _ = w.Write(cuerpo)
}

// comprimir devuelve la tesela en gzip, o nil si así no pesa menos (teselas vacías o muy chicas).
// Se comprime una sola vez, al guardarla en la caché, así que se usa la compresión máxima.
func comprimir(datos []byte) []byte {
	var b bytes.Buffer
	z, err := gzip.NewWriterLevel(&b, gzip.BestCompression)
	if err != nil {
		return nil
	}
	if _, err := z.Write(datos); err != nil {
		return nil
	}
	if err := z.Close(); err != nil || b.Len() >= len(datos) {
		return nil
	}
	return b.Bytes()
}

// aceptaGzip lee la cabecera Accept-Encoding: gzip (o *) sin q=0.
func aceptaGzip(cabecera string) bool {
	for _, parte := range strings.Split(cabecera, ",") {
		nombre, parametros, _ := strings.Cut(strings.TrimSpace(parte), ";")
		if nombre = strings.ToLower(strings.TrimSpace(nombre)); nombre != "gzip" && nombre != "*" {
			continue
		}
		q := strings.TrimSpace(strings.TrimPrefix(strings.ReplaceAll(strings.ToLower(parametros), " ", ""), "q="))
		if v, err := strconv.ParseFloat(q, 64); q != "" && err == nil && v == 0 {
			continue
		}
		return true
	}
	return false
}

// fallo registra el error y responde 500 sin mostrar el detalle a quien consulta.
func (s *Servidor) fallo(w http.ResponseWriter, r *http.Request, err error) {
	s.log.Error("error interno", "ruta", r.URL.Path, "error", err)
	responderError(w, http.StatusInternalServerError, "error interno")
}

func responderJSON(w http.ResponseWriter, estado int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(estado)
	_ = json.NewEncoder(w).Encode(v)
}

func responderError(w http.ResponseWriter, estado int, mensaje string) {
	w.Header().Set("Cache-Control", "no-store")
	responderJSON(w, estado, map[string]string{"error": mensaje})
}

// cors deja leer la API solo desde los orígenes configurados. Un origen que termina en
// "*.vercel.app" acepta los previews de Vercel. Las teselas son la excepción: son datos públicos (los
// mismos que entrega GeoServer) y se leen desde cualquier origen, sin "Vary: Origin", para que una
// caché intermedia (Cloudflare) pueda guardar una sola respuesta que sirva a todos.
func (s *Servidor) cors(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasPrefix(r.URL.Path, "/api/teselas/") {
			w.Header().Set("Access-Control-Allow-Origin", "*")
			w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
			w.Header().Set("Access-Control-Max-Age", "86400")
		} else {
			w.Header().Add("Vary", "Origin")
			if o := r.Header.Get("Origin"); o != "" && s.origenPermitido(o) {
				w.Header().Set("Access-Control-Allow-Origin", o)
				w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
				w.Header().Set("Access-Control-Max-Age", "86400")
			}
		}
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func (s *Servidor) origenPermitido(o string) bool {
	if s.origenes["*"] || s.origenes[o] {
		return true
	}
	for permitido := range s.origenes {
		// https://*.vercel.app → cualquier subdominio de vercel.app por https
		if prefijo, sufijo, ok := strings.Cut(permitido, "*"); ok &&
			strings.HasPrefix(o, prefijo) && strings.HasSuffix(o, sufijo) &&
			!strings.Contains(o[len(prefijo):len(o)-len(sufijo)], "/") {
			return true
		}
	}
	return false
}

type respuestaRegistrada struct {
	http.ResponseWriter
	estado int
}

func (r *respuestaRegistrada) WriteHeader(estado int) {
	r.estado = estado
	r.ResponseWriter.WriteHeader(estado)
}

func (s *Servidor) registrar(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		inicio := time.Now()
		rr := &respuestaRegistrada{ResponseWriter: w, estado: http.StatusOK}
		next.ServeHTTP(rr, r)
		s.log.Info("petición", "metodo", r.Method, "ruta", r.URL.Path, "estado", rr.estado, "ms", time.Since(inicio).Milliseconds())
	})
}

func (s *Servidor) recuperar(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if p := recover(); p != nil {
				s.log.Error("pánico", "ruta", r.URL.Path, "valor", p)
				responderError(w, http.StatusInternalServerError, "error interno")
			}
		}()
		next.ServeHTTP(w, r)
	})
}
