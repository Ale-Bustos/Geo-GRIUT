// Comando api: servidor HTTP de Geo-GRIUT sobre PostGIS.
//
// Variables de entorno:
//
//	DATABASE_URL         conexión a PostGIS (usuario de solo lectura gis_reader)
//	PUERTO               puerto donde escucha (por defecto 8081)
//	ORIGENES_PERMITIDOS  orígenes CORS separados por coma; admite comodín, p. ej. https://*.vercel.app
package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/Ale-Bustos/Geo-GRIUT/backend/internal/api"
	"github.com/Ale-Bustos/Geo-GRIUT/backend/internal/datos"
)

// version se fija al compilar: -ldflags "-X main.version=<sha>"
var version = "dev"

const origenesPorDefecto = "https://geo-griut.vercel.app,https://*.vercel.app"

func main() {
	log := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	if err := ejecutar(log); err != nil {
		log.Error("el servidor se detuvo", "error", err)
		os.Exit(1)
	}
}

func ejecutar(log *slog.Logger) error {
	url := os.Getenv("DATABASE_URL")
	if url == "" {
		return errors.New("falta DATABASE_URL")
	}
	ctx, detener := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer detener()

	almacen, err := datos.NuevoPostgres(ctx, url)
	if err != nil {
		return err
	}
	defer almacen.Cerrar()

	servidor := &http.Server{
		Addr:              ":" + entorno("PUERTO", "8081"),
		Handler:           api.NuevoServidor(almacen, version, strings.Split(entorno("ORIGENES_PERMITIDOS", origenesPorDefecto), ","), log).Handler(),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       10 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       120 * time.Second,
	}

	errs := make(chan error, 1)
	go func() {
		log.Info("escuchando", "direccion", servidor.Addr, "version", version)
		errs <- servidor.ListenAndServe()
	}()

	select {
	case err := <-errs:
		return err
	case <-ctx.Done():
		log.Info("apagando")
		apagar, cancelar := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancelar()
		return servidor.Shutdown(apagar)
	}
}

func entorno(clave, porDefecto string) string {
	if v := os.Getenv(clave); v != "" {
		return v
	}
	return porDefecto
}
