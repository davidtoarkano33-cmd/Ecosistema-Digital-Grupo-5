// publico/js/modulos/sopa-letras.js · Juego interactivo de Sopa de Letras
import { montarPlantilla } from '../nucleo/plantilla.js';
import { listar } from '../nucleo/api.js';
import { obtenerTemaActividad } from '../nucleo/selector-tema.js';
import { mostrarRetro, mostrarResumen } from '../nucleo/retroalimentacion.js';
import { registrarIntento } from '../nucleo/gamificacion.js';
import { normalizar, barajar } from '../nucleo/util.js';
import { escapar, cargando } from '../nucleo/ui.js';

await montarPlantilla({ titulo: "Sopa de letras", roles: ["estudiante", "docente"] });

const contenido = document.getElementById('contenido');

const ABECEDARIO = [
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
  'N', 'Ñ', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'
];

/**
 * Función pura que genera la cuadrícula y coloca palabras sin colisiones.
 * @param {string[]} palabras - Lista de palabras normalizadas
 * @param {number} tamano - Dimensión de la grilla (tamano x tamano)
 * @param {number[][]} direcciones - Lista de vectores de dirección [dFila, dCol]
 * @returns {{ grilla: string[][], ubicaciones: Array<{ palabra: string, celdas: Array<{f: number, c: number}> }> }}
 */
export function generarSopa(palabras, tamano, direcciones) {
  // 1. Inicializar grilla vacía
  const grilla = Array.from({ length: tamano }, () => Array(tamano).fill(''));
  const ubicaciones = [];

  // 2. Ordenar palabras de la más larga a la más corta
  const palabrasOrdenadas = [...palabras].sort((a, b) => b.length - a.length);

  // 3. Colocar cada palabra con hasta 200 intentos
  for (const palabra of palabrasOrdenadas) {
    if (!palabra || palabra.length > tamano) continue;

    let colocada = false;
    for (let intento = 0; intento < 200; intento++) {
      const dir = direcciones[Math.floor(Math.random() * direcciones.length)];
      const [df, dc] = dir;

      const fIni = Math.floor(Math.random() * tamano);
      const cIni = Math.floor(Math.random() * tamano);

      const fFin = fIni + df * (palabra.length - 1);
      const cFin = cIni + dc * (palabra.length - 1);

      // Comprobar límites
      if (fFin < 0 || fFin >= tamano || cFin < 0 || cFin >= tamano) {
        continue;
      }

      // Comprobar colisiones y cruces válidos
      let colision = false;
      for (let i = 0; i < palabra.length; i++) {
        const rf = fIni + df * i;
        const rc = cIni + dc * i;
        const letraExistente = grilla[rf][rc];
        if (letraExistente !== '' && letraExistente !== palabra[i]) {
          colision = true;
          break;
        }
      }

      if (colision) continue;

      // Colocar palabra en la grilla
      const celdas = [];
      for (let i = 0; i < palabra.length; i++) {
        const rf = fIni + df * i;
        const rc = cIni + dc * i;
        grilla[rf][rc] = palabra[i];
        celdas.push({ f: rf, c: rc });
      }

      ubicaciones.push({
        palabra,
        celdas,
        inicio: [fIni, cIni],
        fin: [fFin, cFin]
      });

      colocada = true;
      break;
    }
  }

  // 4. Rellenar celdas vacías con letras aleatorias A–Z y Ñ
  for (let r = 0; r < tamano; r++) {
    for (let c = 0; c < tamano; c++) {
      if (grilla[r][c] === '') {
        const letraRandom = ABECEDARIO[Math.floor(Math.random() * ABECEDARIO.length)];
        grilla[r][c] = letraRandom;
      }
    }
  }

  return { grilla, ubicaciones };
}

// Configuraciones de dificultad
const DIFICULTADES = {
  facil: {
    nombre: 'Fácil',
    palabrasMax: 8,
    tamano: 10,
    // Horizontal y vertical hacia adelante
    direcciones: [
      [0, 1], // derecha
      [1, 0]  // abajo
    ]
  },
  media: {
    nombre: 'Media',
    palabrasMax: 10,
    tamano: 12,
    // Horizontal, vertical y diagonales
    direcciones: [
      [0, 1],  // derecha
      [1, 0],  // abajo
      [1, 1],  // diagonal abajo-derecha
      [1, -1]  // diagonal abajo-izquierda
    ]
  },
  dificil: {
    nombre: 'Difícil',
    palabrasMax: 12,
    tamano: 15,
    // Horizontal, vertical, diagonales e invertidas
    direcciones: [
      [0, 1],   // derecha
      [1, 0],   // abajo
      [1, 1],   // abajo-derecha
      [1, -1],  // abajo-izquierda
      [0, -1],  // izquierda
      [-1, 0],  // arriba
      [-1, 1],  // arriba-derecha
      [-1, -1]  // arriba-izquierda
    ]
  }
};

