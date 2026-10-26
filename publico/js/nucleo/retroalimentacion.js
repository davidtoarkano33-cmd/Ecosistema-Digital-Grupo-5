// publico/js/nucleo/retroalimentacion.js · Componentes de retroalimentación y resumen
import { modal, escapar } from './ui.js';

/**
 * Muestra un panel de retroalimentación (.retro)
 * @param {Object} opciones
 * @param {boolean} opciones.correcto
 * @param {string} [opciones.explicacion]
 * @param {string} [opciones.sugerencia]
 * @param {string} [opciones.enlaceTema]
 * @param {HTMLElement|string} [opciones.contenedor]
 * @returns {HTMLElement} El elemento .retro
 */
export function mostrarRetro({ correcto, explicacion, sugerencia, enlaceTema, contenedor } = {}) {
  const panel = document.createElement('div');
  panel.className = `retro ${correcto ? 'retro--correcto' : 'retro--incorrecto'}`;
  panel.setAttribute('aria-live', 'polite');
  panel.setAttribute('role', 'status');

  const icono = correcto ? '✅' : '❌';

  let enlaceHtml = '';
  if (enlaceTema) {
    enlaceHtml = `
      <a href="${escapar(enlaceTema)}" class="retro__enlace">
        Repasar el tema →
      </a>
    `;
  }

  panel.innerHTML = `
    <div class="retro__cabecera">
      <span class="retro__icono" aria-hidden="true">${icono}</span>
      <div>
        ${explicacion ? `<p class="retro__explicacion">${escapar(explicacion)}</p>` : ''}
        ${sugerencia ? `<p class="retro__sugerencia">${escapar(sugerencia)}</p>` : ''}
      </div>
    </div>
    ${enlaceHtml}
  `;

  let contEl = null;
  if (contenedor) {
    contEl = typeof contenedor === 'string' ? document.querySelector(contenedor) : contenedor;
  } else {
    contEl = document.getElementById('retro') || document.getElementById('panel-retro');
  }

  if (contEl) {
    contEl.innerHTML = '';
    contEl.appendChild(panel);
  }

  return panel;
}

/**
 * Muestra el resumen de la actividad en un modal
 * @param {Object} opciones
 * @param {string} [opciones.titulo="Resumen de la Actividad"]
 * @param {number} [opciones.aciertos=0]
 * @param {number} [opciones.errores=0]
 * @param {string|string[]} [opciones.recomendaciones]
 * @param {string} [opciones.enlaceTema]
 * @returns {Promise<"repetir" | "salir">}
 */
export async function mostrarResumen({ titulo = 'Resumen de la Actividad', aciertos = 0, errores = 0, recomendaciones, enlaceTema } = {}) {
  let recHtml = '';
  if (recomendaciones) {
    if (Array.isArray(recomendaciones) && recomendaciones.length > 0) {
      recHtml = `
        <div style="margin-top: var(--espacio-m); text-align: left;">
          <strong style="font-size: var(--tamano-s); color: var(--primario);">Recomendaciones:</strong>
          <ul style="margin: var(--espacio-xs) 0 0 var(--espacio-l); font-size: var(--tamano-s); color: var(--texto-suave);">
            ${recomendaciones.map(r => `<li>${escapar(r)}</li>`).join('')}
          </ul>
        </div>
      `;
    } else if (typeof recomendaciones === 'string') {
      recHtml = `
        <div style="margin-top: var(--espacio-m); text-align: left;">
          <strong style="font-size: var(--tamano-s); color: var(--primario);">Recomendación:</strong>
          <p style="margin: var(--espacio-xs) 0 0; font-size: var(--tamano-s); color: var(--texto-suave);">${escapar(recomendaciones)}</p>
        </div>
      `;
    }
  }

  const contResumen = document.createElement('div');
  contResumen.style.textAlign = 'center';
  contResumen.style.padding = 'var(--espacio-s) 0';
  contResumen.innerHTML = `
    <div class="fila fila--m" style="justify-content: center; gap: var(--espacio-l); margin-bottom: var(--espacio-m);">
      <div style="padding: var(--espacio-m); background-color: var(--exito-fondo); border-radius: var(--radio-m); min-width: 100px;">
        <span style="font-size: var(--tamano-xl); font-weight: var(--peso-negrita); color: var(--exito);">${aciertos}</span>
        <div style="font-size: var(--tamano-xs); color: var(--exito); font-weight: var(--peso-seminegrita);">Aciertos</div>
      </div>
      <div style="padding: var(--espacio-m); background-color: var(--error-fondo); border-radius: var(--radio-m); min-width: 100px;">
        <span style="font-size: var(--tamano-xl); font-weight: var(--peso-negrita); color: var(--error);">${errores}</span>
        <div style="font-size: var(--tamano-xs); color: var(--error); font-weight: var(--peso-seminegrita);">Errores</div>
      </div>
    </div>
    ${recHtml}
  `;

  const acciones = [
    ...(enlaceTema ? [{ texto: 'Repasar el tema', valor: 'repasar', clase: 'btn--secundario' }] : []),
    { texto: 'Jugar de nuevo', valor: 'repetir', clase: 'btn--primario' }
  ];

  // Si no hay enlaceTema, ofrecer botón salir por claridad
  if (!enlaceTema) {
    acciones.unshift({ texto: 'Salir', valor: 'salir', clase: 'btn--secundario' });
  }

  const resultado = await modal({
    titulo,
    contenido: contResumen,
    acciones
  });

  if (resultado === 'repasar' && enlaceTema) {
    window.location.href = enlaceTema;
    return 'salir';
  }

  return resultado === 'repetir' ? 'repetir' : 'salir';
}

export default {
  mostrarRetro,
  mostrarResumen
};
