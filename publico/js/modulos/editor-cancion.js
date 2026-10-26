// publico/js/modulos/editor-cancion.js · Lógica para crear y editar canciones educativas
import { montarPlantilla } from '../nucleo/plantilla.js';
import { listar, obtener, crear, actualizar, subir } from '../nucleo/api.js';
import { parametro } from '../nucleo/util.js';
import { aviso } from '../nucleo/ui.js';

let cancionId = null;

async function iniciar() {
  await montarPlantilla({ titulo: "Editor de Canción", roles: ["docente", "admin"] });

  cancionId = parametro('id');

  await cargarTemas();
  configurarEventos();

  if (cancionId) {
    document.getElementById('titulo-pagina').textContent = "Editar Canción Educativa";
    document.title = "Editar Canción · Ecosistema Educativo";
    await cargarCancion(cancionId);
  }
}

async function cargarTemas() {
  const selTema = document.getElementById('temaId');
  try {
    const temas = await listar('temas');
    if (Array.isArray(temas)) {
      temas.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t.id;
        opt.textContent = t.titulo;
        selTema.appendChild(opt);
      });
    }
  } catch (err) {
    console.error('Error al cargar temas:', err);
    aviso('No se pudieron cargar los temas disponibles', 'error');
  }
}

function configurarEventos() {
  const selLicencia = document.getElementById('licencia');
  const campoOtra = document.getElementById('campo-otra-licencia');
  const inputOtra = document.getElementById('licencia-otra-desc');
  const fileInput = document.getElementById('subir-audio-input');
  const audioInput = document.getElementById('audio');
  const audioPreview = document.getElementById('audio-preview');
  const audioPreviewWrap = document.getElementById('audio-preview-wrap');
  const form = document.getElementById('form-cancion');

  // Alternar campo de descripción si la licencia es "Otra"
  selLicencia.addEventListener('change', () => {
    if (selLicencia.value === 'Otra') {
      campoOtra.style.display = 'block';
      inputOtra.setAttribute('required', 'required');
    } else {
      campoOtra.style.display = 'none';
      inputOtra.removeAttribute('required');
    }
  });

  // Vista previa cuando cambia la URL del audio
  audioInput.addEventListener('input', () => {
    actualizarPreviewAudio(audioInput.value.trim());
  });

  // Subir archivo MP3 mediante api.subir
  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    try {
      aviso('Subiendo audio...', 'info');
      const res = await subir(file);
      if (res && res.url) {
        audioInput.value = res.url;
        actualizarPreviewAudio(res.url);
        aviso('Audio subido exitosamente', 'exito');
      }
    } catch (err) {
      console.error('Error al subir audio:', err);
      aviso(`Error al subir audio: ${err.message}`, 'error');
    } finally {
      fileInput.value = '';
    }
  });

  // Contador y validador de líneas LRC en vivo
  const lrcInput = document.getElementById('lrc');
  lrcInput.addEventListener('input', () => {
    actualizarContadorLRC();
  });

  // Botón: Generar marcas LRC automáticas
  const btnAutoLrc = document.getElementById('btn-auto-lrc');
  btnAutoLrc.addEventListener('click', () => {
    generarMarcasLRCAutomaticas();
  });

  // Botón: Abrir asistente en vivo
  const btnAsistente = document.getElementById('btn-asistente-lrc');
  btnAsistente.addEventListener('click', () => {
    abrirAsistenteLRC();
  });

  configurarModalAsistente();

  // Guardar formulario
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    await guardar();
  });
}

function actualizarContadorLRC() {
  const lrcInput = document.getElementById('lrc');
  const badge = document.getElementById('lrc-contador-lineas');
  if (!lrcInput || !badge) return;

  const texto = lrcInput.value || '';
  const tagRegex = /\[\d{1,2}:\d{2}(?:[.:]\d{1,3})?\]/g;
  const matches = texto.match(tagRegex) || [];
  const cantidad = matches.length;

  if (cantidad > 0) {
    badge.textContent = `✓ ${cantidad} marcas LRC`;
    badge.className = 'insignia insignia--exito';
  } else if (texto.trim().length > 0) {
    badge.textContent = '⚠️ Sin marcas [mm:ss.xx]';
    badge.className = 'insignia insignia--advertencia';
  } else {
    badge.textContent = '0 marcas LRC';
    badge.className = 'insignia insignia--secundario';
  }
}

