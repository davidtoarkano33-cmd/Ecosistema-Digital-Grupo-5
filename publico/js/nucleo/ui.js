// publico/js/nucleo/ui.js · Utilidades de interfaz de usuario y accesibilidad
export function escapar(texto) {
  if (texto === null || texto === undefined) return '';
  return String(texto)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function limpiar(html) {
  if (typeof window !== 'undefined' && window.DOMPurify && typeof window.DOMPurify.sanitize === 'function') {
    return window.DOMPurify.sanitize(html);
  }
  if (typeof html === 'string') {
    return html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  }
  return html || '';
}

function obtenerContenedorAvisos() {
  let cont = document.getElementById('contenedor-avisos');
  if (!cont) {
    cont = document.createElement('div');
    cont.id = 'contenedor-avisos';
    cont.className = 'contenedor-avisos';
    cont.setAttribute('aria-live', 'polite');
    cont.setAttribute('aria-atomic', 'true');
    document.body.appendChild(cont);
  }
  return cont;
}

export function aviso(texto, tipo = 'info') {
  const contenedor = obtenerContenedorAvisos();
  const el = document.createElement('div');
  el.className = `aviso aviso-${tipo}`;
  el.setAttribute('role', tipo === 'error' ? 'alert' : 'status');
  el.textContent = texto;

  contenedor.appendChild(el);

  const temporizador = setTimeout(() => {
    el.remove();
  }, 4000);

  el.addEventListener('click', () => {
    clearTimeout(temporizador);
    el.remove();
  });
}

export function cargando(activo) {
  let indicador = document.getElementById('indicador-cargando');
  if (activo) {
    if (!indicador) {
      indicador = document.createElement('div');
      indicador.id = 'indicador-cargando';
      indicador.className = 'cargando';
      indicador.setAttribute('role', 'status');
      indicador.setAttribute('aria-label', 'Cargando');
      document.body.appendChild(indicador);
    }
    indicador.hidden = false;
  } else {
    if (indicador) {
      indicador.remove();
    }
  }
}

export function modal({ titulo = '', contenido = '', acciones = [] } = {}) {
  return new Promise((resolver) => {
    const focoPrevio = document.activeElement;
    const overlay = document.createElement('div');
    overlay.className = 'modal-fondo';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');

    const tituloId = `modal-titulo-${Date.now()}`;
    overlay.setAttribute('aria-labelledby', tituloId);

    const cuadro = document.createElement('div');
    cuadro.className = 'modal';

    const encabezado = document.createElement('div');
    encabezado.className = 'modal-encabezado';
    const h2 = document.createElement('h2');
    h2.id = tituloId;
    h2.textContent = titulo;
    encabezado.appendChild(h2);

    const cuerpo = document.createElement('div');
    cuerpo.className = 'modal-cuerpo';
    if (contenido instanceof HTMLElement) {
      cuerpo.appendChild(contenido);
    } else {
      cuerpo.innerHTML = limpiar(contenido);
    }

    const pie = document.createElement('div');
    pie.className = 'modal-acciones';

    const listaAcciones = acciones.length > 0 ? acciones : [
      { texto: 'Aceptar', valor: true, clase: 'btn-primario' }
    ];

    function cerrar(valor) {
      document.removeEventListener('keydown', manejarTeclado);
      overlay.remove();
      if (focoPrevio && typeof focoPrevio.focus === 'function') {
        focoPrevio.focus();
      }
      resolver(valor !== undefined ? valor : null);
    }

    listaAcciones.forEach(act => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `btn ${act.clase || 'btn-secundario'}`;
      btn.textContent = act.texto;
      btn.addEventListener('click', () => cerrar(act.valor));
      pie.appendChild(btn);
    });

    cuadro.appendChild(encabezado);
    cuadro.appendChild(cuerpo);
    cuadro.appendChild(pie);
    overlay.appendChild(cuadro);

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        cerrar(null);
      }
    });

    function manejarTeclado(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        cerrar(null);
        return;
      }

      if (e.key === 'Tab') {
        const focables = overlay.querySelectorAll(
          'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focables.length === 0) return;

        const primero = focables[0];
        const ultimo = focables[focables.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === primero) {
            e.preventDefault();
            ultimo.focus();
          }
        } else {
          if (document.activeElement === ultimo) {
            e.preventDefault();
            primero.focus();
          }
        }
      }
    }

    document.addEventListener('keydown', manejarTeclado);
    document.body.appendChild(overlay);

    const focablesIniciales = overlay.querySelectorAll(
      'button:not([disabled]), [tabindex]:not([tabindex="-1"]), input:not([disabled])'
    );
    if (focablesIniciales.length > 0) {
      focablesIniciales[0].focus();
    }
  });
}

export async function confirmar(texto) {
  const resultado = await modal({
    titulo: 'Confirmar',
    contenido: texto,
    acciones: [
      { texto: 'Cancelar', valor: false, clase: 'btn-secundario' },
      { texto: 'Aceptar', valor: true, clase: 'btn-primario' }
    ]
  });
  return Boolean(resultado);
}

export default {
  escapar,
  limpiar,
  aviso,
  cargando,
  modal,
  confirmar
};
