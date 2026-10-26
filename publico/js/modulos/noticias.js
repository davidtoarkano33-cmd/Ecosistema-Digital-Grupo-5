// publico/js/modulos/noticias.js · Catálogo paginado de noticias con filtros y badge nuevo
import { montarPlantilla } from '../nucleo/plantilla.js';
import { listar } from '../nucleo/api.js';
import { usuarioActual } from '../nucleo/sesion.js';
import { fechaRelativa, fechaCorta, normalizar } from '../nucleo/util.js';
import { escapar } from '../nucleo/ui.js';

const ELEMENTOS_POR_PAGINA = 9;

let estado = {
  todasNoticias: [],
  lecturasIds: new Set(),
  temasMap: new Map(),
  filtroCategoria: '',
  filtroTema: '',
  filtroBuscar: '',
  paginaActual: 1
};

async function iniciar() {
  await montarPlantilla({ titulo: "Noticias", roles: ["sesion"] });

  const usuario = usuarioActual();
  if (usuario && (usuario.rol === 'docente' || usuario.rol === 'admin')) {
    const accionesDoc = document.getElementById('acciones-docente');
    if (accionesDoc) accionesDoc.style.display = 'block';
  }

  configurarEventos();
  await cargarDatos();
}

function configurarEventos() {
  const selCat = document.getElementById('filtro-categoria');
  const selTema = document.getElementById('filtro-tema');
  const inpBuscar = document.getElementById('filtro-buscar');
  const btnPrev = document.getElementById('btn-pagina-anterior');
  const btnNext = document.getElementById('btn-pagina-siguiente');

  selCat.addEventListener('change', () => {
    estado.filtroCategoria = selCat.value;
    estado.paginaActual = 1;
    renderizar();
  });

  selTema.addEventListener('change', () => {
    estado.filtroTema = selTema.value;
    estado.paginaActual = 1;
    renderizar();
  });

  inpBuscar.addEventListener('input', () => {
    estado.filtroBuscar = inpBuscar.value.trim();
    estado.paginaActual = 1;
    renderizar();
  });

  btnPrev.addEventListener('click', () => {
    if (estado.paginaActual > 1) {
      estado.paginaActual--;
      renderizar();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });

  btnNext.addEventListener('click', () => {
    const totalPaginas = Math.ceil(obtenerNoticiasFiltradas().length / ELEMENTOS_POR_PAGINA);
    if (estado.paginaActual < totalPaginas) {
      estado.paginaActual++;
      renderizar();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });
}

async function cargarDatos() {
  const contCargando = document.getElementById('cargando-noticias');
  const contNoticias = document.getElementById('contenedor-noticias');

  try {
    const [noticias, lecturas, temas] = await Promise.all([
      listar('noticias'),
      listar('lecturas-noticias'),
      listar('temas')
    ]);

    estado.todasNoticias = noticias || [];
    estado.lecturasIds = new Set((lecturas || []).map(l => l.noticiaId));

    (temas || []).forEach(t => {
      estado.temasMap.set(t.id, t.titulo);
    });

    // Poblar selector de temas
    const selTema = document.getElementById('filtro-tema');
    (temas || []).forEach(t => {
      const opt = document.createElement('option');
      opt.value = t.id;
      opt.textContent = t.titulo;
      selTema.appendChild(opt);
    });

    if (contCargando) contCargando.style.display = 'none';
    if (contNoticias) contNoticias.style.display = 'grid';

    renderizar();
  } catch (err) {
    console.error('Error cargando noticias:', err);
    if (contCargando) {
      contCargando.style.display = 'none';
    }
    const sinNoticias = document.getElementById('sin-noticias');
    if (sinNoticias) {
      sinNoticias.innerHTML = `
        <div class="vacio__icono">⚠️</div>
        <h2 class="vacio__titulo">No se pudieron cargar las noticias</h2>
        <p class="vacio__texto">${escapar(err.message || 'Error de conexión con el servidor')}</p>
        <button type="button" class="btn btn--secundario btn--pequeno" onclick="window.location.reload()">Reintentar</button>
      `;
      sinNoticias.style.display = 'flex';
    }
  }
}

function obtenerNoticiasFiltradas() {
  const usuario = usuarioActual();
  const esDocenteOAdmin = usuario && (usuario.rol === 'docente' || usuario.rol === 'admin');

  return estado.todasNoticias.filter(noticia => {
    // Si no es docente/admin, solo ve publicadas (aunque el servidor también filtra)
    if (!esDocenteOAdmin && noticia.estado !== 'publicado') {
      return false;
    }

    if (estado.filtroCategoria && noticia.categoria !== estado.filtroCategoria) {
      return false;
    }

    if (estado.filtroTema && noticia.temaId !== estado.filtroTema) {
      return false;
    }

    if (estado.filtroBuscar) {
      const termNorm = normalizar(estado.filtroBuscar);
      const titNorm = normalizar(noticia.titulo || '');
      const resNorm = normalizar(noticia.resumen || '');
      if (!titNorm.includes(termNorm) && !resNorm.includes(termNorm)) {
        return false;
      }
    }

    return true;
  }).sort((a, b) => {
    // Destacadas primero
    const destA = a.destacada ? 1 : 0;
    const destB = b.destacada ? 1 : 0;
    if (destB !== destA) {
      return destB - destA;
    }
    // Luego por fecha más reciente
    const fA = new Date(a.fechaPublicacion || a.fecha || 0).getTime();
    const fB = new Date(b.fechaPublicacion || b.fecha || 0).getTime();
    return fB - fA;
  });
}

function renderizar() {
  const filtradas = obtenerNoticiasFiltradas();
  const contNoticias = document.getElementById('contenedor-noticias');
  const sinNoticias = document.getElementById('sin-noticias');
  const paginacion = document.getElementById('paginacion');
  const btnPrev = document.getElementById('btn-pagina-anterior');
  const btnNext = document.getElementById('btn-pagina-siguiente');
  const infoPagina = document.getElementById('info-pagina');

  if (filtradas.length === 0) {
    contNoticias.innerHTML = '';
    contNoticias.style.display = 'none';
    sinNoticias.style.display = 'flex';
    paginacion.style.display = 'none';
    return;
  }

  sinNoticias.style.display = 'none';
  contNoticias.style.display = 'grid';

  const totalPaginas = Math.ceil(filtradas.length / ELEMENTOS_POR_PAGINA);
  if (estado.paginaActual > totalPaginas) estado.paginaActual = totalPaginas;
  if (estado.paginaActual < 1) estado.paginaActual = 1;

  const inicio = (estado.paginaActual - 1) * ELEMENTOS_POR_PAGINA;
  const paginaItems = filtradas.slice(inicio, inicio + ELEMENTOS_POR_PAGINA);

  const usuario = usuarioActual();
  const puedeEditar = usuario && (usuario.rol === 'docente' || usuario.rol === 'admin');

  contNoticias.innerHTML = paginaItems.map(item => {
    const esLeida = estado.lecturasIds.has(item.id);
    const badgeNuevo = !esLeida ? `<span class="insignia insignia--acento">Nuevo</span>` : '';
    const badgeDestacada = item.destacada ? `<span class="insignia insignia--aviso">⭐ Destacada</span>` : '';
    const badgeEstado = item.estado === 'borrador' ? `<span class="insignia insignia--secundario">Borrador</span>` : '';
    const badgeCat = item.categoria ? `<span class="insignia insignia--info">${escapar(item.categoria)}</span>` : '';

    const imgHtml = item.imagen
      ? `<img src="${escapar(item.imagen)}" alt="${escapar(item.titulo)}" class="noticia-tarjeta__imagen">`
      : `<div class="noticia-tarjeta__imagen-placeholder" aria-hidden="true">📰</div>`;

    const fechaTexto = item.fechaPublicacion
      ? fechaRelativa(item.fechaPublicacion)
      : (item.fecha ? fechaCorta(item.fecha) : '');

    const temaTexto = item.temaId && estado.temasMap.has(item.temaId)
      ? `<span class="chip chip--pequeno" title="Tema relacionado">📚 ${escapar(estado.temasMap.get(item.temaId))}</span>`
      : '';

    const linkEditar = puedeEditar
      ? `<a href="/paginas/editor-noticia.html?id=${encodeURIComponent(item.id)}" class="btn btn--texto btn--pequeno" title="Editar noticia">Editar</a>`
      : '';

    return `
      <article class="noticia-tarjeta${item.destacada ? ' noticia-tarjeta--destacada' : ''}">
        <div class="noticia-tarjeta__imagen-wrap">
          ${imgHtml}
          <div class="noticia-tarjeta__etiquetas">
            ${badgeNuevo}
            ${badgeDestacada}
            ${badgeEstado}
            ${badgeCat}
          </div>
        </div>
        <div class="noticia-tarjeta__cuerpo">
          <div class="noticia-tarjeta__meta">
            <time datetime="${escapar(item.fechaPublicacion || item.fecha || '')}">${fechaTexto}</time>
            ${temaTexto}
          </div>
          <h2 class="noticia-tarjeta__titulo">
            <a href="/paginas/noticia.html?id=${encodeURIComponent(item.id)}">${escapar(item.titulo)}</a>
          </h2>
          <p class="noticia-tarjeta__resumen">${escapar(item.resumen || '')}</p>
          <div class="noticia-tarjeta__pie">
            <a href="/paginas/noticia.html?id=${encodeURIComponent(item.id)}" class="btn btn--secundario btn--pequeno">
              Leer más &rarr;
            </a>
            ${linkEditar}
          </div>
        </div>
      </article>
    `;
  }).join('');

  if (totalPaginas > 1) {
    paginacion.style.display = 'flex';
    btnPrev.disabled = estado.paginaActual === 1;
    btnNext.disabled = estado.paginaActual === totalPaginas;
    infoPagina.textContent = `Página ${estado.paginaActual} de ${totalPaginas}`;
  } else {
    paginacion.style.display = 'none';
  }
}

// Inicializar al cargar el script
iniciar();
