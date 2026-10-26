// publico/js/modulos/ahorcado.js · Juego interactivo del Ahorcado
import { montarPlantilla } from '../nucleo/plantilla.js';
import { listar } from '../nucleo/api.js';
import { obtenerTemaActividad } from '../nucleo/selector-tema.js';
import { mostrarRetro } from '../nucleo/retroalimentacion.js';
import { registrarIntento } from '../nucleo/gamificacion.js';
import { normalizar } from '../nucleo/util.js';
import { escapar, cargando } from '../nucleo/ui.js';

await montarPlantilla({ titulo: "Ahorcado", roles: ["estudiante", "docente"] });

const contenido = document.getElementById('contenido');

// Definición de filas para el teclado en pantalla con Ñ
const FILAS_TECLADO = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'Ñ'],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M']
];

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
          <div class="vacio__icono">🎮</div>
          <h2 class="vacio__titulo">Tema no seleccionado</h2>
          <p class="vacio__texto">Debes seleccionar un tema para iniciar la actividad del Ahorcado.</p>
          <a href="/paginas/actividades.html" class="btn btn--primario" style="margin-top: var(--espacio-m);">Ver Actividades</a>
        </div>
      `;
    }
    return;
  }

  // Cargar glosario del tema
  cargando(true);
  let terminosGlosario = [];
  try {
    const glosario = await listar('glosario', { temaId: tema.id });
    terminosGlosario = (glosario || []).filter(item => {
      const limpio = normalizar(item.termino || '');
      return limpio.length === 6 && !limpio.includes(' ');
    });
  } catch (err) {
    console.error('Error al cargar glosario:', err);
  } finally {
    cargando(false);
  }

  if (terminosGlosario.length === 0) {
    if (contenido) {
      contenido.innerHTML = `
        <div class="tarjeta vacio">
          <div class="vacio__icono">📖</div>
          <h2 class="vacio__titulo">Sin términos de 6 letras</h2>
          <p class="vacio__texto">El tema <strong>${escapar(tema.titulo)}</strong> no cuenta con términos de exactamente 6 letras en su glosario para jugar al Ahorcado.</p>
          <div class="fila fila--s" style="justify-content: center; margin-top: var(--espacio-m);">
            <a href="/paginas/tema.html?id=${encodeURIComponent(tema.id)}" class="btn btn--primario">Ir al Tema</a>
            <a href="/paginas/ahorcado.html" class="btn btn--secundario">Elegir otro tema</a>
          </div>
        </div>
      `;
    }
    return;
  }

  // Estado de la sesión del juego
  const terminosUsados = new Set();
  let terminoActual = null;
  let palabraSecreta = '';
  let letrasAdivinadas = new Set();
  let letrasErroneas = new Set();
  let errores = 0;
  let juegoTerminado = false;
  let tiempoInicio = Date.now();

  function iniciarPartida() {
    let disponibles = terminosGlosario.filter(t => !terminosUsados.has(t.id));
    if (disponibles.length === 0) {
      terminosUsados.clear();
      disponibles = [...terminosGlosario];
    }

    // Elegir al azar uno que no se haya usado
    terminoActual = disponibles[Math.floor(Math.random() * disponibles.length)];
    terminosUsados.add(terminoActual.id);

    palabraSecreta = normalizar(terminoActual.termino);
    letrasAdivinadas = new Set();
    letrasErroneas = new Set();
    errores = 0;
    juegoTerminado = false;
    tiempoInicio = Date.now();

    renderizarTablero();
  }

  function renderizarTablero() {
    if (!contenido) return;

    const casillasHtml = Array.from({ length: 6 }).map((_, i) => {
      const letra = palabraSecreta[i];
      const descubierta = letrasAdivinadas.has(letra);
      return `
        <div class="casilla" id="casilla-${i}" aria-label="Casilla ${i + 1}">
          ${descubierta ? letra : ''}
        </div>
      `;
    }).join('');

    const tecladoHtml = FILAS_TECLADO.map(fila => `
      <div class="teclado-fila">
        ${fila.map(letra => `
          <button type="button" class="tecla" data-letra="${letra}" id="tecla-${letra}" aria-label="Letra ${letra}">
            ${letra}
          </button>
        `).join('')}
      </div>
    `).join('');

    contenido.innerHTML = `
      <div class="ahorcado-layout">
        <header class="ahorcado-cabecera">
          <div class="ahorcado-cabecera__info">
            <a href="/paginas/actividades.html" class="btn btn--texto btn--pequeno" style="padding-left: 0; align-self: flex-start;">
              ← Volver a Actividades
            </a>
            <h1 class="ahorcado-cabecera__titulo">Ahorcado</h1>
            <div class="ahorcado-cabecera__tema">
              Tema: <a href="/paginas/tema.html?id=${encodeURIComponent(tema.id)}" style="color: var(--primario); font-weight: var(--peso-seminegrita);">${escapar(tema.titulo)}</a>
            </div>
          </div>
          <div class="insignia insignia--info" style="font-size: var(--tamano-s);">
            Vidas restantes: <strong id="vidas-restantes" style="margin-left: var(--espacio-xs);">${4 - errores}</strong>
          </div>
        </header>

        <section class="ahorcado-escenario" aria-label="Área de juego">
          <!-- Figura no violenta de 4 estados: globo que se desinfla -->
          <div class="globo-contenedor" aria-live="polite">
            <svg id="globo-svg" class="globo-svg" viewBox="0 0 140 180" data-errores="${errores}" role="img" aria-label="Globo de vidas: ${4 - errores} restantes">
              <line class="globo__hilo" x1="70" y1="130" x2="70" y2="175" />
              <polygon class="globo__nudo" points="66,130 74,130 70,126" />
              <ellipse class="globo__cuerpo" cx="70" cy="75" rx="46" ry="58" />
              <ellipse class="globo__brillo" cx="54" cy="55" rx="10" ry="18" transform="rotate(-25 54 55)" />
            </svg>
          </div>

          <div class="ahorcado-pista">
            <strong>Pista:</strong> ${escapar(terminoActual.pista || 'Descubre la palabra de 6 letras.')}
          </div>

          <div class="ahorcado-palabra" role="group" aria-label="Palabra de 6 letras">
            ${casillasHtml}
          </div>

          <div class="ahorcado-teclado" role="group" aria-label="Teclado en pantalla">
            ${tecladoHtml}
          </div>

          <div id="contenedor-acciones" class="ahorcado-acciones" style="display: none;">
            <button type="button" id="btn-otra-palabra" class="btn btn--primario">
              Otra palabra
            </button>
            <a href="/paginas/tema.html?id=${encodeURIComponent(tema.id)}" class="btn btn--secundario">
              Repasar tema
            </a>
          </div>

          <div id="panel-retro" style="width: 100%;"></div>
        </section>
      </div>
    `;

    // Asignar eventos de clic a las teclas
    const teclasBtns = contenido.querySelectorAll('.tecla');
    teclasBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const letra = btn.getAttribute('data-letra');
        if (letra) jugarLetra(letra);
      });
    });

    const btnOtra = document.getElementById('btn-otra-palabra');
    if (btnOtra) {
      btnOtra.addEventListener('click', () => {
        iniciarPartida();
      });
    }
  }

  async function jugarLetra(letraRaw) {
    if (juegoTerminado) return;

    const letra = normalizar(letraRaw);
    if (!letra || letra.length !== 1) return;
    if (letrasAdivinadas.has(letra) || letrasErroneas.has(letra)) return;

    const btnTecla = document.getElementById(`tecla-${letra}`);
    if (btnTecla) {
      btnTecla.disabled = true;
    }

    if (palabraSecreta.includes(letra)) {
      letrasAdivinadas.add(letra);
      if (btnTecla) {
        btnTecla.classList.add('tecla--acierto');
      }

      // Actualizar casillas
      for (let i = 0; i < 6; i++) {
        if (palabraSecreta[i] === letra) {
          const casilla = document.getElementById(`casilla-${i}`);
          if (casilla) {
            casilla.textContent = letra;
            casilla.classList.add('casilla--acierto');
          }
        }
      }

      // Comprobar si ganó
      const todasAdivinadas = palabraSecreta.split('').every(l => letrasAdivinadas.has(l));
      if (todasAdivinadas) {
        await finalizarPartida(true);
      }
    } else {
      letrasErroneas.add(letra);
      errores++;

      if (btnTecla) {
        btnTecla.classList.add('tecla--error');
      }

      // Actualizar globo y vidas
      const globoSvg = document.getElementById('globo-svg');
      if (globoSvg) {
        globoSvg.setAttribute('data-errores', Math.min(errores, 4));
      }

      const vidasRestantes = document.getElementById('vidas-restantes');
      if (vidasRestantes) {
        vidasRestantes.textContent = Math.max(0, 4 - errores);
      }

      // Se permiten 3 errores: termina en el cuarto
      if (errores >= 4) {
        await finalizarPartida(false);
      }
    }
  }

  async function finalizarPartida(gano) {
    juegoTerminado = true;

    // Desactivar todas las teclas restantes
    const teclas = contenido.querySelectorAll('.tecla');
    teclas.forEach(t => {
      t.disabled = true;
    });

    // Revelar la palabra en las casillas
    for (let i = 0; i < 6; i++) {
      const casilla = document.getElementById(`casilla-${i}`);
      if (casilla) {
        const letraReal = palabraSecreta[i];
        casilla.textContent = letraReal;
        if (!letrasAdivinadas.has(letraReal)) {
          casilla.classList.add('casilla--fallo');
        }
      }
    }

    const duracionSeg = Math.max(1, Math.round((Date.now() - tiempoInicio) / 1000));
    const puntaje = gano ? Math.max(0, 10 - errores * 2) : 0;
    const enlaceTema = `/paginas/tema.html?id=${encodeURIComponent(tema.id)}`;

    // Mostrar panel de retroalimentación
    mostrarRetro({
      correcto: gano,
      explicacion: terminoActual.definicion || '',
      sugerencia: terminoActual.retroalimentacion || '',
      enlaceTema,
      contenedor: '#panel-retro'
    });

    // Mostrar botón "Otra palabra"
    const contenedorAcciones = document.getElementById('contenedor-acciones');
    if (contenedorAcciones) {
      contenedorAcciones.style.display = 'flex';
    }

    // Registrar intento en el servidor con gamificación
    try {
      await registrarIntento({
        actividad: 'ahorcado',
        temaId: tema.id,
        puntaje,
        maximo: 10,
        errores,
        duracionSeg
      });
    } catch (err) {
      console.warn('Error al registrar intento:', err);
    }
  }

  // Escuchar teclado físico
  function manejarTecladoFisico(e) {
    if (juegoTerminado) return;
    const tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

    let teclaPresionada = e.key;
    if (!teclaPresionada) return;

    if (teclaPresionada.length === 1) {
      const norm = normalizar(teclaPresionada);
      if (/^[A-ZÑ]$/.test(norm)) {
        e.preventDefault();
        jugarLetra(norm);
      }
    }
  }

  window.addEventListener('keydown', manejarTecladoFisico);

  // Iniciar la primera partida
  iniciarPartida();
}

await iniciarModulo();