async function iniciarModulo() {
  let tema = null;
  try {
    tema = await obtenerTemaActividad();
  } catch (err) {
    console.error('Error al obtener tema:', err);
  }

  if (!tema) {
    if (contenido) {
      contenido.innerHTML = `
        <div class="tarjeta vacio">
          <div class="vacio__icono">🔍</div>
          <h2 class="vacio__titulo">Tema no seleccionado</h2>
          <p class="vacio__texto">Debes seleccionar un tema para iniciar la Sopa de Letras.</p>
          <a href="/paginas/actividades.html" class="btn btn--primario" style="margin-top: var(--espacio-m);">Ver Actividades</a>
        </div>
      `;
    }
    return;
  }

  // Cargar términos del glosario
  cargando(true);
  let glosario = [];
  try {
    glosario = await listar('glosario', { temaId: tema.id });
  } catch (err) {
    console.error('Error al cargar glosario:', err);
  } finally {
    cargando(false);
  }

  // Filtrar palabras de una sola palabra de 3 letras en adelante
  const terminosValidos = (glosario || []).filter(g => {
    if (!g.termino) return false;
    const limpio = normalizar(g.termino);
    return !limpio.includes(' ') && limpio.length >= 3 && limpio.length <= 15;
  });

  if (terminosValidos.length < 4) {
    if (contenido) {
      contenido.innerHTML = `
        <div class="tarjeta vacio">
          <div class="vacio__icono">📖</div>
          <h2 class="vacio__titulo">Glosario insuficiente</h2>
          <p class="vacio__texto">El tema <strong>${escapar(tema.titulo)}</strong> no cuenta con suficientes palabras válidas (mínimo 4) en su glosario para la Sopa de Letras.</p>
          <div class="fila fila--s" style="justify-content: center; margin-top: var(--espacio-m);">
            <a href="/paginas/tema.html?id=${encodeURIComponent(tema.id)}" class="btn btn--primario">Ir al Tema</a>
            <a href="/paginas/sopa-letras.html" class="btn btn--secundario">Elegir otro tema</a>
          </div>
        </div>
      `;
    }
    return;
  }

  let claveDificultad = 'facil';
  let grillaActual = [];
  let ubicacionesActuales = [];
  let palabrasEncontradas = new Set();
  let mapaDefiniciones = new Map();
  let juegoTerminado = false;
  let tiempoInicio = Date.now();
  let temporizadorIntervalo = null;

  // Variables de interacción Pointer Events
  let seleccionando = false;
  let celdaInicio = null;
  let celdasSeleccionadas = [];

  function formatearTiempo(segs) {
    const mins = Math.floor(segs / 60);
    const s = segs % 60;
    return `${String(mins).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  function iniciarPartida(nuevaDificultad = claveDificultad) {
    if (temporizadorIntervalo) clearInterval(temporizadorIntervalo);

    claveDificultad = nuevaDificultad;
    const config = DIFICULTADES[claveDificultad];

    // Filtrar palabras que quepan en el tamaño actual
    const palabrasAptas = terminosValidos.filter(t => {
      const palabraNorm = normalizar(t.termino);
      return palabraNorm.length <= config.tamano;
    });

    const palabrasBarajadas = barajar(palabrasAptas).slice(0, config.palabrasMax);

    // Mapear términos y definiciones
    mapaDefiniciones.clear();
    const listaTextos = [];
    palabrasBarajadas.forEach(t => {
      const norm = normalizar(t.termino);
      mapaDefiniciones.set(norm, {
        termino: t.termino,
        definicion: t.definicion || ''
      });
      listaTextos.push(norm);
    });

    // Generar sopa
    const resultado = generarSopa(listaTextos, config.tamano, config.direcciones);
    grillaActual = resultado.grilla;
    ubicacionesActuales = resultado.ubicaciones;

    palabrasEncontradas.clear();
    juegoTerminado = false;
    seleccionando = false;
    celdaInicio = null;
    celdasSeleccionadas = [];
    tiempoInicio = Date.now();

    renderizarJuego();

    const elTiempo = document.getElementById('sopa-cronometro');
    temporizadorIntervalo = setInterval(() => {
      if (!juegoTerminado && elTiempo) {
        const segs = Math.floor((Date.now() - tiempoInicio) / 1000);
        elTiempo.textContent = formatearTiempo(segs);
      }
    }, 1000);
  }

  function renderizarJuego() {
    if (!contenido) return;

    const config = DIFICULTADES[claveDificultad];
    const tamano = config.tamano;

    // Botones de dificultad
    const btnsDifHtml = Object.entries(DIFICULTADES).map(([key, item]) => {
      const activo = key === claveDificultad;
      const clase = activo ? 'btn--primario' : 'btn--secundario';
      return `
        <button type="button" class="btn ${clase} btn--pequeno btn-sopa-dificultad" data-dif="${key}">
          ${item.nombre} (${item.palabrasMax})
        </button>
      `;
    }).join('');

    // Lista de palabras a encontrar
    const listaPalabrasHtml = ubicacionesActuales.map(u => {
      const encontrada = palabrasEncontradas.has(u.palabra);
      const claseEstado = encontrada ? ' sopa-palabra-item--encontrada' : '';
      return `
        <li class="sopa-palabra-item${claseEstado}" id="palabra-item-${u.palabra}">
          ${escapar(u.palabra)}
        </li>
      `;
    }).join('');

    // Cuadrícula de celdas
    let celdasHtml = '';
    for (let r = 0; r < tamano; r++) {
      for (let c = 0; c < tamano; c++) {
        const letra = grillaActual[r][c];
        celdasHtml += `
          <div class="sopa-celda"
               data-f="${r}"
               data-c="${c}"
               id="celda-${r}-${c}"
               role="gridcell"
               aria-label="Fila ${r + 1}, Columna ${c + 1}: ${letra}">
            ${letra}
          </div>
        `;
      }
    }

    contenido.innerHTML = `
      <div class="sopa-layout">
        <header class="sopa-cabecera">
          <div class="sopa-cabecera__info">
            <a href="/paginas/actividades.html" class="btn btn--texto btn--pequeno" style="padding-left: 0; align-self: flex-start;">
              ← Volver a Actividades
            </a>
            <h1 class="sopa-cabecera__titulo">Sopa de Letras</h1>
            <div class="sopa-cabecera__tema">
              Tema: <a href="/paginas/tema.html?id=${encodeURIComponent(tema.id)}" style="color: var(--primario); font-weight: var(--peso-seminegrita);">${escapar(tema.titulo)}</a>
            </div>
          </div>
        </header>

        <section class="sopa-controles">
          <div class="sopa-dificultad" role="group" aria-label="Seleccionar dificultad">
            <span class="sopa-dificultad__etiqueta">Dificultad:</span>
            ${btnsDifHtml}
          </div>

          <div class="sopa-estadisticas" aria-live="polite">
            <div class="sopa-estadistica">
              <span>Palabras:</span>
              <strong id="contador-encontradas">${palabrasEncontradas.size} / ${ubicacionesActuales.length}</strong>
            </div>
            <div class="sopa-estadistica">
              <span>Tiempo:</span>
              <strong id="sopa-cronometro">00:00</strong>
            </div>
            <button type="button" class="btn btn--advertencia btn--pequeno" id="btn-rendirse">
              Rendirse
            </button>
          </div>
        </section>

        <div class="sopa-juego-contenedor">
          <section class="sopa-tablero-wrapper" aria-label="Cuadrícula de la sopa de letras">
            <div class="sopa-grilla"
                 id="sopa-grilla"
                 style="--filas: ${tamano}; --columnas: ${tamano};"
                 role="grid">
              ${celdasHtml}
            </div>
          </section>

          <aside class="sopa-palabras-panel">
            <div class="sopa-palabras-tarjeta">
              <h2 class="sopa-palabras-tarjeta__titulo">Palabras a buscar:</h2>
              <ul class="sopa-lista-palabras" role="list">
                ${listaPalabrasHtml}
              </ul>
            </div>
            <div id="panel-retro" style="width: 100%;"></div>
          </aside>
        </div>
      </div>
    `;

    // Eventos de botones de dificultad
    const btnsDif = contenido.querySelectorAll('.btn-sopa-dificultad');
    btnsDif.forEach(btn => {
      btn.addEventListener('click', () => {
        const d = btn.getAttribute('data-dif');
        if (d && d !== claveDificultad) {
          iniciarPartida(d);
        }
      });
    });

    // Evento botón Rendirse
    const btnRendirse = document.getElementById('btn-rendirse');
    if (btnRendirse) {
      btnRendirse.addEventListener('click', rendirse);
    }

    // Configuración de Pointer Events
    const grillaEl = document.getElementById('sopa-grilla');
    if (grillaEl) {
      grillaEl.addEventListener('pointerdown', manejarPointerDown);
      grillaEl.addEventListener('pointermove', manejarPointerMove);
      grillaEl.addEventListener('pointerup', manejarPointerUp);
      grillaEl.addEventListener('pointercancel', manejarPointerCancel);
    }
  }

  function calcularLinea(f1, c1, f2, c2) {
    const df = f2 - f1;
    const dc = c2 - c1;

    // Solo horizontal, vertical o diagonal recta de 45°
    const esHorizontal = df === 0;
    const esVertical = dc === 0;
    const esDiagonal = Math.abs(df) === Math.abs(dc);

    if (!esHorizontal && !esVertical && !esDiagonal) {
      return [{ f: f1, c: c1 }];
    }

    const pasos = Math.max(Math.abs(df), Math.abs(dc));
    const stepF = df === 0 ? 0 : df / pasos;
    const stepC = dc === 0 ? 0 : dc / pasos;

    const celdas = [];
    for (let i = 0; i <= pasos; i++) {
      celdas.push({
        f: f1 + stepF * i,
        c: c1 + stepC * i
      });
    }
    return celdas;
  }

  function manejarPointerDown(e) {
    if (juegoTerminado) return;
    const celda = e.target.closest('.sopa-celda');
    if (!celda) return;

    seleccionando = true;
    const grillaEl = document.getElementById('sopa-grilla');
    if (grillaEl) {
      try { grillaEl.setPointerCapture(e.pointerId); } catch (_) {}
    }

    const f = parseInt(celda.getAttribute('data-f'), 10);
    const c = parseInt(celda.getAttribute('data-c'), 10);
    celdaInicio = { f, c };
    celdasSeleccionadas = [{ f, c }];

    actualizarResaltado();
  }

  function manejarPointerMove(e) {
    if (!seleccionando || juegoTerminado || !celdaInicio) return;

    const elBajoPuntero = document.elementFromPoint(e.clientX, e.clientY);
    const celda = elBajoPuntero ? elBajoPuntero.closest('.sopa-celda') : null;
    if (!celda) return;

    const f = parseInt(celda.getAttribute('data-f'), 10);
    const c = parseInt(celda.getAttribute('data-c'), 10);

    celdasSeleccionadas = calcularLinea(celdaInicio.f, celdaInicio.c, f, c);
    actualizarResaltado();
  }

  function actualizarResaltado() {
    // Quitar selección previa
    const selPrevias = contenido.querySelectorAll('.sopa-celda--seleccionada');
    selPrevias.forEach(c => c.classList.remove('sopa-celda--seleccionada'));

    // Resaltar celdas de la línea actual
    for (const pos of celdasSeleccionadas) {
      const el = document.getElementById(`celda-${pos.f}-${pos.c}`);
      if (el) {
        el.classList.add('sopa-celda--seleccionada');
      }
    }
  }

  async function manejarPointerUp(e) {
    if (!seleccionando || juegoTerminado) return;
    seleccionando = false;

    const grillaEl = document.getElementById('sopa-grilla');
    if (grillaEl) {
      try { grillaEl.releasePointerCapture(e.pointerId); } catch (_) {}
    }

    // Quitar resaltado de selección
    const selPrevias = contenido.querySelectorAll('.sopa-celda--seleccionada');
    selPrevias.forEach(c => c.classList.remove('sopa-celda--seleccionada'));

    if (celdasSeleccionadas.length < 2) {
      celdasSeleccionadas = [];
      celdaInicio = null;
      return;
    }

    // Comprobar palabra formada (en sentido directo o inverso)
    const letras = celdasSeleccionadas.map(p => grillaActual[p.f][p.c]).join('');
    const letrasInvertidas = letras.split('').reverse().join('');

    const palabraEncontrada = ubicacionesActuales.find(u =>
      !palabrasEncontradas.has(u.palabra) && (u.palabra === letras || u.palabra === letrasInvertidas)
    );

    if (palabraEncontrada) {
      palabrasEncontradas.add(palabraEncontrada.palabra);

      // Marcar permanentemente celdas en la grilla
      palabraEncontrada.celdas.forEach(pos => {
        const el = document.getElementById(`celda-${pos.f}-${pos.c}`);
        if (el) {
          el.classList.add('sopa-celda--encontrada');
        }
      });

      // Tachar en la lista de palabras
      const itemPalabra = document.getElementById(`palabra-item-${palabraEncontrada.palabra}`);
      if (itemPalabra) {
        itemPalabra.classList.add('sopa-palabra-item--encontrada');
      }

      // Actualizar contador
      const elCont = document.getElementById('contador-encontradas');
      if (elCont) {
        elCont.textContent = `${palabrasEncontradas.size} / ${ubicacionesActuales.length}`;
      }

      // Mostrar retroalimentación con la definición
      const infoDef = mapaDefiniciones.get(palabraEncontrada.palabra);
      if (infoDef) {
        mostrarRetro({
          correcto: true,
          explicacion: `${infoDef.termino}: ${infoDef.definicion}`,
          enlaceTema: `/paginas/tema.html?id=${encodeURIComponent(tema.id)}`,
          contenedor: '#panel-retro'
        });
      }

      // Comprobar si completó todas las palabras
      if (palabrasEncontradas.size === ubicacionesActuales.length) {
        await finalizarPartida(true);
      }
    }

    celdasSeleccionadas = [];
    celdaInicio = null;
  }

  function manejarPointerCancel(e) {
    seleccionando = false;
    celdaInicio = null;
    celdasSeleccionadas = [];
    const selPrevias = contenido.querySelectorAll('.sopa-celda--seleccionada');
    selPrevias.forEach(c => c.classList.remove('sopa-celda--seleccionada'));
  }

  async function rendirse() {
    if (juegoTerminado) return;

    // Revelar palabras restantes
    ubicacionesActuales.forEach(u => {
      if (!palabrasEncontradas.has(u.palabra)) {
        u.celdas.forEach(pos => {
          const el = document.getElementById(`celda-${pos.f}-${pos.c}`);
          if (el && !el.classList.contains('sopa-celda--encontrada')) {
            el.classList.add('sopa-celda--revelada');
          }
        });
        const itemPalabra = document.getElementById(`palabra-item-${u.palabra}`);
        if (itemPalabra) {
          itemPalabra.classList.add('sopa-palabra-item--revelada');
        }
      }
    });

    await finalizarPartida(false);
  }

  async function finalizarPartida(gano) {
    juegoTerminado = true;
    if (temporizadorIntervalo) clearInterval(temporizadorIntervalo);

    const btnRendirse = document.getElementById('btn-rendirse');
    if (btnRendirse) btnRendirse.disabled = true;

    const total = ubicacionesActuales.length;
    const encontradas = palabrasEncontradas.size;
    const errores = total - encontradas;
    const duracionSeg = Math.max(1, Math.round((Date.now() - tiempoInicio) / 1000));
    const enlaceTema = `/paginas/tema.html?id=${encodeURIComponent(tema.id)}`;

    // Registrar intento en el servidor
    try {
      await registrarIntento({
        actividad: 'sopa-letras',
        temaId: tema.id,
        puntaje: encontradas,
        maximo: total,
        errores,
        duracionSeg
      });
    } catch (err) {
      console.warn('Error al registrar intento:', err);
    }

    // Mostrar modal resumen
    const accion = await mostrarResumen({
      titulo: gano ? '¡Sopa de letras completada!' : 'Fin de la partida',
      aciertos: encontradas,
      errores,
      recomendaciones: gano
        ? '¡Excelente agilidad visual y dominio de los términos!'
        : `Lograste encontrar ${encontradas} de ${total} palabras. Puedes repetir para practicar más.`,
      enlaceTema
    });

    if (accion === 'repetir') {
      iniciarPartida();
    }
  }

  iniciarPartida();
}

await iniciarModulo();
