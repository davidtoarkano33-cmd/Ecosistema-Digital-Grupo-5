// publico/js/modulos/simulador.js · Motor de ejecución de escenarios ramificados
import { montarPlantilla } from '../nucleo/plantilla.js';
import * as api from '../nucleo/api.js';
import { parametro, formatoBasico, barajar } from '../nucleo/util.js';
import { mostrarRetro } from '../nucleo/retroalimentacion.js';
import { registrarIntento } from '../nucleo/gamificacion.js';
import { aviso, escapar } from '../nucleo/ui.js';
import { cambiarEstado, decir, montarAvatar } from '../nucleo/avatar.js';

await montarPlantilla({ titulo: "Simulador", roles: ["sesion"] });

const contenido = document.getElementById('contenido');
const simulacionId = parametro('id');
const esVistaPrevia = parametro('vista') === 'previa';

let simulacion = null;
let puntajeMaximo = 0;
let puntosAcumulados = 0;
let recorrido = [];

function prepararEscenario() {
  if (!simulacion) return;

  // Si la simulación cuenta con un banco de dilemas, seleccionar aleatoriamente la cantidad deseada (por defecto 4)
  if (Array.isArray(simulacion.banco) && simulacion.banco.length >= 4) {
    const cantidad = Math.min(simulacion.banco.length, Number(simulacion.aleatorizar) || 4);
    const seleccionados = barajar(simulacion.banco).slice(0, cantidad);

    const escenasGeneradas = seleccionados.map((dilema, idx) => {
      const idActual = `D_${idx + 1}`;
      const idSiguiente = idx < seleccionados.length - 1 ? `D_${idx + 2}` : 'E_FINAL';

      return {
        id: idActual,
        texto: dilema.texto,
        imagen: dilema.imagen || null,
        opciones: (dilema.opciones || []).map(opt => ({
          texto: opt.texto,
          puntos: Number(opt.puntos) || 0,
          consecuencia: opt.consecuencia || '',
          destino: idSiguiente
        }))
      };
    });

    escenasGeneradas.push({
      id: 'E_FINAL',
      texto: simulacion.textoFinal || '¡Simulación completada con éxito! Has evaluado y resuelto los dilemas clínicos seleccionados aplicando los fundamentos del abordaje inicial y protocolo ABCDE.',
      opciones: []
    });

    simulacion.escenas = escenasGeneradas;
    simulacion.escenaInicial = 'D_1';
  }
}

export function calcularPuntajeMaximo(sim) {
  if (!sim || !Array.isArray(sim.escenas) || sim.escenas.length === 0) return 0;
  const mapa = new Map(sim.escenas.map(e => [e.id, e]));
  const visitados = new Set();

  function dfs(id) {
    if (!id || visitados.has(id)) return 0;
    const esc = mapa.get(id);
    if (!esc || !Array.isArray(esc.opciones) || esc.opciones.length === 0) return 0;

    visitados.add(id);
    let mejorSuma = -Infinity;

    for (const opt of esc.opciones) {
      const p = Number(opt.puntos) || 0;
      const sub = dfs(opt.destino);
      const total = p + sub;
      if (total > mejorSuma) {
        mejorSuma = total;
      }
    }

    visitados.delete(id);
    return mejorSuma === -Infinity ? 0 : mejorSuma;
  }

  const inicio = sim.escenaInicial || sim.escenas[0]?.id;
  const resultado = dfs(inicio);
  return Math.max(0, resultado);
}

