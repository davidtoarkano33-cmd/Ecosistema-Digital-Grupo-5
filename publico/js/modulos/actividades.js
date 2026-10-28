// publico/js/modulos/actividades.js · Catálogo de actividades lúdicas y evaluativas
import { montarPlantilla } from '../nucleo/plantilla.js';
import { ACTIVIDADES } from '../nucleo/catalogo-actividades.js';
import { escapar } from '../nucleo/ui.js';
import { usuarioActual } from '../nucleo/sesion.js';

await montarPlantilla({ titulo: "Actividades", roles: ["estudiante", "docente"] });

const contenido = document.getElementById('contenido');
const esDocente = usuarioActual()?.rol === 'docente';

function gestionDeActividad(id) {
  if (id === 'quiz') {
    return { texto: 'Editar preguntas', href: '/paginas/banco-preguntas.html' };
  }
  if (id === 'canciones') {
    return { texto: 'Gestionar canciones', href: '/paginas/canciones.html' };
  }
  if (id === 'simulador') {
    return { texto: 'Gestionar casos', href: '/paginas/simulaciones.html' };
  }
  return { texto: 'Editar glosarios', href: '/paginas/editor-contenidos.html' };
}

function obtenerIconoActividad(id) {
  switch (id) {
    case 'ahorcado': return '🎈';
    case 'pareja': return '🃏';
    case 'sopa-letras': return '🔍';
    case 'crucigrama': return '✏️';
    case 'quiz': return '❓';
    case 'canciones': return '🎵';
    case 'simulacion':
    case 'simulador': return '🎭';
    default: return '🎮';
  }
}

function renderizarActividades() {
  if (!contenido) return;

  const tarjetasHtml = ACTIVIDADES.map(act => {
    const icono = obtenerIconoActividad(act.id);
    const gestion = gestionDeActividad(act.id);
    return `
      <article class="tarjeta actividad-tarjeta">
        <div class="actividad-tarjeta__cabecera">
          <span class="actividad-tarjeta__icono" aria-hidden="true">${icono}</span>
          <h2 class="actividad-tarjeta__titulo">${escapar(act.texto)}</h2>
        </div>
        <p class="actividad-tarjeta__descripcion">${escapar(act.descripcion || '')}</p>
        <div class="actividad-tarjeta__accion">
          <a href="${escapar(act.href)}" class="btn btn--primario">
            ${esDocente ? 'Probar actividad' : 'Jugar'}
          </a>
          ${esDocente ? `<a href="${escapar(gestion.href)}" class="btn btn--secundario">${escapar(gestion.texto)}</a>` : ''}
        </div>
      </article>
    `;
  }).join('');

  contenido.innerHTML = `
    <header class="actividades-encabezado">
      <h1 class="actividades-encabezado__titulo">Actividades Formativas</h1>
      <p class="actividades-encabezado__subtitulo">
        ${esDocente
          ? 'Prueba las actividades y gestiona el contenido académico que utiliza cada una.'
          : 'Refuerza tus conocimientos y acumula puntos jugando con los contenidos de tus asignaturas.'}
      </p>
    </header>

    ${esDocente ? `
      <aside class="tarjeta actividades-ayuda">
        <strong>Edición docente</strong>
        <p>Los juegos se actualizan desde los glosarios de cada tema; el quiz se administra desde el banco de preguntas.</p>
      </aside>` : ''}

    <div class="actividades-grid" role="list">
      ${tarjetasHtml}
    </div>
  `;
}

renderizarActividades();
