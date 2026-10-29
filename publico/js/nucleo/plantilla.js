// publico/js/nucleo/plantilla.js · Montaje de encabezado, menú filtrado, sesión y pie común
import { MENU } from './menu.js';
import { usuarioActual, cerrar, exigirRol } from './sesion.js';
import { registrarEvento } from './bitacora.js';
import { aviso } from './ui.js';
import { listar, llamar } from './api.js';
import { logrosDe } from './gamificacion.js';
import { montarCampana } from './notificaciones.js';
import { montarAvatar, decir } from './avatar.js';

export const NOMBRE = "Ecosistema Educativo";

export async function montarPlantilla({ titulo = "", roles = [] } = {}) {
  // 1. Exigir rol si se especifican roles
  if (roles && roles.length > 0) {
    const permitido = exigirRol(roles);
    if (!permitido) return;
  }

  // 2. Título del documento
  document.title = titulo ? `${titulo} · ${NOMBRE}` : NOMBRE;

  const contPlantilla = document.getElementById('plantilla');
  if (!contPlantilla) {
    console.error('No se encontró el contenedor #plantilla en el documento.');
    return;
  }

  const usuario = usuarioActual();

  // 3. Registrar visita de página si hay sesión (en segundo plano)
  if (usuario) {
    registrarEvento('pagina', window.location.pathname);
  }

  // 4. Filtrar elementos de MENU según el estado de la sesión y el rol
  const rutaActual = window.location.pathname;
  const menuFiltrado = MENU
    .filter(item => {
      if (!item.roles || item.roles.includes('publico')) {
        return true;
      }
      if (!usuario) {
        return false;
      }
      if (item.roles.includes('sesion')) {
        return true;
      }
      return item.roles.includes(usuario.rol);
    })
    .sort((a, b) => {
      if (a.href === '/index.html') return -1;
      if (b.href === '/index.html') return 1;
      return a.texto.localeCompare(b.texto, 'es', { sensitivity: 'base' });
    });

  const enlacesMenuHtml = menuFiltrado.map(item => {
    const esActivo = rutaActual === item.href || (item.href === '/index.html' && (rutaActual === '/' || rutaActual === ''));
    const claseActivo = esActivo ? ' activo' : '';
    const claseDestacado = item.destacado ? ' menu__enlace--destacado' : '';
    const ariaAttr = esActivo ? ' aria-current="page"' : '';
    const esNoticias = item.texto === 'Noticias' || item.href.includes('noticias.html');
    const esMensajes = item.texto === 'Mensajes' || item.href.includes('mensajes.html');
    const badgeHtml = esNoticias
      ? ` <span id="badge-noticias-no-leidas" class="insignia insignia--acento" style="display: none; margin-left: auto;"></span>`
      : esMensajes
        ? ` <span id="badge-mensajes-no-leidos" class="insignia insignia--acento" style="display: none; margin-left: auto;"></span>`
        : '';
    const iconoHtml = item.icono
      ? `<svg class="menu__icono" aria-hidden="true" focusable="false"><use href="/recursos/iconos-navegacion.svg#${item.icono}"></use></svg>`
      : '';
    return `<a href="${item.href}" class="menu__enlace${claseDestacado}${claseActivo}"${ariaAttr}>${iconoHtml}<span>${item.texto}</span>${badgeHtml}</a>`;
  }).join('');

  // 5. Bloque de autenticación para el encabezado
  let bloqueAuthHtml = '';
  if (usuario) {
    const iniciales = `${(usuario.nombre || '').charAt(0)}${(usuario.apellido || '').charAt(0)}`.toUpperCase() || 'U';
    const avatarCabecera = usuario.foto
      ? `<img src="${usuario.foto}" alt="" class="avatar avatar--s" style="border: 2px solid var(--primario);">`
      : `<span class="avatar avatar--s avatar--vacio">${iniciales}</span>`;

    const puntosHtml = usuario.rol === 'estudiante'
      ? `<div id="puntos-usuario" class="puntos-usuario" title="Mis puntos acumulados">
          <span class="puntos-usuario__icono" aria-hidden="true">⭐</span>
          <span class="puntos-usuario__cantidad">0</span> pts
        </div>`
      : '';

    bloqueAuthHtml = `
      <div class="encabezado__sesion">
        ${puntosHtml}
        <div id="contenedor-campana"></div>
        <a href="/paginas/perfil.html" class="encabezado__usuario" style="display: flex; align-items: center; gap: var(--espacio-xs); text-decoration: none;" title="Ver mi perfil">
          ${avatarCabecera}
          <strong style="color: var(--texto-inverso); font-size: var(--tamano-s);">${usuario.nombre} ${usuario.apellido}</strong>
          <span class="insignia insignia--info">${usuario.rol}</span>
        </a>
        <button type="button" class="btn btn--texto btn--pequeno" id="btn-cerrar-sesion" title="Cerrar sesión">Salir</button>
      </div>
    `;
  } else {
    bloqueAuthHtml = `
      <div class="fila fila--s">
        <a href="/paginas/ingreso.html" class="btn btn--texto btn--pequeno">Ingresar</a>
        <a href="/paginas/registro.html" class="btn btn--primario btn--pequeno">Registrarse</a>
      </div>
    `;
  }

  // 6. Inserción de encabezado y menú lateral en #plantilla
  contPlantilla.innerHTML = `
    <header class="encabezado" role="banner">
      <div class="contenedor encabezado__interior">
        <div class="fila fila--s" style="align-items: center;">
          <button type="button" class="menu-alternar" id="btn-alternar-menu" aria-label="Abrir menú" aria-expanded="false" aria-controls="menu-lateral">
            ☰
          </button>
          <a href="/index.html" class="encabezado__marca">
            <span>${NOMBRE}</span>
          </a>
          <span style="color: #627586;">/</span>
          <span style="font-size: var(--tamano-s); font-weight: var(--peso-medio); color: #bcd0dc;">${titulo}</span>
        </div>
        <div class="fila fila--m encabezado__acciones" style="align-items: center;">
          ${bloqueAuthHtml}
        </div>
      </div>
    </header>
    <aside class="menu" id="menu-lateral" aria-label="Menú principal">
      <div class="menu__grupo">Navegación</div>
      <nav class="pila pila--xs" aria-label="Enlaces principales">
        ${enlacesMenuHtml}
      </nav>
    </aside>
  `;

  // 7. Configuración del botón de cierre de sesión
  const btnSalir = document.getElementById('btn-cerrar-sesion');
  if (btnSalir) {
    btnSalir.addEventListener('click', async () => {
      await cerrar();
    });
  }

  // 8. Pie de página al final del body
  if (!document.querySelector('footer.pie')) {
    const pie = document.createElement('footer');
    pie.className = 'pie';
    pie.setAttribute('role', 'contentinfo');
    const anioActual = new Date().getFullYear();
    pie.innerHTML = `
      <div class="contenedor pie__contenido">
        <div>
          <strong>${NOMBRE}</strong>
          <p style="margin: 0; font-size: var(--tamano-xs); color: #bcd0dc;">
            Plataforma educativa digital · &copy; ${anioActual}
          </p>
        </div>
        <div class="pie__enlaces">
          <small>Universidad Estatal de Milagro</small>
          <nav aria-label="Información del proyecto">
            <a href="/paginas/creditos.html">Autores y créditos</a>
            <a href="/paginas/privacidad.html">Privacidad</a>
          </nav>
        </div>
      </div>
    `;
    document.body.appendChild(pie);
  }

  // 9. Comportamiento accesible del menú móvil
  const btnAlternar = document.getElementById('btn-alternar-menu');
  const menuLateral = document.getElementById('menu-lateral');

  if (btnAlternar && menuLateral) {
    btnAlternar.addEventListener('click', (e) => {
      e.stopPropagation();
      const abierto = menuLateral.classList.toggle('abierto');
      btnAlternar.setAttribute('aria-expanded', abierto ? 'true' : 'false');
    });

    document.addEventListener('click', (e) => {
      if (menuLateral.classList.contains('abierto') && !menuLateral.contains(e.target) && e.target !== btnAlternar) {
        menuLateral.classList.remove('abierto');
        btnAlternar.setAttribute('aria-expanded', 'false');
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && menuLateral.classList.contains('abierto')) {
        menuLateral.classList.remove('abierto');
        btnAlternar.setAttribute('aria-expanded', 'false');
        btnAlternar.focus();
      }
    });
  }

  // 10. Despachar avisos pendientes tras redirecciones
  try {
    const avisoPendiente = sessionStorage.getItem('aviso_pendiente');
    if (avisoPendiente) {
      sessionStorage.removeItem('aviso_pendiente');
      const parsed = JSON.parse(avisoPendiente);
      aviso(parsed.texto, parsed.tipo || 'info');
    }
  } catch {
    // Si el JSON falla, ignorar
  }

  // 11. Cargar número de noticias publicadas no leídas
  if (usuario) {
    (async () => {
      try {
        const [noticias, lecturas] = await Promise.all([
          listar('noticias', { estado: 'publicado' }),
          listar('lecturas-noticias')
        ]);
        const idsLeidas = new Set((lecturas || []).map(l => l.noticiaId));
        const noLeidas = (noticias || []).filter(n => n.estado === 'publicado' && !idsLeidas.has(n.id)).length;
        const badgeEl = document.getElementById('badge-noticias-no-leidas');
        if (badgeEl && noLeidas > 0) {
          badgeEl.textContent = noLeidas > 99 ? '99+' : noLeidas;
          badgeEl.style.display = 'inline-block';
        }
      } catch (err) {
        // En caso de que no haya sesión activa o falle silenciosamente
        console.warn('No se pudo cargar conteo de noticias:', err);
      }
    })();
  }

  // 12. Cargar puntos del estudiante con logrosDe('yo')
  if (usuario && usuario.rol === 'estudiante') {
    (async () => {
      try {
        const logros = await logrosDe('yo');
        const elPuntos = document.getElementById('puntos-usuario');
        if (elPuntos && logros && typeof logros.puntos === 'number') {
          const cant = elPuntos.querySelector('.puntos-usuario__cantidad');
          if (cant) {
            cant.textContent = logros.puntos;
          } else {
            elPuntos.textContent = `${logros.puntos} pts`;
          }
        }
      } catch (err) {
        console.warn('No se pudo cargar puntos del usuario:', err);
      }
    })();
  }

  // 13. Montar campana de notificaciones si hay sesión
  if (usuario) {
    montarCampana().catch(err => {
      console.warn('No se pudo montar centro de notificaciones:', err);
    });

    const actualizarMensajesNoLeidos = async () => {
      if (document.hidden) return;
      try {
        const respuesta = await llamar('GET', '/api/mensajes/no-leidos');
        const badge = document.getElementById('badge-mensajes-no-leidos');
        const total = Number(respuesta.total) || 0;
        if (badge) {
          badge.textContent = total > 99 ? '99+' : total;
          badge.style.display = total > 0 ? 'inline-flex' : 'none';
        }
      } catch {
        // El contador no interrumpe la navegación.
      }
    };
    actualizarMensajesNoLeidos();
    setInterval(actualizarMensajesNoLeidos, 60000);
  }

  // 14. Montar Índice Deslizable de Secciones (Subtemas) de la página
  montarIndiceSeccionesGlobal(titulo);

  const contenidoAvatar = document.querySelector('[data-avatar]');
  const instruccionesAvatar = contenidoAvatar?.dataset.avatar?.trim();
  montarAvatar();
  if (instruccionesAvatar) {
    decir(instruccionesAvatar);
  }
}