async function iniciarSimulador() {
  if (!contenido) return;

  if (!simulacionId) {
    contenido.innerHTML = `
      <div class="alerta alerta--error" role="alert">
        <p>No se especificó ninguna simulación para iniciar.</p>
        <div style="margin-top: var(--espacio-m);">
          <a href="/paginas/simulaciones.html" class="btn btn--secundario">Volver a simulaciones</a>
        </div>
      </div>
    `;
    return;
  }

  contenido.innerHTML = `
    <div class="cargando" role="status" aria-live="polite">
      <p style="color: var(--texto-suave);">Cargando escenario...</p>
    </div>
  `;

  try {
    simulacion = await api.obtener('simulaciones', simulacionId);

    if (!simulacion) {
      throw new Error('Simulación no encontrada');
    }

    // Si el modo es "rol", mostrar "Próximamente"
    if (simulacion.modo === 'rol') {
      iniciarSimuladorRol();
      return;
    }

    if (simulacion.modo === 'rol') {
      contenido.innerHTML = `
        <div class="simulador-contenedor">
          <section class="tarjeta vacio" style="padding: var(--espacio-2xl) var(--espacio-xl); text-align: center;">
            <div class="vacio__icono" aria-hidden="true" style="font-size: 3rem; margin-bottom: var(--espacio-s);">🎭</div>
            <h1 class="vacio__titulo" style="color: var(--primario); margin-bottom: var(--espacio-s);">${escapar(simulacion.titulo || 'Simulación de rol')}</h1>
            <p class="chip chip--morado" style="display: inline-block; margin-bottom: var(--espacio-m);">Modo Rol Interactivo</p>
            <p class="vacio__texto" style="color: var(--texto-suave); font-size: var(--tamano-l); margin-bottom: var(--espacio-xl);">
              Próximamente
            </p>
            <p style="color: var(--texto-suave); margin-bottom: var(--espacio-xl); max-width: 500px; margin-left: auto; margin-right: auto;">
              La interacción por voz y texto con personajes guiados por Inteligencia Artificial estará disponible en la siguiente etapa del ecosistema.
            </p>
            <div>
              <a href="/paginas/simulaciones.html" class="btn btn--primario">Volver al catálogo</a>
            </div>
          </section>
        </div>
      `;
      return;
    }

    // Preparar escenario (banco aleatorio de 4 si existe, o escenas fijas)
    prepararEscenario();
    puntajeMaximo = calcularPuntajeMaximo(simulacion);
    puntosAcumulados = 0;
    recorrido = [];

    const idInicio = simulacion.escenaInicial || (simulacion.escenas && simulacion.escenas[0]?.id);
    cargarEscena(idInicio);
  } catch (err) {
    console.error('Error al cargar simulador:', err);
    contenido.innerHTML = `
      <div class="alerta alerta--error" role="alert">
        <p>No se pudo cargar la simulación solicitada.</p>
        <div style="margin-top: var(--espacio-m);">
          <a href="/paginas/simulaciones.html" class="btn btn--secundario">Volver a simulaciones</a>
        </div>
      </div>
    `;
  }
}

function renderCabecera() {
  const metaVistaPrevia = esVistaPrevia
    ? `<span class="chip" style="background-color: var(--advertencia-fondo); color: var(--advertencia); border-color: var(--advertencia); font-weight: var(--peso-seminegrita);">Vista previa</span>`
    : '';

  const bannerVistaPrevia = esVistaPrevia
    ? `
      <div class="alerta alerta--info" style="margin-bottom: var(--espacio-m);" role="status">
        <strong>Modo Vista Previa:</strong> Estás explorando la simulación sin registrar intentos ni alterar tu puntaje.
      </div>
    `
    : '';

  return `
    ${bannerVistaPrevia}
    <header class="simulador-cabecera">
      <div class="simulador-cabecera__info">
        <h1 class="simulador-cabecera__titulo">${escapar(simulacion.titulo || 'Simulación')}</h1>
        <div class="simulador-cabecera__metas">
          <span class="chip">Escenarios</span>
          ${metaVistaPrevia}
        </div>
      </div>
      <div class="simulador-marcador" aria-label="Puntaje actual acumulado">
        <span>Puntos:</span>
        <span id="marcador-puntos" class="simulador-marcador__valor">${Math.max(0, puntosAcumulados)}</span>
      </div>
    </header>
  `;
}

function cargarEscena(escenaId) {
  const mapaEscenas = new Map((simulacion.escenas || []).map(e => [e.id, e]));
  const escena = mapaEscenas.get(escenaId);

  if (!escena) {
    contenido.innerHTML = `
      <div class="simulador-contenedor">
        ${renderCabecera()}
        <div class="alerta alerta--error" role="alert">
          <p>No se encontró la escena con identificador "${escapar(escenaId || '')}".</p>
          <div style="margin-top: var(--espacio-m);">
            <button type="button" id="btn-reintentar-inicio" class="btn btn--secundario">Reiniciar desde el inicio</button>
          </div>
        </div>
      </div>
    `;
    const btnReintentar = document.getElementById('btn-reintentar-inicio');
    if (btnReintentar) {
      btnReintentar.onclick = () => {
        puntosAcumulados = 0;
        recorrido = [];
        cargarEscena(simulacion.escenaInicial || simulacion.escenas[0]?.id);
      };
    }
    return;
  }

  const esFinal = !Array.isArray(escena.opciones) || escena.opciones.length === 0;

  if (esFinal) {
    mostrarFinal(escena);
  } else {
    mostrarEscenaIntermedia(escena);
  }
}

