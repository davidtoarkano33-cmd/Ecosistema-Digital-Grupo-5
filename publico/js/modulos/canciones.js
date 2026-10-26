// publico/js/modulos/canciones.js · Reproductor didáctico con letra sincronizada LRC
import { montarPlantilla } from '../nucleo/plantilla.js';
import { listar } from '../nucleo/api.js';
import { usuarioActual } from '../nucleo/sesion.js';
import { parametro } from '../nucleo/util.js';
import { escapar } from '../nucleo/ui.js';

let estado = {
  canciones: [],
  temasMap: new Map(),
  asignaturasMap: new Map(),
  temaAsignaturaMap: new Map(),
  filtroAsignatura: '',
  filtroTema: '',
  cancionActual: null,
  lineasLRC: [],
  indiceLRCActivo: -1,
  reproduciendo: false
};

const audioElement = document.createElement('audio');

async function iniciar() {
  await montarPlantilla({ titulo: "Canciones", roles: ["sesion"] });

  const usuario = usuarioActual();
  if (usuario && (usuario.rol === 'docente' || usuario.rol === 'admin')) {
    const btnNueva = document.getElementById('acciones-docente');
    if (btnNueva) btnNueva.style.display = 'block';
  }

  // Leer parámetro temaId si viene en la URL (?temaId=...)
  const temaIdParam = parametro('temaId');
  if (temaIdParam) {
    estado.filtroTema = temaIdParam;
  }

  configurarControlesAudio();
  configurarEventosFiltros();
  await cargarDatos();
}

async function cargarDatos() {
  const cargando = document.getElementById('cargando-canciones');
  const sinCanciones = document.getElementById('sin-canciones');
  const layout = document.getElementById('layout-canciones');

  try {
    const [asignaturas, unidades, temas, canciones] = await Promise.all([
      listar('asignaturas'),
      listar('unidades'),
      listar('temas'),
      listar('canciones')
    ]);

    // Mapeos
    (asignaturas || []).forEach(a => estado.asignaturasMap.set(a.id, a.nombre));
    const unidadAsig = new Map((unidades || []).map(u => [u.id, u.asignaturaId]));
    (temas || []).forEach(t => {
      estado.temasMap.set(t.id, t.titulo);
      if (t.unidadId && unidadAsig.has(t.unidadId)) {
        estado.temaAsignaturaMap.set(t.id, unidadAsig.get(t.unidadId));
      }
    });

    // Poblar selectores de filtros
    poblarFiltros(asignaturas || [], temas || []);

    estado.canciones = canciones || [];

    cargando.style.display = 'none';

    renderizarLista();
  } catch (err) {
    console.error('Error al cargar canciones:', err);
    cargando.style.display = 'none';
    sinCanciones.style.display = 'flex';
    sinCanciones.innerHTML = `
      <div class="vacio__icono">⚠️</div>
      <h2 class="vacio__titulo">Error al cargar repertorio</h2>
      <p class="vacio__texto">${escapar(err.message)}</p>
    `;
  }
}

function poblarFiltros(asignaturas, temas) {
  const selAsig = document.getElementById('filtro-asignatura');
  const selTema = document.getElementById('filtro-tema');

  asignaturas.forEach(a => {
    const opt = document.createElement('option');
    opt.value = a.id;
    opt.textContent = a.nombre;
    selAsig.appendChild(opt);
  });

  // Si había temaId en URL, seleccionar su asignatura si corresponde
  if (estado.filtroTema && estado.temaAsignaturaMap.has(estado.filtroTema)) {
    estado.filtroAsignatura = estado.temaAsignaturaMap.get(estado.filtroTema);
    selAsig.value = estado.filtroAsignatura;
  }

  actualizarOpcionesTemas(temas);

  if (estado.filtroTema) {
    selTema.value = estado.filtroTema;
  }
}

function actualizarOpcionesTemas(temas) {
  const selTema = document.getElementById('filtro-tema');
  selTema.innerHTML = '<option value="">Todos los temas</option>';

  const listaTemas = temas || Array.from(estado.temasMap.entries()).map(([id, titulo]) => ({ id, titulo }));

  listaTemas.forEach(t => {
    if (!estado.filtroAsignatura || estado.temaAsignaturaMap.get(t.id) === estado.filtroAsignatura) {
      const opt = document.createElement('option');
      opt.value = t.id;
      opt.textContent = t.titulo;
      selTema.appendChild(opt);
    }
  });
}

