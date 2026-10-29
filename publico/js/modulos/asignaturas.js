// publico/js/modulos/asignaturas.js · Vista de asignaturas con avance del estudiante
import { montarPlantilla } from '../nucleo/plantilla.js';
import { listar } from '../nucleo/api.js';
import { aviso, escapar, cargando } from '../nucleo/ui.js';
import { fotoReferencial } from '../nucleo/imagenes.js';

export async function calcularAvance(asignaturaId) {
  try {
    const [unidades, temas, progreso] = await Promise.all([
      listar('unidades', { asignaturaId }),
      listar('temas'),
      listar('progreso-temas')
    ]);

    const unidadesIds = new Set(
      (Array.isArray(unidades) ? unidades : [])
        .filter(u => u.visible !== false)
        .map(u => u.id)
    );

    const temasPublicados = (Array.isArray(temas) ? temas : []).filter(t => 
      t.unidadId && unidadesIds.has(t.unidadId) && t.estado === 'publicado'
    );

    const totalTemas = temasPublicados.length;
    if (totalTemas === 0) {
      return { total: 0, revisados: 0, porcentaje: 0 };
    }

    const temasRevisadosIds = new Set(
      (Array.isArray(progreso) ? progreso : []).map(p => p.temaId)
    );

    const revisados = temasPublicados.filter(t => temasRevisadosIds.has(t.id)).length;
    const porcentaje = Math.round((revisados / totalTemas) * 100);

    return { total: totalTemas, revisados, porcentaje };
  } catch (err) {
    console.error('Error al calcular avance:', err);
    return { total: 0, revisados: 0, porcentaje: 0 };
  }
}

// Inicialización de la vista solo si nos encontramos en asignaturas.html
if (window.location.pathname.includes('asignaturas.html')) {
  await montarPlantilla({ titulo: "Mis Asignaturas", roles: ["estudiante", "docente"] });

  const contenido = document.getElementById('contenido');
  if (contenido) {
  contenido.innerHTML = `
    <div class="tarjeta">
      <div class="fila" style="justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: var(--espacio-m);">
        <div>
          <h1 class="tarjeta__titulo">Mis Asignaturas</h1>
          <p class="tarjeta__subtitulo">Explora los contenidos, temas formativos y sigue tu progreso académico</p>
        </div>
      </div>

      <div class="asignaturas-estudiante-grid" id="grid-mis-asignaturas">
        <p style="color: var(--texto-suave);">Cargando asignaturas...</p>
      </div>
    </div>
  `;

  const grid = document.getElementById('grid-mis-asignaturas');

  async function cargarAsignaturas() {
    cargando(true);
    try {
      const lista = await listar('asignaturas');
      const asignaturas = Array.isArray(lista) ? lista : [];

      if (asignaturas.length === 0) {
        grid.innerHTML = `
          <div class="vacio" style="grid-column: 1 / -1; padding: var(--espacio-xl);">
            <div class="vacio__icono">📚</div>
            <h3 class="vacio__titulo">No tienes asignaturas matriculadas</h3>
            <p class="vacio__texto">Comunícate con tu docente o administrador para ser asignado a un paralelo.</p>
          </div>
        `;
        return;
      }

      // Calcular avance en paralelo para cada asignatura
      const avances = await Promise.all(asignaturas.map(a => calcularAvance(a.id)));

      grid.innerHTML = asignaturas.map((asig, idx) => {
        const avance = avances[idx] || { total: 0, revisados: 0, porcentaje: 0 };

        return `
          <article class="tarjeta tarjeta-asignatura-estudiante" data-id="${escapar(asig.id)}">
            <div>
              ${asig.imagen ? fotoReferencial({ src: asig.imagen, alt: asig.imagenAlt || `Imagen referencial de ${asig.nombre}`, claseImagen: 'tarjeta-asignatura-estudiante__imagen' }) : ''}
              <span class="insignia insignia--info" style="margin-bottom: var(--espacio-xs);">${escapar(asig.nivel || 'Nivel inicial')}</span>
              <h2 class="tarjeta__titulo" style="font-size: var(--tamano-m); margin: var(--espacio-xs) 0;">
                ${escapar(asig.nombre)}
              </h2>
              <p style="font-size: var(--tamano-s); color: var(--texto-suave); margin-bottom: var(--espacio-m);">
                ${escapar(asig.descripcion || 'Sin descripción disponible.')}
              </p>

              <div class="asignatura-avance-seccion">
                <div class="asignatura-avance-texto">
                  <span>Progreso formativo (${avance.revisados} de ${avance.total} temas)</span>
                  <span class="asignatura-avance-porcentaje">${avance.porcentaje}%</span>
                </div>
                <div class="progreso ${avance.porcentaje === 100 ? '' : 'progreso--acento'}" role="progressbar" aria-valuenow="${avance.porcentaje}" aria-valuemin="0" aria-valuemax="100">
                  <div class="progreso__barra" style="width: ${avance.porcentaje}%;"></div>
                </div>
              </div>
            </div>

            <div style="border-top: 1px solid var(--borde); padding-top: var(--espacio-m); margin-top: var(--espacio-m); display: flex; justify-content: flex-end;">
              <a href="/paginas/asignatura.html?id=${encodeURIComponent(asig.id)}" class="btn btn--primario">
                Ver Contenidos →
              </a>
            </div>
          </article>
        `;
      }).join('');
    } catch (err) {
      aviso(err.message || 'Error al cargar asignaturas', 'error');
      grid.innerHTML = `<p style="color: var(--error);">No se pudieron cargar las asignaturas.</p>`;
    } finally {
      cargando(false);
    }
  }

  await cargarAsignaturas();
}
}