function mostrarEscenaIntermedia(escena) {
  const imagenHtml = escena.imagen
    ? `
      <div class="simulador-escena__imagen-wrap">
        <img src="${escapar(escena.imagen)}" alt="Imagen de la situación" class="simulador-escena__imagen">
      </div>
    `
    : '';

  const opcionesHtml = (escena.opciones || []).map((opc, idx) => `
    <button type="button" class="simulador-opcion-btn" data-indice="${idx}">
      ${escapar(opc.texto || '')}
    </button>
  `).join('');

  contenido.innerHTML = `
    <div class="simulador-contenedor">
      ${renderCabecera()}

      <article class="simulador-escena">
        ${imagenHtml}
        <div class="simulador-escena__texto">
          ${formatoBasico(escena.texto || '')}
        </div>

        <div class="simulador-opciones-bloque">
          <div class="simulador-opciones-titulo">¿Qué decisión tomas?</div>
          <div id="simulador-opciones" class="simulador-opciones">
            ${opcionesHtml}
          </div>
        </div>

        <div id="retro"></div>

        <div id="contenedor-continuar" class="simulador-paso-siguiente" style="display: none;">
          <button type="button" id="btn-continuar" class="btn btn--primario">
            Continuar →
          </button>
        </div>
      </article>
    </div>
  `;

  const contenedorOpciones = document.getElementById('simulador-opciones');
  const contenedorContinuar = document.getElementById('contenedor-continuar');
  const btnContinuar = document.getElementById('btn-continuar');
  const botonesOpciones = contenedorOpciones.querySelectorAll('.simulador-opcion-btn');

  botonesOpciones.forEach(boton => {
    boton.addEventListener('click', () => {
      const indice = parseInt(boton.getAttribute('data-indice'), 10);
      const opcionElegida = escena.opciones[indice];
      if (!opcionElegida) return;

      // Deshabilitar todos los botones de opciones para evitar múltiples clics
      botonesOpciones.forEach(b => {
        b.disabled = true;
      });
      boton.classList.add('simulador-opcion-btn--seleccionada');

      const pts = Number(opcionElegida.puntos) || 0;
      puntosAcumulados += pts;

      // Actualizar marcador visual
      const marcadorEl = document.getElementById('marcador-puntos');
      if (marcadorEl) {
        marcadorEl.textContent = Math.max(0, puntosAcumulados);
      }

      // Registrar paso en el recorrido
      recorrido.push({
        escenaId: escena.id,
        escenaTexto: escena.texto,
        decision: opcionElegida.texto,
        puntos: pts,
        consecuencia: opcionElegida.consecuencia || '',
        destino: opcionElegida.destino
      });

      // Mostrar retroalimentación
      mostrarRetro({
        correcto: pts > 0,
        explicacion: opcionElegida.consecuencia || (pts > 0 ? 'Decisión acertada.' : 'Decisión desfavorable.')
      });

      // Mostrar botón "Continuar"
      contenedorContinuar.style.display = 'flex';
      btnContinuar.onclick = () => {
        cargarEscena(opcionElegida.destino);
      };
      btnContinuar.focus();
    });
  });
}