function generarMarcasLRCAutomaticas() {
  const letra = document.getElementById('letra').value.trim();
  const audioPreview = document.getElementById('audio-preview');
  const audioUrl = document.getElementById('audio').value.trim();

  if (!letra) {
    aviso('Primero escribe o pega la letra de la canción', 'advertencia');
    document.getElementById('letra').focus();
    return;
  }

  // Filtrar líneas no vacías
  const lineas = letra.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  if (lineas.length === 0) {
    aviso('No hay líneas válidas en la letra', 'advertencia');
    return;
  }

  // Duración estimada o del audio
  let duracion = audioPreview && !isNaN(audioPreview.duration) && audioPreview.duration > 10
    ? audioPreview.duration
    : 217; // Valor típico si el audio aún no cargó metadatos

  const intro = 8.0;
  const tiempoUtil = Math.max(duracion - intro - 5, lineas.length * 2);
  const intervalo = tiempoUtil / lineas.length;

  const lrcLineas = lineas.map((linea, idx) => {
    const tiempo = intro + (idx * intervalo);
    const mins = Math.floor(tiempo / 60);
    const segs = Math.floor(tiempo % 60);
    const cent = Math.floor((tiempo % 1) * 100);
    const tag = `[${String(mins).padStart(2, '0')}:${String(segs).padStart(2, '0')}.${String(cent).padStart(2, '0')}]`;
    return `${tag} ${linea}`;
  });

  const resultado = lrcLineas.join('\n');
  document.getElementById('lrc').value = resultado;
  actualizarContadorLRC();
  aviso(`¡${lineas.length} marcas generadas automáticamente! Puedes ajustarlas si lo deseas.`, 'exito');
}

// Variables del Asistente en vivo
let asistenteEstado = {
  lineas: [],
  indiceActual: 0,
  marcas: [],
  audio: null
};

function configurarModalAsistente() {
  const modal = document.getElementById('modal-asistente-lrc');
  const btnCerrar = document.getElementById('btn-cerrar-asistente');
  const btnPlay = document.getElementById('btn-modal-play');
  const btnMarcar = document.getElementById('btn-marcar-verso');
  const btnRetroceder = document.getElementById('btn-retroceder-verso');
  const btnReiniciar = document.getElementById('btn-reiniciar-asistente');
  const btnAplicar = document.getElementById('btn-aplicar-lrc');

  asistenteEstado.audio = new Audio();

  btnCerrar.addEventListener('click', cerrarAsistenteLRC);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) cerrarAsistenteLRC();
  });

  btnPlay.addEventListener('click', () => {
    if (!asistenteEstado.audio.src) return;
    if (asistenteEstado.audio.paused) {
      asistenteEstado.audio.play();
      btnPlay.textContent = '⏸ Pausar';
    } else {
      asistenteEstado.audio.pause();
      btnPlay.textContent = '▶ Reproducir';
    }
  });

  asistenteEstado.audio.addEventListener('timeupdate', () => {
    const t = asistenteEstado.audio.currentTime;
    const mins = Math.floor(t / 60);
    const segs = Math.floor(t % 60);
    const cent = Math.floor((t % 1) * 100);
    const reloj = document.getElementById('modal-tiempo-actual');
    if (reloj) {
      reloj.textContent = `${String(mins).padStart(2, '0')}:${String(segs).padStart(2, '0')}.${String(cent).padStart(2, '0')}`;
    }
  });

  asistenteEstado.audio.addEventListener('ended', () => {
    btnPlay.textContent = '▶ Reproducir';
  });

  btnMarcar.addEventListener('click', marcarLineaActual);
  btnRetroceder.addEventListener('click', retrocederLinea);
  btnReiniciar.addEventListener('click', reiniciarAsistente);

  btnAplicar.addEventListener('click', () => {
    if (asistenteEstado.marcas.length === 0) {
      aviso('No has marcado ninguna línea aún', 'advertencia');
      return;
    }
    const resultado = asistenteEstado.marcas.map(m => `${m.tag} ${m.texto}`).join('\n');
    document.getElementById('lrc').value = resultado;
    actualizarContadorLRC();
    cerrarAsistenteLRC();
    aviso(`Se aplicaron ${asistenteEstado.marcas.length} líneas sincronizadas`, 'exito');
  });

  // Atajo de teclado: Barra espaciadora para marcar cuando el modal esté abierto
  document.addEventListener('keydown', (e) => {
    if (modal.style.display !== 'flex') return;
    if (e.code === 'Space') {
      e.preventDefault();
      marcarLineaActual();
    }
  });
}

