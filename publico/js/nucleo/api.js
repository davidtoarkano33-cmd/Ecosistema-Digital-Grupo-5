// publico/js/nucleo/api.js · Cliente API con fetch y gestión de sesión
export async function llamar(metodo, ruta, cuerpo) {
  const headers = {};
  const token = sessionStorage.getItem('token');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const opciones = {
    method: metodo.toUpperCase(),
    headers
  };

  if (cuerpo !== undefined && cuerpo !== null) {
    if (cuerpo instanceof FormData) {
      opciones.body = cuerpo;
    } else {
      headers['Content-Type'] = 'application/json';
      opciones.body = typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo);
    }
  }

  const rutaFinal = ruta.startsWith('/') ? ruta : `/${ruta}`;
  const res = await fetch(rutaFinal, opciones);

  if (res.status === 401) {
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('usuario');
    const rutaActual = window.location.pathname;
    const esAuth = rutaActual.endsWith('ingreso.html') || rutaActual.endsWith('registro.html');
    if (!esAuth) {
      window.location.href = '/paginas/ingreso.html';
    }
  }

  const texto = await res.text();
  let json = null;
  if (texto) {
    try {
      json = JSON.parse(texto);
    } catch {
      json = texto;
    }
  }

  if (json && typeof json === 'object' && json.error) {
    throw new Error(json.error);
  }

  if (!res.ok) {
    throw new Error((json && typeof json === 'object' && json.error) || `Error HTTP ${res.status}`);
  }

  return json;
}

export async function listar(col, filtros = {}) {
  const params = new URLSearchParams();
  for (const [clave, valor] of Object.entries(filtros)) {
    if (valor !== undefined && valor !== null && valor !== '') {
      params.append(clave, valor);
    }
  }
  const query = params.toString();
  const ruta = `/api/${col}${query ? `?${query}` : ''}`;
  return llamar('GET', ruta);
}

export async function obtener(col, id) {
  return llamar('GET', `/api/${col}/${encodeURIComponent(id)}`);
}

export async function crear(col, datos) {
  return llamar('POST', `/api/${col}`, datos);
}

export async function actualizar(col, id, cambios) {
  return llamar('PUT', `/api/${col}/${encodeURIComponent(id)}`, cambios);
}

export async function eliminar(col, id) {
  return llamar('DELETE', `/api/${col}/${encodeURIComponent(id)}`);
}

export async function subir(archivo) {
  const fd = new FormData();
  fd.append('archivo', archivo);
  return llamar('POST', '/api/subidas', fd);
}

export async function ia(tarea, datos) {
  return llamar('POST', `/api/ia/${encodeURIComponent(tarea)}`, datos);
}

export default {
  llamar,
  listar,
  obtener,
  crear,
  actualizar,
  eliminar,
  subir,
  ia
};