async function mostrarFinal(escenaFinal) {
  const puntajeFinal = Math.max(0, puntosAcumulados);

  const imagenHtml = escenaFinal.imagen
    ? `
      <div class="simulador-escena__imagen-wrap">
        <img src="${escapar(escenaFinal.imagen)}" alt="Imagen final" class="simulador-escena__imagen">
      </div>
    `
    : '';

  const recorridoHtml = recorrido.map((paso, idx) => {
    const clasePuntos = paso.puntos > 0
      ? 'simulador-paso-card__puntos--positivo'
      : (paso.puntos < 0 ? 'simulador-paso-card__puntos--negativo' : '');
    const signo = paso.puntos > 0 ? '+' : '';

    return `
      <div class="simulador-paso-card">
        <div class="simulador-paso-card__cabecera">
          <span class="simulador-paso-card__num">Paso ${idx + 1}</span>
          <span class="simulador-paso-card__puntos ${clasePuntos}">${signo}${paso.puntos} pts</span>
        </div>
        <div class="simulador-paso-card__decision">
          ${escapar(paso.decision)}
        </div>
        ${paso.consecuencia ? `<p class="simulador-paso-card__consecuencia">${escapar(paso.consecuencia)}</p>` : ''}
      </div>
    `;
  }).join('');

  contenido.innerHTML = `
    <div class="simulador-contenedor">
      ${renderCabecera()}

      <article class="simulador-informe">
        ${imagenHtml}

        <div class="simulador-escena__texto">
          ${formatoBasico(escenaFinal.texto || '')}
        </div>

        <section class="simulador-informe__resumen" aria-label="Resultado final">
          <div class="simulador-informe__puntaje-grande">
            ${puntajeFinal} / ${puntajeMaximo}
          </div>
          <p class="simulador-informe__subtitulo">
            Puntos obtenidos frente al camino óptimo del caso
          </p>
        </section>

        <section aria-labelledby="titulo-recorrido">
          <h2 id="titulo-recorrido" class="simulador-recorrido-titulo">Informe de decisiones tomadas</h2>
          <div class="simulador-recorrido-lista">
            ${recorridoHtml || '<p style="color: var(--texto-suave);">No se registraron decisiones intermedias.</p>'}
          </div>
        </section>

        <footer class="simulador-acciones-finales">
          <button type="button" id="btn-repetir" class="btn btn--primario">
            🔄 Repetir simulación
          </button>
          <a href="/paginas/simulaciones.html" class="btn btn--secundario">
            Volver a simulaciones
          </a>
        </footer>
      </article>
    </div>
  `;

  const btnRepetir = document.getElementById('btn-repetir');
  if (btnRepetir) {
    btnRepetir.addEventListener('click', () => {
      puntosAcumulados = 0;
      recorrido = [];
      prepararEscenario();
      puntajeMaximo = calcularPuntajeMaximo(simulacion);
      cargarEscena(simulacion.escenaInicial || simulacion.escenas[0]?.id);
    });
  }

  // Registrar intento solo si no es vista previa
  if (!esVistaPrevia) {
    try {
      await registrarIntento({
        actividad: "simulacion",
        temaId: simulacion.temaId,
        puntaje: puntajeFinal,
        maximo: puntajeMaximo,
        detalle: {
          simulacionId: simulacion.id,
          recorrido
        }
      });
    } catch (err) {
      console.error('Error al registrar intento de simulación:', err);
    }
  }
}

let historialRol = [];
let ocupadoRol = false;

function cabeceraRol(turnos, maxTurnos) {
  return `${esVistaPrevia ? '<div class="alerta alerta--info"><strong>Vista previa:</strong> no se registrarán puntos.</div>' : ''}
    <header class="simulador-cabecera"><div><h1 class="simulador-cabecera__titulo">${escapar(simulacion.titulo)}</h1><span class="chip">Rol con IA</span></div>
    <div class="simulador-marcador"><span>Turnos:</span><span id="rol-contador" class="simulador-marcador__valor">${turnos}/${maxTurnos}</span></div></header>`;
}

function iniciarSimuladorRol() {
  const personaje = simulacion.personaje || {};
  const maxTurnos = Math.max(4, Math.min(12, Number(simulacion.maxTurnos) || 8));
  historialRol = [];
  ocupadoRol = false;
  montarAvatar();
  contenido.innerHTML = `<div class="simulador-contenedor rol-simulacion">${cabeceraRol(0, maxTurnos)}
    <section class="tarjeta rol-caso"><h2>${escapar(personaje.nombre || 'Personaje')}</h2><p>${escapar(personaje.descripcion || '')}</p>
      <h3>Contexto</h3><p>${escapar(personaje.contexto || '')}</p><h3>Tu objetivo</h3><p>${escapar(personaje.objetivo || '')}</p></section>
    <section class="tarjeta rol-chat"><div id="rol-historial" class="rol-chat__historial" aria-live="polite"></div>
      <p id="rol-pensando" class="campo__ayuda" hidden>El personaje está pensando…</p>
      <form id="rol-form" class="rol-chat__form"><label for="rol-mensaje" class="sr-solo">Tu mensaje</label>
        <textarea id="rol-mensaje" rows="3" maxlength="1000" required placeholder="Escribe lo que le dirías al personaje…"></textarea>
        <div class="rol-chat__acciones"><button type="button" id="rol-terminar" class="btn btn--secundario">Terminar</button><button type="submit" id="rol-enviar" class="btn btn--primario">Enviar</button></div>
      </form></section></div>`;
  renderizarHistorialRol();
  document.getElementById('rol-form').addEventListener('submit', evento => { evento.preventDefault(); enviarMensajeRol(maxTurnos); });
  document.getElementById('rol-terminar').addEventListener('click', finalizarRol);
  document.getElementById('rol-mensaje').focus();
}

