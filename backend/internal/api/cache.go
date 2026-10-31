package api

import (
	"container/list"
	"sync"
)

// cacheTeselas guarda en memoria las últimas teselas servidas, hasta un total de bytes. Los datos
// cambian rara vez (al recargar una capa se reinicia el servicio), así que no vencen por tiempo.
type cacheTeselas struct {
	mu      sync.Mutex
	maximo  int
	usado   int
	orden   *list.List // Más reciente al frente
	entrada map[string]*list.Element
}

type teselaGuardada struct {
	clave string
	datos []byte
	etag  string
}

// Lo que ocupa una tesela: sus bytes más un costo fijo, para que las vacías también cuenten
func (t *teselaGuardada) tamano() int { return len(t.datos) + 256 }

func nuevoCacheTeselas(maximo int) *cacheTeselas {
	return &cacheTeselas{maximo: maximo, orden: list.New(), entrada: map[string]*list.Element{}}
}

func (c *cacheTeselas) obtener(clave string) (*teselaGuardada, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	e, ok := c.entrada[clave]
	if !ok {
		return nil, false
	}
	c.orden.MoveToFront(e)
	return e.Value.(*teselaGuardada), true
}

func (c *cacheTeselas) guardar(t *teselaGuardada) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if t.tamano() > c.maximo {
		return
	}
	if e, ok := c.entrada[t.clave]; ok {
		c.usado -= e.Value.(*teselaGuardada).tamano()
		c.orden.Remove(e)
	}
	c.entrada[t.clave] = c.orden.PushFront(t)
	c.usado += t.tamano()
	for c.usado > c.maximo {
		ultima := c.orden.Back()
		v := ultima.Value.(*teselaGuardada)
		c.orden.Remove(ultima)
		delete(c.entrada, v.clave)
		c.usado -= v.tamano()
	}
}