function configurarEventosFiltros() {
  const selAsig = document.getElementById('filtro-asignatura');
  const selTema = document.getElementById('filtro-tema');

  selAsig.addEventListener('change', () => {
    estado.filtroAsignatura = selAsig.value;
    estado.filtroTema = '';
    actualizarOpcionesTemas();
    renderizarLista();
  });

  selTema.addEventListener('change', () => {
    estado.filtroTema = selTema.value;
    renderizarLista();
  });
}

function obtenerCancionesFiltradas() {
  return estado.canciones.filter(c => {
    if (estado.filtroTema && c.temaId !== estado.filtroTema) {
      return false;
    }
    if (estado.filtroAsignatura) {
      const asigId = estado.temaAsignaturaMap.get(c.temaId);
      if (asigId !== estado.filtroAsignatura) return false;
    }
    return true;
  });
}

function renderizarLista() {
  const filtradas = obtenerCancionesFiltradas();
  const sinCanciones = document.getElementById('sin-canciones');
  const layout = document.getElementById('layout-canciones');
  const listaEl = document.getElementById('lista-canciones');

  if (filtradas.length === 0) {
    layout.style.display = 'none';
    sinCanciones.style.display = 'flex';
    audioElement.pause();
    return;
  }

  sinCanciones.style.display = 'none';
  layout.style.display = 'grid';

  listaEl.innerHTML = filtradas.map((c, index) => {
    const esActiva = estado.cancionActual && estado.cancionActual.id === c.id;
    const temaTexto = estado.temasMap.get(c.temaId) || 'Sin tema';
    return `
      <li>
        <button type="button" class="cancion-item${esActiva ? ' cancion-item--activa' : ''}" data-id="${escapar(c.id)}" role="button">
          <span class="cancion-item__icono" aria-hidden="true">${esActiva && estado.reproduciendo ? '🔊' : '🎵'}</span>
          <div class="cancion-item__info">
            <p class="cancion-item__titulo">${escapar(c.titulo)}</p>
            <p class="cancion-item__tema">${escapar(temaTexto)}</p>
          </div>
        </button>
      </li>
    `;
  }).join('');

  // Eventos de selección de canción
  listaEl.querySelectorAll('.cancion-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const seleccionada = estado.canciones.find(c => c.id === id);
      if (seleccionada) {
        seleccionarCancion(seleccionada, true);
      }
    });
  });

  // Si no hay canción seleccionada o la seleccionada ya no está en la lista filtrada, elegir la primera
  if (!estado.cancionActual || !filtradas.some(c => c.id === estado.cancionActual.id)) {
    seleccionarCancion(filtradas[0], false);
  }
}

export function parsearLRC(lrcTexto) {
  if (!lrcTexto || typeof lrcTexto !== 'string') return [];
  const lineas = lrcTexto.split('\n');
  const resultado = [];
  const tagRegex = /\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g;

  lineas.forEach(linea => {
    const l = linea.trim();
    if (!l) return;

    // Buscar todas las marcas de tiempo en la línea
    const matches = Array.from(l.matchAll(tagRegex));
    if (matches.length > 0) {
      // Extraer el texto limpiando las etiquetas de tiempo
      const texto = l.replace(tagRegex, '').trim();
      if (texto) {
        matches.forEach(m => {
          const minutos = parseInt(m[1], 10);
          const segundos = parseInt(m[2], 10);
          const centesimasStr = m[3] || '0';
          const centesimas = parseFloat('0.' + centesimasStr);
          const tiempoSeg = minutos * 60 + segundos + centesimas;
          resultado.push({ tiempo: tiempoSeg, texto });
        });
      }
    }
  });

  return resultado.sort((a, b) => a.tiempo - b.tiempo);
}