function abrirAsistenteLRC() {
  const audioUrl = document.getElementById('audio').value.trim();
  const letra = document.getElementById('letra').value.trim();

  if (!audioUrl) {
    aviso('Primero debes ingresar o subir un audio MP3', 'advertencia');
    document.getElementById('audio').focus();
    return;
  }

  if (!letra) {
    aviso('Primero escribe o pega la letra de la canción', 'advertencia');
    document.getElementById('letra').focus();
    return;
  }

  const lineas = letra.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  if (lineas.length === 0) {
    aviso('No se encontraron versos en la letra', 'advertencia');
    return;
  }

  asistenteEstado.lineas = lineas;
  asistenteEstado.indiceActual = 0;
  asistenteEstado.marcas = [];
  asistenteEstado.audio.src = audioUrl;
  asistenteEstado.audio.currentTime = 0;

  document.getElementById('modal-asistente-lrc').style.display = 'flex';
  document.getElementById('btn-modal-play').textContent = '▶ Reproducir';

  actualizarVisorAsistente();
}

function cerrarAsistenteLRC() {
  const modal = document.getElementById('modal-asistente-lrc');
  if (asistenteEstado.audio) {
    asistenteEstado.audio.pause();
  }
  modal.style.display = 'none';
}

function marcarLineaActual() {
  if (asistenteEstado.indiceActual >= asistenteEstado.lineas.length) {
    aviso('¡Has completado todas las líneas! Haz clic en "Aplicar al editor".', 'info');
    return;
  }

  const t = asistenteEstado.audio.currentTime;
  const mins = Math.floor(t / 60);
  const segs = Math.floor(t % 60);
  const cent = Math.floor((t % 1) * 100);
  const tag = `[${String(mins).padStart(2, '0')}:${String(segs).padStart(2, '0')}.${String(cent).padStart(2, '0')}]`;

  const texto = asistenteEstado.lineas[asistenteEstado.indiceActual];
  asistenteEstado.marcas.push({ tag, texto, tiempo: t });
  asistenteEstado.indiceActual++;

  actualizarVisorAsistente();

  if (asistenteEstado.indiceActual >= asistenteEstado.lineas.length) {
    aviso('¡Canción sincronizada al 100%! Haz clic en "Aplicar al editor".', 'exito');
  }
}

function retrocederLinea() {
  if (asistenteEstado.indiceActual > 0) {
    asistenteEstado.indiceActual--;
    asistenteEstado.marcas.pop();
    actualizarVisorAsistente();
  }
}

function reiniciarAsistente() {
  asistenteEstado.indiceActual = 0;
  asistenteEstado.marcas = [];
  if (asistenteEstado.audio) {
    asistenteEstado.audio.currentTime = 0;
  }
  actualizarVisorAsistente();
}

function actualizarVisorAsistente() {
  const actualEl = document.getElementById('modal-verso-actual');
  const sigEl = document.getElementById('modal-verso-siguiente');
  const progEl = document.getElementById('modal-progreso-lineas');

  const total = asistenteEstado.lineas.length;
  const actual = asistenteEstado.indiceActual;

  progEl.textContent = `Línea ${Math.min(actual + 1, total)} de ${total}`;

  if (actual < total) {
    actualEl.textContent = asistenteEstado.lineas[actual];
    sigEl.textContent = (actual + 1 < total) ? asistenteEstado.lineas[actual + 1] : '(Fin de la letra)';
  } else {
    actualEl.textContent = '🎉 ¡Todas las líneas han sido sincronizadas!';
    sigEl.textContent = 'Haz clic en "Aplicar al editor" para guardar';
  }
}

function actualizarPreviewAudio(url) {
  const audioPreview = document.getElementById('audio-preview');
  const audioPreviewWrap = document.getElementById('audio-preview-wrap');

  if (url) {
    audioPreview.src = url;
    audioPreviewWrap.style.display = 'block';
  } else {
    audioPreview.removeAttribute('src');
    audioPreviewWrap.style.display = 'none';
  }
}

