// publico/js/modulos/pareja.js · Juego interactivo Encuentra la Pareja
import { montarPlantilla } from '../nucleo/plantilla.js';
import { listar } from '../nucleo/api.js';
import { obtenerTemaActividad } from '../nucleo/selector-tema.js';
import { mostrarRetro, mostrarResumen } from '../nucleo/retroalimentacion.js';
import { registrarIntento } from '../nucleo/gamificacion.js';
import { barajar } from '../nucleo/util.js';
import { escapar, cargando } from '../nucleo/ui.js';

await montarPlantilla({ titulo: "Encuentra la pareja", roles: ["estudiante", "docente"] });

const contenido = document.getElementById('contenido');

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
          <div class="vacio__icono">🃏</div>
          <h2 class="vacio__titulo">Tema no seleccionado</h2>
          <p class="vacio__texto">Debes seleccionar un tema para iniciar el juego Encuentra la Pareja.</p>
          <a href="/paginas/actividades.html" class="btn btn--primario" style="margin-top: var(--espacio-m);">Ver Actividades</a>
        </div>
      `;
    }
    return;
  }

  // Cargar términos del glosario
  cargando(true);
  let terminosGlosario = [];
  try {
    const glosario = await listar('glosario', { temaId: tema.id });
    terminosGlosario = (glosario || []).filter(g => g.termino && g.definicion);
  } catch (err) {
    console.error('Error al cargar glosario:', err);
  } finally {
    cargando(false);
  }

  // Mínimo 4 términos requeridos
  if (terminosGlosario.length < 4) {
    if (contenido) {
      contenido.innerHTML = `
        <div class="tarjeta vacio">
          <div class="vacio__icono">📖</div>
          <h2 class="vacio__titulo">Glosario insuficiente</h2>
          <p class="vacio__texto">El tema <strong>${escapar(tema.titulo)}</strong> no cuenta con suficientes términos (mínimo 4) en su glosario para jugar a Encuentra la Pareja.</p>
          <div class="fila fila--s" style="justify-content: center; margin-top: var(--espacio-m);">
            <a href="/paginas/tema.html?id=${encodeURIComponent(tema.id)}" class="btn btn--primario">Ir al Tema</a>
            <a href="/paginas/pareja.html" class="btn btn--secundario">Elegir otro tema</a>
          </div>
        </div>
      `;
    }
    return;
  }

  // Opciones de dificultad: 6, 8 o 10 parejas (o los disponibles)
  const maxDisponible = terminosGlosario.length;
  let dificultadDeseada = Math.min(6, maxDisponible);

  let primeraCarta = null;
  let segundaCarta = null;
  let bloqueado = false;
  let intentos = 0;
  let parejasEncontradas = 0;
  let totalParejas = dificultadDeseada;
  let tiempoInicio = Date.now();
  let temporizadorIntervalo = null;
  let juegoTerminado = false;

  function formatearTiempo(segundosTotales) {
    const mins = Math.floor(segundosTotales / 60);
    const segs = segundosTotales % 60;
    return `${String(mins).padStart(2, '0')}:${String(segs).padStart(2, '0')}`;
  }

  function iniciarPartida(numParejas = dificultadDeseada) {
    if (temporizadorIntervalo) {
      clearInterval(temporizadorIntervalo);
    }

    dificultadDeseada = Math.min(numParejas, maxDisponible);
    totalParejas = dificultadDeseada;

    // Seleccionar N términos al azar
    const seleccionados = barajar(terminosGlosario).slice(0, totalParejas);

    // Crear tarjetas para término y definición
    const baraja = [];
    seleccionados.forEach(term => {
      baraja.push({
        id: `card-${term.id}-term`,
        parejaId: term.id,
        tipo: 'termino',
        texto: term.termino,
        definicion: term.definicion
      });
      baraja.push({
        id: `card-${term.id}-def`,
        parejaId: term.id,
        tipo: 'definicion',
        texto: term.definicion,
        definicion: term.definicion
      });
    });

    const cartasBarajadas = barajar(baraja);

    primeraCarta = null;
    segundaCarta = null;
    bloqueado = false;
    intentos = 0;
    parejasEncontradas = 0;
    juegoTerminado = false;
    tiempoInicio = Date.now();

    renderizarJuego(cartasBarajadas);

    // Iniciar cronómetro
    const elTiempo = document.getElementById('tiempo-transcurrido');
    temporizadorIntervalo = setInterval(() => {
      if (!juegoTerminado && elTiempo) {
        const segs = Math.floor((Date.now() - tiempoInicio) / 1000);
        elTiempo.textContent = formatearTiempo(segs);
      }
    }, 1000);
  }

  function renderizarJuego(cartas) {
    if (!contenido) return;

    // Opciones de selector de dificultad
    const dificultadesDisponibles = [6, 8, 10].filter(n => maxDisponible >= n || (n === 6 && maxDisponible >= 4));
    if (dificultadesDisponibles.length === 0) {
      dificultadesDisponibles.push(maxDisponible);
    }

    const dificultadBotonesHtml = dificultadesDisponibles.map(n => {
      const cantidadEfectiva = Math.min(n, maxDisponible);
      const activo = totalParejas === cantidadEfectiva;
      const clase = activo ? 'btn--primario' : 'btn--secundario';
      return `
        <button type="button" class="btn ${clase} btn--pequeno btn-dificultad" data-parejas="${cantidadEfectiva}">
          ${cantidadEfectiva} parejas
        </button>
      `;
    }).join('');

    const cartasHtml = cartas.map((c, index) => `
      <button type="button"
              class="carta carta--${c.tipo}"
              id="${c.id}"
              data-id="${c.id}"
              data-pareja-id="${c.parejaId}"
              data-tipo="${c.tipo}"
              data-index="${index}"
              aria-label="Tarjeta ${index + 1} boca abajo"
              aria-pressed="false">
        <div class="carta__interior">
          <div class="carta__frente">
            <span class="carta__frente-icono" aria-hidden="true">❓</span>
            <span class="carta__frente-texto">UNEMI</span>
          </div>
          <div class="carta__dorso">
            <span class="carta__dorso-tipo">${c.tipo === 'termino' ? 'Concepto' : 'Definición'}</span>
            <div class="carta__dorso-contenido">${escapar(c.texto)}</div>
          </div>
        </div>
      </button>
    `).join('');

    contenido.innerHTML = `
      <div class="pareja-layout">
        <header class="pareja-cabecera">
          <div class="pareja-cabecera__info">
            <a href="/paginas/actividades.html" class="btn btn--texto btn--pequeno" style="padding-left: 0; align-self: flex-start;">
              ← Volver a Actividades
            </a>
            <h1 class="pareja-cabecera__titulo">Encuentra la Pareja</h1>
            <div class="pareja-cabecera__tema">
              Tema: <a href="/paginas/tema.html?id=${encodeURIComponent(tema.id)}" style="color: var(--primario); font-weight: var(--peso-seminegrita);">${escapar(tema.titulo)}</a>
            </div>
          </div>
        </header>

        <section class="pareja-controles">
          <div class="pareja-dificultad" role="group" aria-label="Seleccionar dificultad">
            <span class="pareja-dificultad__etiqueta">Dificultad:</span>
            ${dificultadBotonesHtml}
          </div>

          <div class="pareja-estadisticas" aria-live="polite">
            <div class="estadistica-item">
              <span>Intentos:</span>
              <strong id="contador-intentos">${intentos}</strong>
            </div>
            <div class="estadistica-item">
              <span>Parejas:</span>
              <strong id="contador-parejas">${parejasEncontradas} / ${totalParejas}</strong>
            </div>
            <div class="estadistica-item">
              <span>Tiempo:</span>
              <strong id="tiempo-transcurrido">00:00</strong>
            </div>
          </div>
        </section>

        <section class="tarjeta" style="padding: var(--espacio-m);">
          <div class="tablero-parejas" role="region" aria-label="Tablero de tarjetas">
            ${cartasHtml}
          </div>
          <div id="panel-retro" style="width: 100%; margin-top: var(--espacio-m);"></div>
        </section>
      </div>
    `;

    // Eventos de dificultad
    const btnsDif = contenido.querySelectorAll('.btn-dificultad');
    btnsDif.forEach(btn => {
      btn.addEventListener('click', () => {
        const cant = parseInt(btn.getAttribute('data-parejas'), 10);
        if (cant && cant !== totalParejas) {
          iniciarPartida(cant);
        }
      });
    });

    // Eventos de voltear cartas
    const elementosCartas = contenido.querySelectorAll('.carta');
    elementosCartas.forEach(el => {
      el.addEventListener('click', () => {
        const index = parseInt(el.getAttribute('data-index'), 10);
        const cardObj = cartas[index];
        if (cardObj) {
          voltearCarta(el, cardObj);
        }
      });
    });
  }

  async function voltearCarta(elCarta, cardObj) {
    if (bloqueado || juegoTerminado) return;
    if (elCarta.classList.contains('descubierta') || elCarta.classList.contains('volteada')) return;
    if (primeraCarta && primeraCarta.el === elCarta) return;

    // Voltear visualmente
    elCarta.classList.add('volteada');
    elCarta.setAttribute('aria-pressed', 'true');
    elCarta.setAttribute('aria-label', `${cardObj.tipo === 'termino' ? 'Concepto' : 'Definición'}: ${cardObj.texto}`);

    if (!primeraCarta) {
      primeraCarta = { el: elCarta, obj: cardObj };
    } else {
      segundaCarta = { el: elCarta, obj: cardObj };
      intentos++;

      const elIntentos = document.getElementById('contador-intentos');
      if (elIntentos) elIntentos.textContent = intentos;

      // Verificar si forman pareja
      if (primeraCarta.obj.parejaId === segundaCarta.obj.parejaId) {
        // ¡Pareja encontrada!
        primeraCarta.el.classList.add('descubierta');
        segundaCarta.el.classList.add('descubierta');
        primeraCarta.el.disabled = true;
        segundaCarta.el.disabled = true;

        parejasEncontradas++;
        const elParejas = document.getElementById('contador-parejas');
        if (elParejas) {
          elParejas.textContent = `${parejasEncontradas} / ${totalParejas}`;
        }

        // Mostrar retroalimentación con la definición
        mostrarRetro({
          correcto: true,
          explicacion: primeraCarta.obj.definicion,
          enlaceTema: `/paginas/tema.html?id=${encodeURIComponent(tema.id)}`,
          contenedor: '#panel-retro'
        });

        primeraCarta = null;
        segundaCarta = null;

        // Comprobar si se completó el juego
        if (parejasEncontradas === totalParejas) {
          await finalizarPartida();
        }
      } else {
        // No coinciden: esperar 1.2 s y voltear boca abajo
        bloqueado = true;
        setTimeout(() => {
          if (primeraCarta && primeraCarta.el) {
            primeraCarta.el.classList.remove('volteada');
            primeraCarta.el.setAttribute('aria-pressed', 'false');
            primeraCarta.el.setAttribute('aria-label', 'Tarjeta boca abajo');
          }
          if (segundaCarta && segundaCarta.el) {
            segundaCarta.el.classList.remove('volteada');
            segundaCarta.el.setAttribute('aria-pressed', 'false');
            segundaCarta.el.setAttribute('aria-label', 'Tarjeta boca abajo');
          }
          primeraCarta = null;
          segundaCarta = null;
          bloqueado = false;
        }, 1200);
      }
    }
  }

  async function finalizarPartida() {
    juegoTerminado = true;
    if (temporizadorIntervalo) {
      clearInterval(temporizadorIntervalo);
    }

    const duracionSeg = Math.max(1, Math.round((Date.now() - tiempoInicio) / 1000));
    const errores = Math.max(0, intentos - totalParejas);
    const puntaje = Math.max(0, 10 - errores);

    // Registrar intento en el servidor
    try {
      await registrarIntento({
        actividad: 'pareja',
        temaId: tema.id,
        puntaje,
        maximo: 10,
        errores,
        duracionSeg
      });
    } catch (err) {
      console.warn('Error al registrar intento:', err);
    }

    // Modal de resumen
    const accion = await mostrarResumen({
      titulo: '¡Completaste Encuentra la Pareja!',
      aciertos: totalParejas,
      errores,
      recomendaciones: errores === 0
        ? '¡Excelente retención conceptual! No cometiste ningún fallo.'
        : `Completaste las ${totalParejas} parejas en ${intentos} intentos. ¡Repite para afianzar conceptos!`,
      enlaceTema: `/paginas/tema.html?id=${encodeURIComponent(tema.id)}`
    });

    if (accion === 'repetir') {
      iniciarPartida();
    }
  }

  // Iniciar con la primera partida
  iniciarPartida();
}

await iniciarModulo();
