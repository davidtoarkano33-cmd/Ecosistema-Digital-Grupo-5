import { montarPlantilla } from '../nucleo/plantilla.js';
import { listar } from '../nucleo/api.js';
import { obtenerTemaActividad } from '../nucleo/selector-tema.js';
import { mostrarRetro, mostrarResumen } from '../nucleo/retroalimentacion.js';
import { registrarIntento } from '../nucleo/gamificacion.js';
import { normalizar, barajar } from '../nucleo/util.js';
import { aviso, escapar, cargando } from '../nucleo/ui.js';

const claveCelda = (fila, col) => `${fila},${col}`;

function crearAleatorio(semillaTexto) {
  let estado = [...semillaTexto].reduce((total, caracter) => ((total * 31) + caracter.charCodeAt(0)) >>> 0, 2166136261);
  return () => {
    estado = (estado * 1664525 + 1013904223) >>> 0;
    return estado / 4294967296;
  };
}

function barajarPuro(lista, aleatorio) {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(aleatorio() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

function dimensiones(entradas) {
  if (entradas.length === 0) return { minFila: 0, minCol: 0, filas: 0, columnas: 0, area: 0 };
  const filas = [];
  const columnas = [];
  entradas.forEach(entrada => {
    for (let i = 0; i < entrada.palabra.length; i++) {
      filas.push(entrada.fila + (entrada.direccion === 'vertical' ? i : 0));
      columnas.push(entrada.col + (entrada.direccion === 'horizontal' ? i : 0));
    }
  });
  const minFila = Math.min(...filas);
  const maxFila = Math.max(...filas);
  const minCol = Math.min(...columnas);
  const maxCol = Math.max(...columnas);
  const cantidadFilas = maxFila - minFila + 1;
  const cantidadColumnas = maxCol - minCol + 1;
  return { minFila, minCol, filas: cantidadFilas, columnas: cantidadColumnas, area: cantidadFilas * cantidadColumnas };
}

function construirCeldas(entradas) {
  const celdas = new Map();
  entradas.forEach(entrada => {
    for (let i = 0; i < entrada.palabra.length; i++) {
      const fila = entrada.fila + (entrada.direccion === 'vertical' ? i : 0);
      const col = entrada.col + (entrada.direccion === 'horizontal' ? i : 0);
      const clave = claveCelda(fila, col);
      const celda = celdas.get(clave) || { letra: entrada.palabra[i], direcciones: new Set() };
      celda.direcciones.add(entrada.direccion);
      celdas.set(clave, celda);
    }
  });
  return celdas;
}

function colocacionValida(palabra, fila, col, direccion, entradas) {
  const celdas = construirCeldas(entradas);
  const df = direccion === 'vertical' ? 1 : 0;
  const dc = direccion === 'horizontal' ? 1 : 0;
  if (celdas.has(claveCelda(fila - df, col - dc)) || celdas.has(claveCelda(fila + df * palabra.length, col + dc * palabra.length))) {
    return false;
  }

  let cruces = 0;
  for (let i = 0; i < palabra.length; i++) {
    const f = fila + df * i;
    const c = col + dc * i;
    const existente = celdas.get(claveCelda(f, c));
    if (existente) {
      if (existente.letra !== palabra[i] || existente.direcciones.has(direccion)) return false;
      cruces++;
    } else {
      const vecinos = direccion === 'horizontal'
        ? [claveCelda(f - 1, c), claveCelda(f + 1, c)]
        : [claveCelda(f, c - 1), claveCelda(f, c + 1)];
      if (vecinos.some(clave => celdas.has(clave))) return false;
    }
  }
  return entradas.length === 0 || cruces > 0;
}

function intentarOrden(orden) {
  if (orden.length === 0) return [];
  const primera = orden[0];
  const entradas = [{ ...primera, fila: 0, col: -Math.floor(primera.palabra.length / 2), direccion: 'horizontal' }];

  for (const candidata of orden.slice(1)) {
    if (entradas.length >= 12) break;
    const celdas = construirCeldas(entradas);
    const opciones = [];
    for (let i = 0; i < candidata.palabra.length; i++) {
      for (const [clave, celda] of celdas.entries()) {
        if (celda.letra !== candidata.palabra[i]) continue;
        const [filaCruce, colCruce] = clave.split(',').map(Number);
        for (const direccion of ['horizontal', 'vertical']) {
          const perpendicular = direccion === 'horizontal' ? 'vertical' : 'horizontal';
          if (!celda.direcciones.has(perpendicular)) continue;
          const fila = filaCruce - (direccion === 'vertical' ? i : 0);
          const col = colCruce - (direccion === 'horizontal' ? i : 0);
          if (!colocacionValida(candidata.palabra, fila, col, direccion, entradas)) continue;
          const prueba = [...entradas, { ...candidata, fila, col, direccion }];
          opciones.push({ fila, col, direccion, area: dimensiones(prueba).area });
        }
      }
    }
    opciones.sort((a, b) => a.area - b.area);
    if (opciones[0]) entradas.push({ ...candidata, ...opciones[0] });
  }
  return entradas;
}

/** Genera un crucigrama sin modificar la lista recibida. */
export function generarCrucigrama(palabras) {
  const limpias = (Array.isArray(palabras) ? palabras : [])
    .map((item, indice) => {
      const objeto = typeof item === 'string' ? { palabra: item, pista: item } : item;
      return {
        id: objeto.id || `palabra-${indice}`,
        palabra: normalizar(objeto.palabra || objeto.termino || ''),
        pista: String(objeto.pista || objeto.definicion || '').trim()
      };
    })
    .filter(item => /^[A-ZÑ]{3,12}$/.test(item.palabra));

  if (limpias.length === 0) return { filas: 0, columnas: 0, entradas: [] };
  const masLarga = [...limpias].sort((a, b) => b.palabra.length - a.palabra.length)[0];
  const aleatorio = crearAleatorio(limpias.map(item => item.palabra).join('|'));
  let mejor = [];
  let mejorArea = Infinity;

  for (let intento = 0; intento < 30; intento++) {
    const restantes = limpias.filter(item => item !== masLarga);
    const orden = [masLarga, ...barajarPuro(restantes, aleatorio)];
    const entradas = intentarOrden(orden);
    const area = dimensiones(entradas).area;
    if (entradas.length > mejor.length || (entradas.length === mejor.length && area < mejorArea)) {
      mejor = entradas;
      mejorArea = area;
    }
  }

  const caja = dimensiones(mejor);
  const recortadas = mejor.map(entrada => ({
    palabra: entrada.palabra,
    pista: entrada.pista,
    fila: entrada.fila - caja.minFila,
    col: entrada.col - caja.minCol,
    direccion: entrada.direccion
  }));
  const numeros = new Map();
  let numero = 1;
  [...recortadas]
    .sort((a, b) => a.fila - b.fila || a.col - b.col)
    .forEach(entrada => {
      const clave = claveCelda(entrada.fila, entrada.col);
      if (!numeros.has(clave)) numeros.set(clave, numero++);
      entrada.numero = numeros.get(clave);
    });

  return { filas: caja.filas, columnas: caja.columnas, entradas: recortadas };
}

async function iniciarPagina() {
  await montarPlantilla({ titulo: 'Crucigrama', roles: ['estudiante', 'docente'] });
  const contenido = document.getElementById('contenido');
  const tema = await obtenerTemaActividad();
  if (!tema) return;

  cargando(true);
  let glosario = [];
  try {
    glosario = await listar('glosario', { temaId: tema.id });
  } catch (error) {
    aviso(error.message || 'No se pudo cargar el glosario', 'error');
  } finally {
    cargando(false);
  }

  const candidatos = barajar((glosario || []).filter(item => {
    const palabra = normalizar(item.termino);
    return item.estado === 'aprobado' && !/\s/.test(String(item.termino).trim()) && /^[A-ZÑ]{3,12}$/.test(palabra);
  })).slice(0, 15);
  const definiciones = new Map(candidatos.map(item => [normalizar(item.termino), item.definicion || '']));
  const crucigrama = generarCrucigrama(candidatos.map(item => ({
    id: item.id,
    palabra: item.termino,
    pista: item.pista || item.definicion
  })));

  if (crucigrama.entradas.length < 3) {
    contenido.innerHTML = `
      <div class="tarjeta vacio">
        <h1 class="vacio__titulo">No se pudo formar el crucigrama</h1>
        <p class="vacio__texto">El tema ${escapar(tema.titulo)} necesita más términos de una sola palabra, entre 3 y 12 letras, que puedan cruzarse.</p>
        <a href="/paginas/tema.html?id=${encodeURIComponent(tema.id)}#sec-glosario" class="btn btn--primario">Revisar glosario</a>
      </div>`;
    return;
  }

  const celdas = new Map();
  crucigrama.entradas.forEach((entrada, indice) => {
    entrada.id = `entrada-${indice}`;
    for (let i = 0; i < entrada.palabra.length; i++) {
      const fila = entrada.fila + (entrada.direccion === 'vertical' ? i : 0);
      const col = entrada.col + (entrada.direccion === 'horizontal' ? i : 0);
      const clave = claveCelda(fila, col);
      const celda = celdas.get(clave) || { letra: entrada.palabra[i], entradas: [] };
      celda.entradas.push(entrada.id);
      celdas.set(clave, celda);
    }
  });

  let entradaActiva = crucigrama.entradas[0];
  let reveladas = 0;
  let terminado = false;
  const inicio = Date.now();

  const tableroHtml = Array.from({ length: crucigrama.filas }, (_, fila) =>
    Array.from({ length: crucigrama.columnas }, (_, col) => {
      const celda = celdas.get(claveCelda(fila, col));
      if (!celda) return '<span class="crucigrama-bloque" aria-hidden="true"></span>';
      const inicioEntrada = crucigrama.entradas.find(e => e.fila === fila && e.col === col);
      return `
        <label class="crucigrama-celda" data-fila="${fila}" data-col="${col}" data-entradas="${celda.entradas.join(',')}">
          ${inicioEntrada ? `<span class="crucigrama-celda__numero">${inicioEntrada.numero}</span>` : ''}
          <input maxlength="1" autocomplete="off" aria-label="Casilla fila ${fila + 1}, columna ${col + 1}">
        </label>`;
    }).join('')
  ).join('');

  const pistas = direccion => crucigrama.entradas
    .filter(entrada => entrada.direccion === direccion)
    .sort((a, b) => a.numero - b.numero)
    .map(entrada => `<li value="${entrada.numero}"><button type="button" class="crucigrama-pista" data-entrada="${entrada.id}">${escapar(entrada.pista)}</button></li>`)
    .join('');

  contenido.innerHTML = `
    <div class="crucigrama-layout">
      <header class="crucigrama-cabecera">
        <div>
          <a href="/paginas/tema.html?id=${encodeURIComponent(tema.id)}" class="btn btn--texto btn--pequeno">← Volver al tema</a>
          <h1>Crucigrama</h1>
          <p class="campo__ayuda">${escapar(tema.titulo)}</p>
        </div>
        <div class="crucigrama-estado" aria-live="polite">
          <span class="insignia insignia--info">${crucigrama.entradas.length} palabras</span>
          <span class="insignia insignia--advertencia" id="contador-reveladas">Ayudas: 0 / 3</span>
        </div>
      </header>
      <div class="crucigrama-juego">
        <section class="tarjeta crucigrama-tablero-contenedor" aria-label="Tablero del crucigrama">
          <div class="crucigrama-tablero" style="grid-template-columns: repeat(${crucigrama.columnas}, auto)">${tableroHtml}</div>
        </section>
        <aside class="tarjeta crucigrama-pistas" aria-label="Pistas del crucigrama">
          <section><h2>Horizontales</h2><ol>${pistas('horizontal')}</ol></section>
          <section><h2>Verticales</h2><ol>${pistas('vertical')}</ol></section>
        </aside>
      </div>
      <div class="crucigrama-controles">
        <div class="fila fila--s">
          <button type="button" class="btn btn--primario" id="btn-comprobar">Comprobar palabra</button>
          <button type="button" class="btn btn--secundario" id="btn-revelar">Revelar letra</button>
        </div>
        <button type="button" class="btn btn--peligro" id="btn-terminar">Terminar</button>
      </div>
      <div id="panel-retro"></div>
    </div>`;

  const obtenerCelda = (fila, col) => contenido.querySelector(`.crucigrama-celda[data-fila="${fila}"][data-col="${col}"]`);
  const celdasEntrada = entrada => Array.from({ length: entrada.palabra.length }, (_, i) =>
    obtenerCelda(entrada.fila + (entrada.direccion === 'vertical' ? i : 0), entrada.col + (entrada.direccion === 'horizontal' ? i : 0))
  );

  function seleccionarEntrada(entrada, enfocar = true) {
    entradaActiva = entrada;
    contenido.querySelectorAll('.crucigrama-celda--seleccionada').forEach(el => el.classList.remove('crucigrama-celda--seleccionada'));
    contenido.querySelectorAll('.crucigrama-pista--activa').forEach(el => el.classList.remove('crucigrama-pista--activa'));
    const casillas = celdasEntrada(entrada);
    casillas.forEach(celda => celda?.classList.add('crucigrama-celda--seleccionada'));
    contenido.querySelector(`[data-entrada="${entrada.id}"]`)?.classList.add('crucigrama-pista--activa');
    if (enfocar) (casillas.find(celda => !celda.querySelector('input').value) || casillas[0])?.querySelector('input').focus();
  }

  function cambiarDireccion(celda) {
    const opciones = celda.dataset.entradas.split(',');
    if (opciones.length < 2) return;
    const siguienteId = opciones.find(id => id !== entradaActiva.id) || opciones[0];
    const siguiente = crucigrama.entradas.find(entrada => entrada.id === siguienteId);
    if (siguiente) seleccionarEntrada(siguiente, false);
  }

  function moverEnEntrada(input, desplazamiento) {
    const casillas = celdasEntrada(entradaActiva);
    const indice = casillas.findIndex(celda => celda.querySelector('input') === input);
    casillas[Math.max(0, Math.min(casillas.length - 1, indice + desplazamiento))]?.querySelector('input').focus();
  }

  contenido.querySelectorAll('.crucigrama-celda').forEach(celda => {
    const input = celda.querySelector('input');
    const seleccionarDesdeCelda = () => {
      if (!celda.dataset.entradas.includes(entradaActiva.id)) {
        const entrada = crucigrama.entradas.find(item => item.id === celda.dataset.entradas.split(',')[0]);
        if (entrada) seleccionarEntrada(entrada, false);
      }
    };
    input.addEventListener('focus', seleccionarDesdeCelda);
    input.addEventListener('dblclick', () => cambiarDireccion(celda));
    input.addEventListener('input', () => {
      input.value = normalizar(input.value).replace(/[^A-ZÑ]/g, '').slice(-1);
      celda.classList.remove('crucigrama-celda--correcta', 'crucigrama-celda--incorrecta');
      if (input.value) moverEnEntrada(input, 1);
    });
    input.addEventListener('keydown', evento => {
      if (evento.key === ' ') {
        evento.preventDefault();
        cambiarDireccion(celda);
      } else if (evento.key === 'Backspace') {
        evento.preventDefault();
        if (input.value) {
          input.value = '';
        } else {
          moverEnEntrada(input, -1);
          const anterior = document.activeElement;
          if (anterior?.matches('.crucigrama-celda input')) anterior.value = '';
        }
      } else if (evento.key === 'ArrowRight' || evento.key === 'ArrowDown') {
        evento.preventDefault();
        moverEnEntrada(input, 1);
      } else if (evento.key === 'ArrowLeft' || evento.key === 'ArrowUp') {
        evento.preventDefault();
        moverEnEntrada(input, -1);
      }
    });
  });

  contenido.querySelectorAll('.crucigrama-pista').forEach(boton => {
    boton.addEventListener('click', () => {
      const entrada = crucigrama.entradas.find(item => item.id === boton.dataset.entrada);
      if (entrada) seleccionarEntrada(entrada);
    });
  });

  function respuestaDe(entrada) {
    return celdasEntrada(entrada).map(celda => normalizar(celda.querySelector('input').value)).join('');
  }

  function comprobarEntrada() {
    const correcta = respuestaDe(entradaActiva) === entradaActiva.palabra;
    celdasEntrada(entradaActiva).forEach(celda => {
      celda.classList.remove('crucigrama-celda--correcta', 'crucigrama-celda--incorrecta');
      celda.classList.add(correcta ? 'crucigrama-celda--correcta' : 'crucigrama-celda--incorrecta');
    });
    mostrarRetro({
      correcto: correcta,
      explicacion: definiciones.get(entradaActiva.palabra) || entradaActiva.pista,
      sugerencia: correcta ? 'Palabra completada correctamente.' : 'Revisa las letras y vuelve a intentarlo.',
      enlaceTema: `/paginas/tema.html?id=${encodeURIComponent(tema.id)}#sec-glosario`,
      contenedor: '#panel-retro'
    });
  }

  function revelarLetra() {
    if (reveladas >= 3) return aviso('Ya utilizaste las 3 letras disponibles.', 'error');
    const entradasOrdenadas = [entradaActiva, ...crucigrama.entradas.filter(item => item !== entradaActiva)];
    for (const entrada of entradasOrdenadas) {
      const casillas = celdasEntrada(entrada);
      const indice = casillas.findIndex((celda, i) => normalizar(celda.querySelector('input').value) !== entrada.palabra[i]);
      if (indice !== -1) {
        const input = casillas[indice].querySelector('input');
        input.value = entrada.palabra[indice];
        casillas[indice].classList.add('crucigrama-celda--revelada');
        reveladas++;
        document.getElementById('contador-reveladas').textContent = `Ayudas: ${reveladas} / 3`;
        if (reveladas >= 3) document.getElementById('btn-revelar').disabled = true;
        input.focus();
        return;
      }
    }
    aviso('Todas las letras ya están completas.', 'info');
  }

  async function terminar() {
    if (terminado) return;
    terminado = true;
    contenido.querySelectorAll('.crucigrama-celda input').forEach(input => { input.disabled = true; });
    const correctas = crucigrama.entradas.filter(entrada => respuestaDe(entrada) === entrada.palabra).length;
    const incorrectas = crucigrama.entradas.length - correctas;
    const errores = incorrectas + reveladas;
    try {
      await registrarIntento({
        actividad: 'crucigrama',
        temaId: tema.id,
        nivel: 1,
        puntaje: correctas,
        maximo: crucigrama.entradas.length,
        errores,
        duracionSeg: Math.max(1, Math.round((Date.now() - inicio) / 1000)),
        detalle: { palabras: crucigrama.entradas.length, letrasReveladas: reveladas }
      });
    } catch (error) {
      console.warn('No se pudo registrar el intento de crucigrama:', error);
    }
    const accion = await mostrarResumen({
      titulo: 'Resultado del crucigrama',
      aciertos: correctas,
      errores,
      recomendaciones: incorrectas === 0 ? 'Completaste todas las palabras.' : 'Repasa el glosario del tema y vuelve a intentarlo.',
      enlaceTema: `/paginas/tema.html?id=${encodeURIComponent(tema.id)}#sec-glosario`
    });
    if (accion === 'repetir') window.location.reload();
  }

  document.getElementById('btn-comprobar').addEventListener('click', comprobarEntrada);
  document.getElementById('btn-revelar').addEventListener('click', revelarLetra);
  document.getElementById('btn-terminar').addEventListener('click', terminar);
  seleccionarEntrada(entradaActiva, false);
}

if (typeof document !== 'undefined') {
  await iniciarPagina();
}