async function cargarCancion(id) {
  try {
    const c = await obtener('canciones', id);
    if (!c) {
      aviso('No se encontró la canción', 'error');
      return;
    }

    document.getElementById('titulo').value = c.titulo || '';
    document.getElementById('temaId').value = c.temaId || '';
    document.getElementById('audio').value = c.audio || '';
    document.getElementById('autoria').value = c.autoria || '';
    document.getElementById('letra').value = c.letra || '';
    document.getElementById('lrc').value = c.lrc || '';

    // Licencia
    const selLicencia = document.getElementById('licencia');
    const campoOtra = document.getElementById('campo-otra-licencia');
    const inputOtra = document.getElementById('licencia-otra-desc');

    if (c.licencia && (c.licencia === 'Propia' || c.licencia === 'CC BY' || c.licencia === 'CC BY-SA')) {
      selLicencia.value = c.licencia;
      campoOtra.style.display = 'none';
      inputOtra.removeAttribute('required');
    } else if (c.licencia) {
      selLicencia.value = 'Otra';
      campoOtra.style.display = 'block';
      inputOtra.value = c.licencia.replace(/^Otra:\s*/, '');
      inputOtra.setAttribute('required', 'required');
    }

    actualizarPreviewAudio(c.audio || '');
    actualizarContadorLRC();
  } catch (err) {
    console.error('Error al cargar la canción:', err);
    aviso(`Error al cargar datos: ${err.message}`, 'error');
  }
}

async function guardar() {
  const titulo = document.getElementById('titulo').value.trim();
  const temaId = document.getElementById('temaId').value;
  const audio = document.getElementById('audio').value.trim();
  const autoria = document.getElementById('autoria').value.trim();
  const selLicencia = document.getElementById('licencia').value;
  const inputOtra = document.getElementById('licencia-otra-desc').value.trim();
  const letra = document.getElementById('letra').value.trim();
  const lrc = document.getElementById('lrc').value.trim();

  if (!titulo) {
    aviso('El título es obligatorio', 'advertencia');
    document.getElementById('titulo').focus();
    return;
  }

  if (!temaId) {
    aviso('Debes seleccionar un tema relacionado', 'advertencia');
    document.getElementById('temaId').focus();
    return;
  }

  if (!audio) {
    aviso('El archivo de audio es obligatorio', 'advertencia');
    document.getElementById('audio').focus();
    return;
  }

  if (!autoria) {
    aviso('La autoría es obligatoria', 'advertencia');
    document.getElementById('autoria').focus();
    return;
  }

  let licenciaFinal = selLicencia;
  if (selLicencia === 'Otra') {
    if (!inputOtra) {
      aviso('Por favor describe la licencia', 'advertencia');
      document.getElementById('licencia-otra-desc').focus();
      return;
    }
    licenciaFinal = `Otra: ${inputOtra}`;
  }

  if (!letra) {
    aviso('La letra de la canción es obligatoria', 'advertencia');
    document.getElementById('letra').focus();
    return;
  }

  const payload = {
    titulo,
    temaId,
    audio,
    autoria,
    licencia: licenciaFinal,
    letra,
    lrc: lrc || null
  };

  const btnGuardar = document.getElementById('btn-guardar');
  btnGuardar.disabled = true;
  btnGuardar.textContent = 'Guardando...';

  try {
    if (cancionId) {
      await actualizar('canciones', cancionId, payload);
      sessionStorage.setItem('aviso_pendiente', JSON.stringify({
        texto: 'Canción actualizada correctamente',
        tipo: 'exito'
      }));
    } else {
      await crear('canciones', payload);
      sessionStorage.setItem('aviso_pendiente', JSON.stringify({
        texto: 'Canción creada correctamente',
        tipo: 'exito'
      }));
    }
    window.location.href = `/paginas/canciones.html?temaId=${encodeURIComponent(temaId)}`;
  } catch (err) {
    console.error('Error al guardar canción:', err);
    aviso(`Error: ${err.message}`, 'error');
    btnGuardar.disabled = false;
    btnGuardar.textContent = 'Guardar canción';
  }
}

// Iniciar al cargar
iniciar();