function renderizarHistorialRol() {
  const panel = document.getElementById('rol-historial');
  const nombre = simulacion.personaje?.nombre || 'Personaje';
  panel.innerHTML = historialRol.length ? historialRol.map(item => `<div class="rol-mensaje rol-mensaje--${item.rol}"><strong>${item.rol === 'estudiante' ? 'Tú' : escapar(nombre)}:</strong> ${escapar(item.texto)}</div>`).join('')
    : `<div class="rol-mensaje rol-mensaje--personaje"><strong>${escapar(nombre)}:</strong> Puedes comenzar cuando estés listo.</div>`;
  panel.scrollTop = panel.scrollHeight;
}

function bloquearRol(activo) {
  ocupadoRol = activo;
  document.getElementById('rol-pensando').hidden = !activo;
  document.getElementById('rol-mensaje').disabled = activo;
  document.getElementById('rol-enviar').disabled = activo;
  document.getElementById('rol-terminar').disabled = activo;
  cambiarEstado(activo ? 'pensando' : 'reposo');
}

async function enviarMensajeRol(maxTurnos) {
  const campo = document.getElementById('rol-mensaje');
  const texto = campo.value.trim();
  if (!texto || ocupadoRol) return;
  historialRol.push({ rol: 'estudiante', texto });
  campo.value = '';
  renderizarHistorialRol();
  const turnos = historialRol.filter(item => item.rol === 'estudiante').length;
  document.getElementById('rol-contador').textContent = `${turnos}/${maxTurnos}`;
  bloquearRol(true);
  try {
    const resultado = await api.ia('rol-simulacion', { simulacionId, historial: historialRol });
    const respuesta = typeof resultado === 'string' ? resultado : resultado?.respuesta;
    historialRol.push({ rol: 'personaje', texto: respuesta || 'No puedo responder en este momento.' });
    cambiarEstado('hablando');
    decir(respuesta);
    renderizarHistorialRol();
  } catch (error) {
    aviso(error.message || 'No se pudo obtener la respuesta del personaje.', 'error');
  } finally {
    bloquearRol(false);
  }
  if (turnos >= maxTurnos) await finalizarRol(); else campo.focus();
}

async function finalizarRol() {
  if (ocupadoRol) return;
  if (!historialRol.some(item => item.rol === 'estudiante')) return aviso('Escribe al menos un mensaje antes de terminar.', 'info');
  ocupadoRol = true;
  cambiarEstado('pensando');
  contenido.querySelectorAll('button, textarea').forEach(elemento => { elemento.disabled = true; });
  try {
    const informe = await api.ia('evaluar-rol', { simulacionId, historial: historialRol });
    mostrarInformeRol(informe);
    if (!esVistaPrevia) await registrarIntento({ actividad: 'simulacion', temaId: simulacion.temaId, puntaje: Number(informe.puntaje) || 0, maximo: Number(informe.maximo) || 0, errores: 0, detalle: { simulacionId: simulacion.id, modo: 'rol' } });
  } catch (error) {
    ocupadoRol = false;
    cambiarEstado('reposo');
    contenido.querySelectorAll('button, textarea').forEach(elemento => { elemento.disabled = false; });
    aviso(error.message || 'No se pudo evaluar la práctica.', 'error');
  }
}

function mostrarInformeRol(informe) {
  cambiarEstado('reposo');
  const criterios = Array.isArray(informe.criterios) ? informe.criterios : [];
  contenido.innerHTML = `<div class="simulador-contenedor">${cabeceraRol(historialRol.filter(item => item.rol === 'estudiante').length, simulacion.maxTurnos)}
    <article class="tarjeta rol-informe"><h2>Informe de la práctica</h2><p class="simulador-informe__puntaje-grande">${Number(informe.puntaje) || 0} / ${Number(informe.maximo) || 0}</p>
    <div class="rol-informe__criterios">${criterios.map(item => `<section><h3>${escapar(item.criterio)} · ${Number(item.puntos) || 0} puntos</h3><p>${escapar(item.comentario)}</p></section>`).join('')}</div>
    <div class="alerta alerta--info"><strong>Comentario general:</strong> ${escapar(informe.comentarioGeneral || '')}</div>
    <div class="simulador-acciones-finales"><button id="rol-repetir" class="btn btn--primario">Repetir práctica</button><a href="/paginas/simulaciones.html" class="btn btn--secundario">Volver</a></div></article></div>`;
  document.getElementById('rol-repetir').addEventListener('click', iniciarSimuladorRol);
}

iniciarSimulador();