function seleccionarCancion(cancion, reproducirInmediato = false) {
  estado.cancionActual = cancion;
  estado.lineasLRC = parsearLRC(cancion.lrc);
  estado.indiceLRCActivo = -1;

  // Actualizar metadatos en cabecera del reproductor
  document.getElementById('cancion-titulo-activo').textContent = cancion.titulo;
  const temaTitulo = estado.temasMap.get(cancion.temaId) || 'Tema';
  document.getElementById('cancion-tema-activo').textContent = `📚 ${temaTitulo}`;
  document.getElementById('cancion-autoria-activa').textContent = `Por ${cancion.autoria}`;
  document.getElementById('cancion-licencia-activa').textContent = `Licencia: ${cancion.licencia}`;

  // Botón de edición para docente / admin
  const usuario = usuarioActual();
  const wrapEdit = document.getElementById('enlace-editar-wrap');
  const btnEdit = document.getElementById('btn-editar-cancion-activa');
  if (usuario && (usuario.rol === 'docente' || usuario.rol === 'admin')) {
    btnEdit.href = `/paginas/editor-cancion.html?id=${encodeURIComponent(cancion.id)}`;
    wrapEdit.style.display = 'inline';
  } else {
    wrapEdit.style.display = 'none';
  }

  // Renderizar letra / karaoke
  const contKaraoke = document.getElementById('contenedor-karaoke');
  const badgeLRC = document.getElementById('badge-sincronizada');

  if (estado.lineasLRC.length > 0) {
    badgeLRC.style.display = 'inline-block';
    contKaraoke.innerHTML = estado.lineasLRC.map((linea, idx) => {
      return `<div class="linea-karaoke" id="karaoke-linea-${idx}" data-tiempo="${linea.tiempo}">${escapar(linea.texto)}</div>`;
    }).join('');

    // Permitir clic en una línea para saltar a ese segundo
    contKaraoke.querySelectorAll('.linea-karaoke').forEach((el, idx) => {
      el.addEventListener('click', () => {
        const t = parseFloat(el.getAttribute('data-tiempo'));
        if (!isNaN(t)) {
          audioElement.currentTime = t;
          if (!estado.reproduciendo) {
            audioElement.play();
          }
        }
      });
    });
  } else {
    badgeLRC.style.display = 'none';
    contKaraoke.innerHTML = `<div class="letra-plana">${escapar(cancion.letra || '')}</div>`;
  }

  // Asignar audio
  audioElement.src = cancion.audio;
  audioElement.currentTime = 0;
  actualizarBarraProgreso(0, 0);

  // Marcar como activo en la lista
  const listaEl = document.getElementById('lista-canciones');
  listaEl.querySelectorAll('.cancion-item').forEach(b => {
    const esActiva = b.getAttribute('data-id') === cancion.id;
    b.classList.toggle('cancion-item--activa', esActiva);
    const icono = b.querySelector('.cancion-item__icono');
    if (icono) icono.textContent = esActiva && estado.reproduciendo ? '🔊' : '🎵';
  });

  if (reproducirInmediato) {
    audioElement.play().catch(e => console.warn('Autoplay bloqueado:', e.message));
  }
}

function configurarControlesAudio() {
  const btnPlayPause = document.getElementById('btn-play-pause');
  const btnPrev = document.getElementById('btn-anterior');
  const btnNext = document.getElementById('btn-siguiente');
  const barraProgreso = document.getElementById('barra-progreso');
  const sliderVolumen = document.getElementById('slider-volumen');
  const btnSilenciar = document.getElementById('btn-silenciar');

  // Play / Pause
  btnPlayPause.addEventListener('click', alternarPlayPause);

  // Anterior / Siguiente
  btnPrev.addEventListener('click', cancionAnterior);
  btnNext.addEventListener('click', cancionSiguiente);

  // Eventos nativos de audio
  audioElement.addEventListener('play', () => {
    estado.reproduciendo = true;
    btnPlayPause.textContent = '⏸';
    btnPlayPause.setAttribute('aria-label', 'Pausar');
    actualizarIconosLista(true);
  });

  audioElement.addEventListener('pause', () => {
    estado.reproduciendo = false;
    btnPlayPause.textContent = '▶';
    btnPlayPause.setAttribute('aria-label', 'Reproducir');
    actualizarIconosLista(false);
  });

  audioElement.addEventListener('timeupdate', () => {
    const cur = audioElement.currentTime;
    const dur = audioElement.duration || 0;
    actualizarBarraProgreso(cur, dur);
    sincronizarKaraoke(cur);
  });

  audioElement.addEventListener('loadedmetadata', () => {
    const dur = audioElement.duration || 0;
    document.getElementById('tiempo-total').textContent = formatearTiempo(dur);
  });

  audioElement.addEventListener('ended', () => {
    cancionSiguiente();
  });

  // Operar barra de progreso con ratón
  barraProgreso.addEventListener('click', (e) => {
    if (!audioElement.duration) return;
    const rect = barraProgreso.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    audioElement.currentTime = Math.max(0, Math.min(pos * audioElement.duration, audioElement.duration));
  });

  // Accesibilidad: operar barra de progreso con teclado (flechas)
  barraProgreso.addEventListener('keydown', (e) => {
    if (!audioElement.duration) return;
    const paso = 5; // 5 segundos
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      audioElement.currentTime = Math.min(audioElement.currentTime + paso, audioElement.duration);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      audioElement.currentTime = Math.max(audioElement.currentTime - paso, 0);
    } else if (e.key === ' ') {
      e.preventDefault();
      alternarPlayPause();
    }
  });

  // Volumen
  sliderVolumen.addEventListener('input', () => {
    audioElement.volume = parseFloat(sliderVolumen.value);
    audioElement.muted = false;
    actualizarIconoVolumen();
  });

  btnSilenciar.addEventListener('click', () => {
    audioElement.muted = !audioElement.muted;
    actualizarIconoVolumen();
  });

  // Teclado global: Espacio para play/pause si el foco no está en entradas o áreas de texto
  document.addEventListener('keydown', (e) => {
    const tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

    if (e.code === 'Space') {
      e.preventDefault();
      alternarPlayPause();
    }
  });
}

