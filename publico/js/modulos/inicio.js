// publico/js/modulos/inicio.js · Lógica de la página de inicio
import { montarPlantilla } from '../nucleo/plantilla.js';
import { usuarioActual } from '../nucleo/sesion.js';
import { listar } from '../nucleo/api.js';
import { escapar, cargando } from '../nucleo/ui.js';
import { fechaRelativa } from '../nucleo/util.js';
import { calcularAvance } from './asignaturas.js';

await montarPlantilla({ titulo: "Inicio" });

const usuario = usuarioActual();
const contenido = document.getElementById('contenido');

if (contenido) {
  if (!usuario) {
    renderizarSinSesion();
  } else {
    await renderizarConSesion();
  }
}

// 1. Vista para visitantes sin sesión
function renderizarSinSesion() {
  contenido.innerHTML = `
    <div class="inicio-bienvenida">
      <section class="inicio-hero" aria-labelledby="hero-titulo">
        <span class="insignia insignia--acento" style="width: fit-content;">Ecosistema Educativo Digital</span>
        <h1 id="hero-titulo" class="inicio-hero__titulo">Aprende, participa y alcanza tus metas formativas</h1>
        <p class="inicio-hero__descripcion">
          Bienvenido al entorno digital de aprendizaje. Accede a asignaturas interactivas, contenidos multimedia,
          canciones educativas sincronizadas, desafíos formativos y tutoría inteligente adaptada a tu ritmo.
        </p>
        <div class="inicio-hero__acciones">
          <a href="/paginas/ingreso.html" class="btn btn--primario">Ingresar</a>
          <a href="/paginas/registro.html" class="btn btn--secundario">Registrarse</a>
        </div>
      </section>

      <section class="inicio-pilares" aria-label="Características destacadas">
        <div class="tarjeta">
          <div class="inicio-pilar-icono" aria-hidden="true">📚</div>
          <h2 class="tarjeta__titulo" style="font-size: var(--tamano-m);">Contenidos Estructurados</h2>
          <p style="font-size: var(--tamano-s); color: var(--texto-suave);">
            Aprende paso a paso con asignaturas organizadas por unidades, objetivos claros y recursos multimedia.
          </p>
        </div>

        <div class="tarjeta">
          <div class="inicio-pilar-icono" aria-hidden="true">🎵</div>
          <h2 class="tarjeta__titulo" style="font-size: var(--tamano-m);">Música y Gamificación</h2>
          <p style="font-size: var(--tamano-s); color: var(--texto-suave);">
            Repasa conceptos clave mediante canciones educativas con letra sincronizada, retos, puntos e insignias.
          </p>
        </div>

        <div class="tarjeta">
          <div class="inicio-pilar-icono" aria-hidden="true">🤖</div>
          <h2 class="tarjeta__titulo" style="font-size: var(--tamano-m);">Tutor Socrático</h2>
          <p style="font-size: var(--tamano-s); color: var(--texto-suave);">
            Refuerza tu pensamiento crítico y resuelve inquietudes académicas con acompañamiento formativo continuo.
          </p>
        </div>
      </section>
    </div>
  `;
}

