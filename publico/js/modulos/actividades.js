// publico/js/modulos/actividades.js · Catálogo de actividades lúdicas y evaluativas
import { montarPlantilla } from '../nucleo/plantilla.js';
import { ACTIVIDADES } from '../nucleo/catalogo-actividades.js';
import { escapar } from '../nucleo/ui.js';

await montarPlantilla({ titulo: "Actividades", roles: ["estudiante", "docente"] });

const contenido = document.getElementById('contenido');

function obtenerIconoActividad(id) {
  switch (id) {
    case 'ahorcado': return '🎈';
    case 'pareja': return '🃏';
    case 'sopa-letras': return '🔍';
    case 'crucigrama': return '✏️';
    case 'quiz': return '❓';
    case 'canciones': return '🎵';
    case 'simulacion': return '🎭';
    default: return '🎮';
  }
}

function renderizarActividades() {
  if (!contenido) return;

  const tarjetasHtml = ACTIVIDADES.map(act => {
    const icono = obtenerIconoActividad(act.id);
    return `
      <article class="tarjeta actividad-tarjeta">
        <div class="actividad-tarjeta__cabecera">
          <span class="actividad-tarjeta__icono" aria-hidden="true">${icono}</span>
          <h2 class="actividad-tarjeta__titulo">${escapar(act.texto)}</h2>
        </div>
        <p class="actividad-tarjeta__descripcion">${escapar(act.descripcion || '')}</p>
        <div class="actividad-tarjeta__accion">
          <a href="${escapar(act.href)}" class="btn btn--primario">
            Jugar
          </a>
        </div>
      </article>
    `;
  }).join('');

  contenido.innerHTML = `
    <header class="actividades-encabezado">
      <h1 class="actividades-encabezado__titulo">Actividades Formativas</h1>
      <p class="actividades-encabezado__subtitulo">
        Refuerza tus conocimientos y acumula puntos jugando con los contenidos de tus asignaturas.
      </p>
    </header>

    <div class="actividades-grid" role="list">
      ${tarjetasHtml}
    </div>
  `;
}

renderizarActividades();
