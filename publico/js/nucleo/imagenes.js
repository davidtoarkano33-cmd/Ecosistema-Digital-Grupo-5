// publico/js/nucleo/imagenes.js · Imágenes referenciales con visor ampliado
import { escapar, modal } from './ui.js';

export function ampliarFoto({ src, alt = 'Imagen ampliada' } = {}) {
  if (!src) return Promise.resolve(null);

  const contenedor = document.createElement('div');
  contenedor.className = 'visor-foto';

  const imagen = document.createElement('img');
  imagen.className = 'visor-foto__imagen';
  imagen.src = src;
  imagen.alt = alt;
  contenedor.appendChild(imagen);

  return modal({
    titulo: 'Vista ampliada',
    contenido: contenedor,
    clase: 'modal--visor-foto',
    acciones: [
      { texto: 'Cerrar', valor: true, clase: 'btn--primario' }
    ]
  });
}

export function fotoReferencial({ src, alt, claseImagen = '', carga = 'lazy' } = {}) {
  if (!src) return '';
  const clases = String(claseImagen || '').replace(/[^a-zA-Z0-9_\-\s]/g, '').trim();
  const textoAlt = alt || 'Imagen referencial del contenido';
  const modoCarga = carga === 'eager' ? 'eager' : 'lazy';

  return `
    <figure class="foto-referencial">
      <img src="${escapar(src)}" alt="${escapar(textoAlt)}" class="${escapar(clases)}" loading="${modoCarga}">
      <figcaption class="foto-referencial__accion">
        <button type="button" class="btn btn--secundario btn--pequeno foto-referencial__ver" data-foto-src="${escapar(src)}" data-foto-alt="${escapar(textoAlt)}" aria-label="Ampliar foto: ${escapar(textoAlt)}">
          Ver foto
        </button>
      </figcaption>
    </figure>
  `;
}

if (typeof document !== 'undefined') {
  document.addEventListener('click', (evento) => {
    const boton = evento.target.closest('.foto-referencial__ver');
    if (!boton) return;
    ampliarFoto({
      src: boton.dataset.fotoSrc,
      alt: boton.dataset.fotoAlt || 'Imagen ampliada'
    });
  });
}

export default { fotoReferencial, ampliarFoto };