function alternarPlayPause() {
  if (!estado.cancionActual) return;
  if (audioElement.paused) {
    audioElement.play().catch(e => console.warn('Error reproducción:', e.message));
  } else {
    audioElement.pause();
  }
}

function cancionAnterior() {
  const filtradas = obtenerCancionesFiltradas();
  if (filtradas.length <= 1) return;
  const idx = filtradas.findIndex(c => c.id === estado.cancionActual?.id);
  const prevIdx = (idx - 1 + filtradas.length) % filtradas.length;
  seleccionarCancion(filtradas[prevIdx], true);
}

function cancionSiguiente() {
  const filtradas = obtenerCancionesFiltradas();
  if (filtradas.length <= 1) return;
  const idx = filtradas.findIndex(c => c.id === estado.cancionActual?.id);
  const nextIdx = (idx + 1) % filtradas.length;
  seleccionarCancion(filtradas[nextIdx], true);
}

function actualizarBarraProgreso(actual, total) {
  const tActual = document.getElementById('tiempo-actual');
  const tTotal = document.getElementById('tiempo-total');
  const relleno = document.getElementById('progreso-barra-relleno');
  const barra = document.getElementById('barra-progreso');

  tActual.textContent = formatearTiempo(actual);
  if (total > 0) {
    tTotal.textContent = formatearTiempo(total);
    const pct = Math.min((actual / total) * 100, 100);
    relleno.style.width = `${pct}%`;
    barra.setAttribute('aria-valuenow', Math.round(pct));
  } else {
    relleno.style.width = '0%';
    barra.setAttribute('aria-valuenow', 0);
  }
}

function sincronizarKaraoke(tiempoActual) {
  if (estado.lineasLRC.length === 0) return;

  // Encontrar la línea activa
  let nuevoIndice = -1;
  for (let i = 0; i < estado.lineasLRC.length; i++) {
    if (tiempoActual >= estado.lineasLRC[i].tiempo) {
      nuevoIndice = i;
    } else {
      break;
    }
  }

  if (nuevoIndice !== estado.indiceLRCActivo) {
    if (estado.indiceLRCActivo >= 0) {
      const prevEl = document.getElementById(`karaoke-linea-${estado.indiceLRCActivo}`);
      if (prevEl) prevEl.classList.remove('linea-karaoke--activa');
    }

    if (nuevoIndice >= 0) {
      const nuevoEl = document.getElementById(`karaoke-linea-${nuevoIndice}`);
      if (nuevoEl) {
        nuevoEl.classList.add('linea-karaoke--activa');
        // Desplazamiento suave para centrar la línea activa en el visor
        nuevoEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }

    estado.indiceLRCActivo = nuevoIndice;
  }
}

function actualizarIconosLista(estaSonando) {
  const listaEl = document.getElementById('lista-canciones');
  listaEl.querySelectorAll('.cancion-item').forEach(b => {
    const esActiva = b.getAttribute('data-id') === estado.cancionActual?.id;
    const icono = b.querySelector('.cancion-item__icono');
    if (icono && esActiva) {
      icono.textContent = estaSonando ? '🔊' : '🎵';
    }
  });
}

function actualizarIconoVolumen() {
  const btn = document.getElementById('btn-silenciar');
  if (audioElement.muted || audioElement.volume === 0) {
    btn.textContent = '🔇';
  } else if (audioElement.volume < 0.5) {
    btn.textContent = '🔉';
  } else {
    btn.textContent = '🔊';
  }
}

function formatearTiempo(segundos) {
  if (isNaN(segundos) || segundos < 0) return '00:00';
  const mins = Math.floor(segundos / 60);
  const segs = Math.floor(segundos % 60);
  return `${String(mins).padStart(2, '0')}:${String(segs).padStart(2, '0')}`;
}

// Iniciar al cargar
iniciar();