// 2. Vista para usuarios con sesión activa
async function renderizarConSesion() {
  cargando(true);

  try {
    // 2.1 Obtener último tema visitado de localStorage
    let ultimoTema = null;
    try {
      const guardado = localStorage.getItem('ultimoTema');
      if (guardado) {
        ultimoTema = JSON.parse(guardado);
      }
    } catch (e) {
      console.warn('Error al leer ultimoTema de localStorage:', e);
    }

    // 2.2 Cargar asignaturas y noticias en paralelo
    const [asignaturasLista, noticiasLista] = await Promise.all([
      listar('asignaturas').catch(() => []),
      listar('noticias').catch(() => [])
    ]);

    const asignaturas = Array.isArray(asignaturasLista) ? asignaturasLista : [];
    const noticias = Array.isArray(noticiasLista) ? noticiasLista : [];

    // Calcular avance para cada asignatura
    const avances = await Promise.all(
      asignaturas.map(asig => calcularAvance(asig.id).catch(() => ({ total: 0, revisados: 0, porcentaje: 0 })))
    );

    // Filtrar noticias publicadas y ordenar: destacadas primero, luego más recientes
    const noticiasPublicadas = noticias
      .filter(n => n && n.estado === 'publicado')
      .sort((a, b) => {
        const destA = a.destacada ? 1 : 0;
        const destB = b.destacada ? 1 : 0;
        if (destB !== destA) return destB - destA;
        const fechaA = new Date(a.fechaPublicacion || a.fecha || 0).getTime();
        const fechaB = new Date(b.fechaPublicacion || b.fecha || 0).getTime();
        return fechaB - fechaA;
      })
      .slice(0, 3);

    // 2.3 Construcción del HTML
    const esDocenteOAdmin = usuario.rol === 'docente' || usuario.rol === 'admin';

    let html = `
      <div class="inicio-bienvenida">
        <!-- Saludo -->
        <header class="inicio-saludo">
          <div class="inicio-saludo__fila">
            <div>
              <span class="insignia insignia--secundario inicio-saludo__rol">${escapar(usuario.rol)}</span>
              <h1 class="inicio-saludo__nombre">¡Hola, ${escapar(usuario.nombre)}!</h1>
            </div>
            <div>
              <a href="/paginas/perfil.html" class="btn btn--secundario btn--pequeno">Mi perfil</a>
            </div>
          </div>
        </header>
    `;

    // Continuar donde te quedaste
    if (ultimoTema && ultimoTema.id && ultimoTema.titulo) {
      html += `
        <section class="inicio-continuar" aria-label="Continuar aprendizaje">
          <div class="inicio-continuar__info">
            <div class="inicio-continuar__icono" aria-hidden="true">📖</div>
            <div>
              <div class="inicio-continuar__subtitulo">Continuar donde te quedaste</div>
              <h2 class="inicio-continuar__titulo">${escapar(ultimoTema.titulo)}</h2>
            </div>
          </div>
          <a href="/paginas/tema.html?id=${encodeURIComponent(ultimoTema.id)}" class="btn btn--primario">
            Reanudar tema →
          </a>
        </section>
      `;
    }

    // Accesos rápidos para docentes y admin
    if (esDocenteOAdmin) {
      html += `
        <section class="inicio-seccion" aria-labelledby="titulo-accesos">
          <div class="inicio-seccion__cabecera">
            <div>
              <h2 id="titulo-accesos" class="inicio-seccion__titulo">Accesos Rápidos</h2>
              <p class="inicio-seccion__descripcion">Herramientas docentes y de gestión académica</p>
            </div>
          </div>

          <div class="inicio-accesos-rapidos">
            <article class="tarjeta inicio-acceso-tarjeta">
              <div>
                <span class="insignia insignia--info" style="margin-bottom: var(--espacio-xs);">Planificación</span>
                <h3 class="tarjeta__titulo">Contenidos</h3>
                <p style="font-size: var(--tamano-s); color: var(--texto-suave);">
                  Crea y organiza unidades, temas formativos, actividades y recursos multimedia para tus estudiantes.
                </p>
              </div>
              <div style="margin-top: var(--espacio-m);">
                <a href="/paginas/editor-contenidos.html" class="btn btn--primario">Gestionar Contenidos →</a>
              </div>
            </article>

            <article class="tarjeta inicio-acceso-tarjeta">
              <div>
                <span class="insignia insignia--acento" style="margin-bottom: var(--espacio-xs);">Comunicación</span>
                <h3 class="tarjeta__titulo">Noticias</h3>
                <p style="font-size: var(--tamano-s); color: var(--texto-suave);">
                  Publica comunicados oficiales, avisos y novedades académicas destacadas para toda la comunidad.
                </p>
              </div>
              <div style="margin-top: var(--espacio-m);">
                <a href="/paginas/noticias.html" class="btn btn--secundario">Ver y Publicar Noticias →</a>
              </div>
            </article>
          </div>
        </section>
      `;
    }

    // Mis asignaturas con su avance
    html += `
      <section class="inicio-seccion" aria-labelledby="titulo-mis-asignaturas">
        <div class="inicio-seccion__cabecera">
          <div>
            <h2 id="titulo-mis-asignaturas" class="inicio-seccion__titulo">Mis Asignaturas</h2>
            <p class="inicio-seccion__descripcion">Progreso de estudio en los temas publicados</p>
          </div>
          <a href="/paginas/asignaturas.html" class="btn btn--texto">Ver todas →</a>
        </div>
    `;

    if (asignaturas.length === 0) {
      html += `
        <div class="tarjeta vacio" style="padding: var(--espacio-l); text-align: center;">
          <p style="color: var(--texto-suave); margin: 0;">No tienes asignaturas registradas actualmente.</p>
        </div>
      `;
    } else {
      html += `<div class="inicio-grid-asignaturas">`;
      asignaturas.forEach((asig, idx) => {
        const avance = avances[idx] || { total: 0, revisados: 0, porcentaje: 0 };
        html += `
          <article class="tarjeta" style="display: flex; flex-direction: column; justify-content: space-between;">
            <div>
              <span class="insignia insignia--info" style="margin-bottom: var(--espacio-xs);">${escapar(asig.nivel || 'Nivel')}</span>
              <h3 class="tarjeta__titulo" style="font-size: var(--tamano-m); margin: var(--espacio-xs) 0;">
                ${escapar(asig.nombre)}
              </h3>
              <p style="font-size: var(--tamano-s); color: var(--texto-suave); margin-bottom: var(--espacio-m);">
                ${escapar(asig.descripcion || '')}
              </p>

              <div>
                <div style="display: flex; justify-content: space-between; font-size: var(--tamano-xs); color: var(--texto-suave); margin-bottom: var(--espacio-xs);">
                  <span>Avance (${avance.revisados}/${avance.total} temas)</span>
                  <strong>${avance.porcentaje}%</strong>
                </div>
                <div class="progreso ${avance.porcentaje === 100 ? '' : 'progreso--acento'}" role="progressbar" aria-valuenow="${avance.porcentaje}" aria-valuemin="0" aria-valuemax="100">
                  <div class="progreso__barra" style="width: ${avance.porcentaje}%;"></div>
                </div>
              </div>
            </div>

            <div style="margin-top: var(--espacio-m); border-top: 1px solid var(--borde); padding-top: var(--espacio-m); display: flex; justify-content: flex-end;">
              <a href="/paginas/asignatura.html?id=${encodeURIComponent(asig.id)}" class="btn btn--secundario btn--pequeno">
                Ver Contenidos →
              </a>
            </div>
          </article>
        `;
      });
      html += `</div>`;
    }
    html += `</section>`;

    // Las 3 noticias más recientes (destacadas primero)
    html += `
      <section class="inicio-seccion" aria-labelledby="titulo-noticias-recientes">
        <div class="inicio-seccion__cabecera">
          <div>
            <h2 id="titulo-noticias-recientes" class="inicio-seccion__titulo">Noticias Recientes</h2>
            <p class="inicio-seccion__descripcion">Últimas publicaciones y novedades académicas</p>
          </div>
          <a href="/paginas/noticias.html" class="btn btn--texto">Ver todas las noticias →</a>
        </div>
    `;

    if (noticiasPublicadas.length === 0) {
      html += `
        <div class="tarjeta vacio" style="padding: var(--espacio-l); text-align: center;">
          <p style="color: var(--texto-suave); margin: 0;">No hay noticias publicadas en este momento.</p>
        </div>
      `;
    } else {
      html += `<div class="inicio-grid-noticias">`;
      noticiasPublicadas.forEach(noticia => {
        const esDestacada = noticia.destacada === true;
        const fechaTexto = noticia.fechaPublicacion ? fechaRelativa(noticia.fechaPublicacion) : '';

        html += `
          <article class="tarjeta noticia-tarjeta-inicio ${esDestacada ? 'noticia-tarjeta-inicio--destacada' : ''}">
            ${noticia.imagen ? `
              <div class="noticia-tarjeta-inicio__img-contenedor">
                <img src="${escapar(noticia.imagen)}" alt="${escapar(noticia.titulo)}" class="noticia-tarjeta-inicio__img" loading="lazy">
              </div>
            ` : ''}

            <div>
              <div class="noticia-tarjeta-inicio__meta">
                ${esDestacada ? `<span class="insignia insignia--acento">⭐ Destacada</span>` : ''}
                ${noticia.categoria ? `<span class="insignia insignia--secundario">${escapar(noticia.categoria)}</span>` : ''}
                ${fechaTexto ? `<span>${escapar(fechaTexto)}</span>` : ''}
              </div>

              <h3 class="noticia-tarjeta-inicio__titulo">
                ${escapar(noticia.titulo)}
              </h3>

              <p class="noticia-tarjeta-inicio__resumen">
                ${escapar(noticia.resumen || '')}
              </p>
            </div>

            <div style="margin-top: var(--espacio-m); border-top: 1px solid var(--borde); padding-top: var(--espacio-m); display: flex; justify-content: flex-end;">
              <a href="/paginas/noticia.html?id=${encodeURIComponent(noticia.id)}" class="btn btn--texto">
                Leer noticia →
              </a>
            </div>
          </article>
        `;
      });
      html += `</div>`;
    }
    html += `</section>`;

    html += `</div>`;
    contenido.innerHTML = html;
  } catch (error) {
    console.error('Error al renderizar inicio con sesión:', error);
    contenido.innerHTML = `
      <div class="alerta alerta--error">
        <p>Ocurrió un error al cargar la información de inicio. Por favor recarga la página.</p>
      </div>
    `;
  } finally {
    cargando(false);
  }
}
