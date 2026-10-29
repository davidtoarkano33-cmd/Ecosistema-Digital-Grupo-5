// publico/js/modulos/actividades.js · Catálogo de actividades lúdicas y evaluativas
import { montarPlantilla } from '../nucleo/plantilla.js';
import { ACTIVIDADES } from '../nucleo/catalogo-actividades.js';
import { escapar } from '../nucleo/ui.js';
import { usuarioActual } from '../nucleo/sesion.js';
import { fotoReferencial } from '../nucleo/imagenes.js';

await montarPlantilla({ titulo: "Actividades", roles: ["estudiante", "docente", "admin"] });

const contenido = document.getElementById('contenido');
const rolActual = usuarioActual()?.rol;
const puedeGestionar = rolActual === 'docente' || rolActual === 'admin';

const IMAGENES_ACTIVIDAD = {
  ahorcado: ['/recursos/proyecto/actividad-ahorcado.png', 'Estudiantes paramédicos resolviendo una palabra clínica oculta'],
  pareja: ['/recursos/proyecto/actividad-parejas.png', 'Estudiantes relacionando parejas de instrumentos y conceptos médicos'],
  'sopa-letras': ['/recursos/proyecto/actividad-sopa-letras.png', 'Estudiantes buscando conceptos clínicos en una sopa de letras digital'],
  crucigrama: ['/recursos/proyecto/actividad-crucigrama.png', 'Estudiante resolviendo un crucigrama médico con orientación docente'],
  quiz: ['/recursos/proyecto/actividad-quiz-niveles.png', 'Estudiantes paramédicos celebrando el avance en un quiz por niveles'],
  canciones: ['/recursos/proyecto/actividad-canciones.png', 'Docentes paramédicos grabando una canción educativa'],
  tutor: ['/recursos/proyecto/vision-ia-educativa.png', 'Docente paramédico utilizando inteligencia artificial educativa'],
  simulador: ['/recursos/proyecto/mision-docencia-simulacion.png', 'Docente paramédico guiando una simulación clínica']
};

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
    const [imagen, imagenAlt] = IMAGENES_ACTIVIDAD[act.id] || IMAGENES_ACTIVIDAD.quiz;
    return `
      <article class="tarjeta actividad-tarjeta">
        ${fotoReferencial({ src: imagen, alt: imagenAlt, claseImagen: 'actividad-tarjeta__imagen' })}
        <div class="actividad-tarjeta__cabecera">
          <span class="actividad-tarjeta__icono" aria-hidden="true">${icono}</span>
          <h2 class="actividad-tarjeta__titulo">${escapar(act.texto)}</h2>
        </div>
        <p class="actividad-tarjeta__descripcion">${escapar(act.descripcion || '')}</p>
        <div class="actividad-tarjeta__accion">
          <a href="${escapar(act.href)}" class="btn btn--primario">
            ${puedeGestionar ? 'Probar actividad' : 'Jugar'}
          </a>
          ${puedeGestionar ? `<a href="${escapar(gestion.href)}" class="btn btn--secundario">${escapar(gestion.texto)}</a>` : ''}
        </div>
      </article>
    `;
  }).join('');

  contenido.innerHTML = `
    <header class="actividades-encabezado">
      <h1 class="actividades-encabezado__titulo">Actividades Formativas</h1>
      <p class="actividades-encabezado__subtitulo">
        ${puedeGestionar
          ? 'Prueba las actividades y gestiona el contenido académico que utiliza cada una.'
          : 'Refuerza tus conocimientos y acumula puntos jugando con los contenidos de tus asignaturas.'}
      </p>
    </header>

    ${puedeGestionar ? `
      <aside class="tarjeta actividades-ayuda">
        <strong>Gestión de actividades</strong>
        <p>Los juegos se actualizan desde los glosarios de cada tema; el quiz se administra desde el banco de preguntas.</p>
      </aside>` : ''}

    <div class="actividades-grid" role="list">
      ${tarjetasHtml}
    </div>
  `;
}

renderizarActividades();