/**
 * Escanea dinámicamente los encabezados (h2, section con aria-labelledby, tarjetas)
 * y monta el cajón deslizable lateral con scroll suave para todas las páginas.
 */
function montarIndiceSeccionesGlobal(tituloPagina) {
  // Esperar a que el contenido principal termine su renderizado inicial
  setTimeout(() => {
    // Si la página ya tiene un índice específico (como asignatura.html), no duplicar
    if (document.getElementById('btn-abrir-indice') || document.getElementById('panel-indice-global')) {
      return;
    }

    const contenido = document.getElementById('contenido');
    if (!contenido) return;

    // Buscar encabezados de sección relevantes
    const encabezados = Array.from(contenido.querySelectorAll('h2, h3, .tarjeta__titulo, .progreso-cabecera__titulo, .panel-grafico-titulo, .panel-tabla-titulo'));
    
    // Filtrar encabezados visibles con texto significativo
    const seccionesValidas = encabezados
      .filter(el => {
        const texto = (el.textContent || '').trim();
        return texto.length >= 3 && !el.closest('.vacio') && !el.closest('.modal');
      })
      .map((el, idx) => {
        if (!el.id) {
          el.id = `sec-auto-${idx}-${Date.now().toString().slice(-4)}`;
        }
        return {
          id: el.id,
          elemento: el,
          texto: (el.textContent || '').trim()
        };
      });

    // Solo montar el índice si hay al menos 2 secciones identificables
    if (seccionesValidas.length < 2) {
      return;
    }

    const itemsIndiceHtml = seccionesValidas.map((sec, i) => `
      <li>
        <a href="#${sec.id}" class="indice-global__enlace" data-destino="${sec.id}">
          <span class="indice-global__icono-punto">${i + 1}</span>
          <span>${sec.texto}</span>
        </a>
      </li>
    `).join('');

    const contIndice = document.createElement('div');
    contIndice.className = 'contenedor-indice-global';
    contIndice.innerHTML = `
      <!-- Botón flotante lateral -->
      <button type="button" id="btn-flotante-indice-global" class="btn-flotante-indice-global" aria-label="Abrir Índice de la página" title="Abrir Índice de contenidos">
        <span class="btn-flotante-indice-global__icono" aria-hidden="true">☰</span>
        <span>Índice</span>
      </button>

      <!-- Fondo y cajón deslizable -->
      <div id="indice-global-backdrop" class="indice-global-backdrop" aria-hidden="true"></div>
      <aside id="panel-indice-global" class="panel-indice-global" role="dialog" aria-modal="true" aria-label="Índice de contenidos">
        <div class="panel-indice-global__cabecera">
          <div>
            <span class="panel-indice-global__badge-seccion">Secciones</span>
            <h3 class="panel-indice-global__titulo">Índice de la página</h3>
          </div>
          <button type="button" id="btn-cerrar-indice-global" class="btn-cerrar-indice-global" aria-label="Cerrar índice" title="Cerrar">
            ✕
          </button>
        </div>

        <div class="panel-indice-global__cuerpo">
          <div class="panel-indice-global__info">
            <strong style="color: var(--primario); font-size: var(--tamano-s);">${tituloPagina || 'Contenido'}</strong>
            <span style="font-size: var(--tamano-xs); color: var(--texto-suave);">${seccionesValidas.length} secciones disponibles</span>
          </div>

          <nav aria-label="Lista de secciones">
            <ul class="indice-global__lista">
              ${itemsIndiceHtml}
            </ul>
          </nav>
        </div>
      </aside>
    `;

    document.body.appendChild(contIndice);

    const btnFlotante = document.getElementById('btn-flotante-indice-global');
    const panel = document.getElementById('panel-indice-global');
    const backdrop = document.getElementById('indice-global-backdrop');
    const btnCerrar = document.getElementById('btn-cerrar-indice-global');

    function alternar(abrir) {
      const debeAbrir = abrir !== undefined ? abrir : !panel.classList.contains('panel-indice-global--abierto');
      if (debeAbrir) {
        panel.classList.add('panel-indice-global--abierto');
        backdrop.classList.add('indice-global-backdrop--activo');
        document.body.style.overflow = 'hidden';
        btnCerrar.focus();
      } else {
        panel.classList.remove('panel-indice-global--abierto');
        backdrop.classList.remove('indice-global-backdrop--activo');
        document.body.style.overflow = '';
      }
    }

    if (btnFlotante) btnFlotante.addEventListener('click', () => alternar(true));
    if (btnCerrar) btnCerrar.addEventListener('click', () => alternar(false));
    if (backdrop) backdrop.addEventListener('click', () => alternar(false));

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && panel.classList.contains('panel-indice-global--abierto')) {
        alternar(false);
      }
    });

    // Clic en enlace: desplazamiento suave y animación de halo
    contIndice.querySelectorAll('.indice-global__enlace').forEach(enlace => {
      enlace.addEventListener('click', (e) => {
        e.preventDefault();
        const idDestino = enlace.getAttribute('data-destino');
        const elementoDestino = document.getElementById(idDestino);

        alternar(false);

        if (elementoDestino) {
          elementoDestino.scrollIntoView({ behavior: 'smooth', block: 'center' });
          const contenedorPadre = elementoDestino.closest('.tarjeta, .tarjeta-grafico, section, .panel-grafico-bloque, .panel-tabla-bloque') || elementoDestino;
          contenedorPadre.classList.add('seccion-scroll-resaltada');
          setTimeout(() => {
            contenedorPadre.classList.remove('seccion-scroll-resaltada');
          }, 2000);
        }
      });
    });
  }, 400);
}

export default {
  NOMBRE,
  montarPlantilla
};
