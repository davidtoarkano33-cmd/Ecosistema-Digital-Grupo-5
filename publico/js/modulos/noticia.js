// publico/js/modulos/noticia.js · Detalle de una noticia con registro automático de lectura
import { montarPlantilla } from '../nucleo/plantilla.js';
import { parametro, formatoBasico, fechaLarga } from '../nucleo/util.js';
import { obtener, crear, listar } from '../nucleo/api.js';
import { usuarioActual } from '../nucleo/sesion.js';
import { limpiar, escapar } from '../nucleo/ui.js';

async function iniciar() {
  await montarPlantilla({ titulo: "Noticia", roles: ["sesion"] });

  const id = parametro('id');
  if (!id) {
    mostrarError('No se proporcionó el identificador de la noticia.');
    return;
  }

  await cargarNoticia(id);
}

async function cargarNoticia(id) {
  const cargando = document.getElementById('cargando-detalle');
  const articulo = document.getElementById('articulo-noticia');

  try {
    const noticia = await obtener('noticias', id);
    if (!noticia) {
      mostrarError('La noticia solicitada no existe o no tienes permiso para verla.');
      return;
    }

    // Registrar lectura si no existe
    registrarLecturaSiNoExiste(id);

    // Actualizar título de la página
    document.title = `${noticia.titulo || 'Noticia'} · Ecosistema Educativo`;

    // Renderizar cabecera y etiquetas
    const contEtiquetas = document.getElementById('detalle-etiquetas');
    let etiquetasHtml = '';
    if (noticia.categoria) {
      etiquetasHtml += `<span class="insignia insignia--info">${escapar(noticia.categoria)}</span>`;
    }
    if (noticia.destacada) {
      etiquetasHtml += `<span class="insignia insignia--aviso">⭐ Destacada</span>`;
    }
    if (noticia.estado === 'borrador') {
      etiquetasHtml += `<span class="insignia insignia--secundario">Borrador</span>`;
    }
    contEtiquetas.innerHTML = etiquetasHtml;

    document.getElementById('detalle-titulo').textContent = noticia.titulo || '';

    // Fecha
    const fechaTexto = noticia.fechaPublicacion
      ? fechaLarga(noticia.fechaPublicacion)
      : (noticia.fecha ? fechaLarga(noticia.fecha) : '');
    document.getElementById('detalle-fecha').textContent = fechaTexto;

    // Tema relacionado si existe
    if (noticia.temaId) {
      try {
        const tema = await obtener('temas', noticia.temaId);
        if (tema) {
          const wrapTema = document.getElementById('detalle-tema-wrap');
          const linkTema = document.getElementById('detalle-tema-enlace');
          linkTema.textContent = `📚 ${tema.titulo}`;
          linkTema.href = `/paginas/tema.html?id=${encodeURIComponent(tema.id)}`;
          wrapTema.style.display = 'inline';
        }
      } catch (errTema) {
        console.warn('No se pudo cargar el tema relacionado:', errTema);
      }
    }

    // Permisos de edición para docente o admin
    const usuario = usuarioActual();
    if (usuario && (usuario.rol === 'docente' || usuario.rol === 'admin')) {
      const contEditar = document.getElementById('detalle-acciones-docente');
      const btnEditar = document.getElementById('btn-editar-noticia');
      btnEditar.href = `/paginas/editor-noticia.html?id=${encodeURIComponent(noticia.id)}`;
      contEditar.style.display = 'inline';
    }

    // Portada
    const wrapImg = document.getElementById('detalle-imagen-wrap');
    const imgEl = document.getElementById('detalle-imagen');
    if (noticia.imagen) {
      imgEl.src = noticia.imagen;
      imgEl.alt = noticia.titulo || 'Imagen de la noticia';
      wrapImg.style.display = 'block';
    } else {
      wrapImg.style.display = 'none';
    }

    // Resumen
    const wrapResumen = document.getElementById('detalle-resumen-wrap');
    const txtResumen = document.getElementById('detalle-resumen');
    if (noticia.resumen) {
      txtResumen.textContent = noticia.resumen;
      wrapResumen.style.display = 'block';
    } else {
      wrapResumen.style.display = 'none';
    }

    // Cuerpo con util.formatoBasico() y sanitización ui.limpiar()
    const contCuerpo = document.getElementById('detalle-cuerpo');
    const htmlFormateado = formatoBasico(noticia.cuerpo || '');
    contCuerpo.innerHTML = limpiar(htmlFormateado);

    cargando.style.display = 'none';
    articulo.style.display = 'block';
  } catch (err) {
    console.error('Error al cargar noticia:', err);
    mostrarError(`Error al cargar la noticia: ${err.message}`);
  }
}

async function registrarLecturaSiNoExiste(noticiaId) {
  try {
    const usuario = usuarioActual();
    if (!usuario) return;

    // Verificar si ya existe en lecturas-noticias
    const lecturas = await listar('lecturas-noticias', { noticiaId });
    const yaLeida = Array.isArray(lecturas) && lecturas.some(l => l.noticiaId === noticiaId);
    if (!yaLeida) {
      await crear('lecturas-noticias', { noticiaId });
      // Si el badge en la plantilla está visible, decrementar o actualizar
      const badge = document.getElementById('badge-noticias-no-leidas');
      if (badge && badge.textContent) {
        const actual = parseInt(badge.textContent, 10);
        if (!isNaN(actual)) {
          const nuevo = actual - 1;
          if (nuevo > 0) {
            badge.textContent = nuevo;
          } else {
            badge.style.display = 'none';
          }
        }
      }
    }
  } catch (err) {
    // Si falla por duplicado o ganchos, ignorar silenciosamente
    console.warn('Nota sobre registro de lectura:', err.message);
  }
}

function mostrarError(mensaje) {
  const cargando = document.getElementById('cargando-detalle');
  if (cargando) {
    cargando.innerHTML = `
      <div class="alerta alerta--error">
        <p>${escapar(mensaje)}</p>
        <p><a href="/paginas/noticias.html" class="btn btn--secundario btn--pequeno">&larr; Volver a Noticias</a></p>
      </div>
    `;
  }
}

// Iniciar al cargar
iniciar();
