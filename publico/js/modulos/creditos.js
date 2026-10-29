// publico/js/modulos/creditos.js · Autoría, prompts y fuentes del ecosistema
import { montarPlantilla } from '../nucleo/plantilla.js';
import { actualizar, listar, subir } from '../nucleo/api.js';
import { usuarioActual } from '../nucleo/sesion.js';
import { aviso, cargando, escapar, modal } from '../nucleo/ui.js';

await montarPlantilla({ titulo: "Autores y créditos" });

const AUTORES_INICIALES = [
  {
    id: 'aut_000001',
    nombre: 'Ortiz Vivar Harold Leonardo',
    rol: 'Maestrante · Docente paramédico',
    frase: 'Prepárate con pasión, actúa con valor y sirve siempre con humanidad',
    materia: 'Prácticas Preprofesionales',
    foto: '/recursos/autores/harold-ortiz.png',
    orden: 1,
    principal: true
  },
  { id: 'aut_000002', nombre: 'Pacheco Quezada Gisselle Cristina', rol: 'Maestrante · Docente paramédico', orden: 2 },
  { id: 'aut_000003', nombre: 'Solarte Santos Nicole Solange', rol: 'Maestrante · Docente paramédico', orden: 3 },
  { id: 'aut_000004', nombre: 'Toapanta Vargas David Gonzalo', rol: 'Maestrante · Docente paramédico', orden: 4 }
];

const esAdmin = usuarioActual()?.rol === 'admin';
let autores = [...AUTORES_INICIALES];

const PROMPTS = [
  'Tutor socrático con contenido clínico autorizado',
  'Generación docente de preguntas por nivel cognitivo',
  'Generación de glosarios para actividades formativas',
  'Creación de escenarios ramificados y consecuencias',
  'Generación de personajes, contexto y rúbrica para prácticas de rol',
  'Simulación conversacional de roles clínicos',
  'Evaluación formativa de prácticas mediante rúbrica',
  'Prueba controlada de conexión y respuesta del proveedor de IA'
];

const BIBLIOGRAFIA = [
  {
    categoria: 'Marcos pedagógicos y competencia digital',
    referencias: [
      {
        autor: 'Ferrari, A.',
        anio: '2013',
        titulo: 'DIGCOMP: A Framework for Developing and Understanding Digital Competence in Europe',
        edicion: 'Luxemburgo: Publications Office of the European Union',
        url: 'https://publications.jrc.ec.europa.eu/repository/handle/JRC83167'
      },
      {
        autor: 'Carretero, S., Vuorikari, R. y Punie, Y.',
        anio: '2017',
        titulo: 'DigComp 2.1: The Digital Competence Framework for Citizens with Eight Proficiency Levels and Examples of Use',
        edicion: 'Luxemburgo: Publications Office of the European Union',
        url: 'https://publications.jrc.ec.europa.eu/repository/handle/JRC106281'
      },
      {
        autor: 'Vuorikari, R., Kluzer, S. y Punie, Y.',
        anio: '2022',
        titulo: 'DigComp 2.2: The Digital Competence Framework for Citizens — With New Examples of Knowledge, Skills and Attitudes',
        edicion: 'Luxemburgo: Publications Office of the European Union',
        url: 'https://publications.jrc.ec.europa.eu/repository/handle/JRC128415'
      },
      {
        autor: 'Redecker, C. y Punie, Y. (Ed.).',
        anio: '2017',
        titulo: 'European Framework for the Digital Competence of Educators: DigCompEdu',
        edicion: 'Luxemburgo: Publications Office of the European Union',
        url: 'https://publications.jrc.ec.europa.eu/repository/handle/JRC107466'
      },
      {
        autor: 'Anderson, L. W. y Krathwohl, D. R. (Eds.).',
        anio: '2001',
        titulo: 'A Taxonomy for Learning, Teaching, and Assessing',
        edicion: 'Nueva York: Longman'
      }
    ]
  },
  {
    categoria: 'Fuentes clínicas y atención prehospitalaria',
    referencias: [
      {
        autor: 'American College of Surgeons Committee on Trauma.',
        anio: '2018',
        titulo: 'Advanced Trauma Life Support: Student Course Manual. 10.ª ed.',
        edicion: 'Chicago: American College of Surgeons',
        url: 'https://www.facs.org/quality-programs/trauma/education/advanced-trauma-life-support/'
      },
      {
        autor: 'National Association of Emergency Medical Technicians.',
        anio: '2020',
        titulo: 'PHTLS: Soporte Vital de Trauma Prehospitalario. 9.ª ed.',
        edicion: 'Burlington, MA: Jones & Bartlett Learning',
        url: 'https://www.naemt.org/education/trauma-education/phtls'
      },
      {
        autor: 'Rossaint, R. et al.',
        anio: '2023',
        titulo: 'The European Guideline on Management of Major Bleeding and Coagulopathy Following Trauma: Sixth Edition',
        edicion: 'Londres: Critical Care, Springer Nature',
        url: 'https://doi.org/10.1186/s13054-023-04327-7'
      },
      {
        autor: 'Self, W. H. et al.',
        anio: '2018',
        titulo: 'Balanced Crystalloids versus Saline in Noncritically Ill Adults',
        edicion: 'Boston: The New England Journal of Medicine, Massachusetts Medical Society',
        url: 'https://doi.org/10.1056/NEJMoa1711586'
      },
      {
        autor: 'George Aguilar, F. et al.',
        anio: '2022',
        titulo: 'Algoritmo de Emergencias Médicas de Chiapas para pacientes en estado de choque',
        edicion: 'Ciudad de México: Medicina Crítica, Colegio Mexicano de Medicina Crítica',
        url: 'https://doi.org/10.35366/105383'
      },
      {
        autor: 'Pyzocha, N. y Arnold, M. J.',
        anio: '2020',
        titulo: 'Accidental Hypothermia: Guidelines from the Wilderness Medical Society',
        edicion: 'Leawood, KS: American Family Physician, American Academy of Family Physicians',
        url: 'https://www.aafp.org/pubs/afp/issues/2020/1101/p571.html'
      },
      {
        autor: 'O’Driscoll, B. R., Howard, L. S., Earis, J. y Mak, V.',
        anio: '2017',
        titulo: 'BTS Guideline for Oxygen Use in Adults in Healthcare and Emergency Settings',
        edicion: 'Londres: Thorax, BMJ Publishing Group',
        url: 'https://doi.org/10.1136/thoraxjnl-2016-209729'
      },
      {
        autor: 'Echevarria, C., Steer, J., Wason, J. y Bourke, S.',
        anio: '2021',
        titulo: 'Oxygen Therapy and Inpatient Mortality in COPD Exacerbation',
        edicion: 'Londres: Emergency Medicine Journal, BMJ Publishing Group',
        url: 'https://doi.org/10.1136/emermed-2019-209257'
      },
      {
        autor: 'Queensland Health y Royal Flying Doctor Service (Queensland Section).',
        anio: '2025',
        titulo: 'Primary Clinical Care Manual. 12.ª ed.',
        edicion: 'Cairns: Office of Rural and Remote Health, Queensland Government',
        url: 'https://www.health.qld.gov.au/clinical-practice/guidelines-procedures/clinical-resources/rural-and-remote-health-clinical-resources/primary-clinical-care-manual'
      },
      {
        autor: 'National Institute for Health and Care Excellence.',
        anio: '2016',
        titulo: 'Major Trauma: Service Delivery. NICE Guideline NG40',
        edicion: 'Londres: NICE',
        url: 'https://www.nice.org.uk/guidance/ng40'
      },
      {
        autor: 'Muñoz, F., Arratia, L. y Kattan, E.',
        anio: '2021',
        titulo: 'Uso de cristaloides en la reanimación del paciente crítico',
        edicion: 'Santiago: Revista Chilena de Anestesia, Sociedad de Anestesiología de Chile',
        url: 'https://doi.org/10.25237/revchilanestv50n02-05'
      },
      {
        autor: 'Botelho, F. et al.',
        anio: '2020',
        titulo: 'Pediatric Trauma Primary Survey Performance among Surgical and Non-surgical Pediatric Providers in a Brazilian Trauma Center',
        edicion: 'Londres: Trauma Surgery & Acute Care Open, BMJ',
        url: 'https://doi.org/10.1136/tsaco-2020-000451'
      },
      {
        autor: 'Del Rios, M. et al.',
        anio: '2025',
        titulo: 'Part 1: Executive Summary: 2025 American Heart Association Guidelines for CPR and ECC',
        edicion: 'Dallas: Circulation, American Heart Association',
        url: 'https://doi.org/10.1161/CIR.0000000000001372'
      },
      {
        autor: 'Mühlenfeld, N. et al.',
        anio: '2026',
        titulo: 'Emergency Spinal Stabilization in Polytrauma',
        edicion: 'Ámsterdam: Injury, Elsevier',
        url: 'https://doi.org/10.1016/j.injury.2026.113152'
      },
      {
        autor: 'Procter, L. D.',
        anio: '2026',
        titulo: 'Shock',
        edicion: 'Rahway, NJ: Manual MSD, Merck & Co.',
        url: 'https://www.msdmanuals.com/professional/critical-care-medicine/shock-and-fluid-resuscitation/shock'
      },
      {
        autor: 'Merizalde Medina, C. E.',
        anio: '2023',
        titulo: 'Manifestaciones cutáneas asociadas a la severidad por COVID-19: revisión teórica',
        edicion: 'Ciudad de México: Ciencia Latina Revista Científica Multidisciplinar',
        url: 'https://doi.org/10.37811/cl_rcm.v7i6.9491'
      },
      {
        autor: 'ENTHA.',
        anio: '2025',
        titulo: 'Atención prehospitalaria del trauma: el enfoque XABCDE de la evaluación inicial',
        edicion: 's. l.: ENTHA, recurso en línea',
        url: 'https://enthaltda.com.co/'
      },
      {
        autor: 'TECH Universidad.',
        anio: '2025',
        titulo: 'Oxigenoterapia en urgencias y emergencias: tipos, indicaciones y monitorización segura',
        edicion: 's. l.: TECH Universidad, recurso audiovisual en YouTube',
        url: 'https://www.youtube.com/watch?v=5scmDTbdHVA'
      },
      {
        autor: 'PrehospitalTV.',
        anio: '2024',
        titulo: 'Manejo del shock hemorrágico prehospitalario',
        edicion: 's. l.: PrehospitalTV, recurso audiovisual en YouTube',
        url: 'https://www.youtube.com/watch?v=6OABK_VgtDs'
      }
    ]
  },
  {
    categoria: 'Inteligencia artificial, multimedia y recursos del proyecto',
    referencias: [
      {
        autor: 'Google.',
        anio: '2026',
        titulo: 'Gemini API y documentación de modelos',
        edicion: 'Mountain View, CA: Google LLC',
        url: 'https://ai.google.dev/gemini-api/docs'
      },
      {
        autor: 'Google.',
        anio: '2026',
        titulo: 'NotebookLM: información del producto y gestión de fuentes',
        edicion: 'Mountain View, CA: Google LLC',
        url: 'https://support.google.com/gemininotebook/answer/16164461?hl=es'
      },
      {
        autor: 'OpenAI.',
        anio: '2026',
        titulo: 'ChatGPT Capabilities Overview',
        edicion: 'San Francisco: OpenAI',
        url: 'https://help.openai.com/en/articles/9260256-chatgpt-capabilities-overview'
      },
      {
        autor: 'Anthropic.',
        anio: '2026',
        titulo: 'Claude: product overview',
        edicion: 'San Francisco: Anthropic',
        url: 'https://www.anthropic.com/claude'
      },
      {
        autor: 'Canva Pty Ltd.',
        anio: '2026',
        titulo: 'Canva for Education',
        edicion: 'Sídney: Canva',
        url: 'https://www.canva.com/help/about-canva-for-education/'
      },
      {
        autor: 'Gamma Tech.',
        anio: '2026',
        titulo: 'AI Presentation Generator',
        edicion: 'San Francisco: Gamma',
        url: 'https://gamma.app/products/presentations'
      },
      {
        autor: 'Wayground.',
        anio: '2026',
        titulo: 'Create an Assessment/Quiz',
        edicion: 's. l.: Wayground, recurso educativo en línea',
        url: 'https://help.wayground.com/support/solutions/articles/158000462332-create-an-assessment-quiz'
      },
      {
        autor: 'Creative Commons.',
        anio: '2013',
        titulo: 'Atribución 4.0 Internacional (CC BY 4.0)',
        edicion: 'Mountain View, CA: Creative Commons',
        url: 'https://creativecommons.org/licenses/by/4.0/deed.es'
      },
      {
        autor: 'Grupo 5.',
        anio: '2026',
        titulo: 'Colección de prompts del tutor socrático, generación de contenidos, simulación y evaluación',
        edicion: 'Milagro, Ecuador: Universidad Estatal de Milagro. Documento interno del proyecto'
      },
      {
        autor: 'Grupo 5.',
        anio: '2026',
        titulo: 'Protocolo Salvavidas: evaluación primaria XABCDE y evaluación secundaria del paciente traumático',
        edicion: 'Milagro, Ecuador: recurso educativo en Canva',
        url: 'https://canva.link/ptjmffsgog9t0ty'
      },
      {
        autor: 'Grupo 5.',
        anio: '2026',
        titulo: 'Colección de recursos educativos digitales sobre trauma y shock',
        edicion: 'Milagro, Ecuador: recurso educativo en Canva',
        url: 'https://canva.link/qnof5u6ka06pnd2'
      },
      {
        autor: 'OpenAI y Grupo 5.',
        anio: '2026',
        titulo: 'Fondo lateral con ambulancia y Estrella de la Vida para el Ecosistema Educativo Digital',
        edicion: 'Milagro, Ecuador: imagen generada mediante inteligencia artificial y adaptada para este proyecto'
      }
    ]
  }
];

function iniciales(nombre) {
  return nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(parte => parte.charAt(0))
    .join('')
    .toUpperCase();
}

function ordenarAutores(lista) {
  return [...lista].sort((a, b) => (Number(a.orden) || 99) - (Number(b.orden) || 99));
}

function botonEditar(autor) {
  if (!esAdmin) return '';
  return `
    <button type="button" class="btn btn--secundario btn--pequeno autor-editar" data-autor-id="${escapar(autor.id)}">
      Editar autor
    </button>
  `;
}

function botonVerFoto(autor) {
  if (!autor.foto) return '';
  return `
    <button type="button" class="autor-ver-foto" data-autor-id="${escapar(autor.id)}"
      aria-label="Ver fotografía ampliada de ${escapar(autor.nombre)}">
      Ver foto
    </button>
  `;
}

function renderizarAutorCompleto(autor) {
  return `
    <article class="autor-destacado">
      <div class="autor-destacado__media">
        <div class="autor-destacado__foto">
          <img src="${escapar(autor.foto)}" alt="Fotografía de ${escapar(autor.nombre)}" loading="eager">
        </div>
        ${botonVerFoto(autor)}
      </div>
      <div class="autor-destacado__contenido">
        <header class="autor-destacado__cabecera">
          <div>
            <span class="insignia insignia--info">${autor.principal ? 'Autor principal' : 'Autor del proyecto'}</span>
            <h3>${escapar(autor.nombre)}</h3>
          </div>
          ${botonEditar(autor)}
        </header>
        <p class="autor-destacado__rol">${escapar(autor.rol)}</p>
        <blockquote class="autor-destacado__frase">“${escapar(autor.frase)}”</blockquote>
        <div class="autor-destacado__materia">
          <span>Materia favorita a impartir:</span>
          <strong>${escapar(autor.materia)}</strong>
        </div>
      </div>
    </article>
  `;
}

function renderizarAutorBasico(autor) {
  return `
    <article class="autor-tarjeta">
      <div class="autor-tarjeta__media">
        ${autor.foto
          ? `<img class="autor-tarjeta__foto" src="${escapar(autor.foto)}" alt="Fotografía de ${escapar(autor.nombre)}" loading="lazy">`
          : `<span class="autor-tarjeta__inicial" aria-hidden="true">${escapar(iniciales(autor.nombre))}</span>`}
        ${botonVerFoto(autor)}
      </div>
      <div class="autor-tarjeta__datos">
        <strong>${escapar(autor.nombre)}</strong>
        <span>${escapar(autor.rol)}</span>
      </div>
      ${botonEditar(autor)}
    </article>
  `;
}

async function verFoto(autor) {
  if (!autor?.foto) return;

  const visor = document.createElement('figure');
  visor.className = 'visor-foto';
  visor.innerHTML = `
    <img src="${escapar(autor.foto)}" alt="Fotografía ampliada de ${escapar(autor.nombre)}">
    <figcaption>${escapar(autor.nombre)}</figcaption>
  `;

  const cierre = modal({
    titulo: `Fotografía de ${autor.nombre}`,
    contenido: visor,
    acciones: [
      { texto: 'Cerrar', valor: true, clase: 'btn--primario' }
    ]
  });

  visor.closest('.modal')?.classList.add('modal--foto');
  await cierre;
}

function renderizarAutores() {
  const contenedorAutores = document.getElementById('autores-contenido');
  if (!contenedorAutores) return;

  const lista = ordenarAutores(autores);
  const completos = lista.filter(autor => autor.foto && autor.frase && autor.materia);
  const pendientes = lista.filter(autor => !autor.foto || !autor.frase || !autor.materia);

  contenedorAutores.innerHTML = `
    <div class="autores-destacados">
      ${completos.map(renderizarAutorCompleto).join('')}
    </div>
    ${pendientes.length ? `
      <section class="autores-pendientes" aria-labelledby="titulo-autores-pendientes">
        <div>
          <h3 id="titulo-autores-pendientes">Otros autores del proyecto</h3>
          <p>Sus perfiles ampliados se incorporarán cuando se complete su información.</p>
        </div>
        <div class="autores-grid">
          ${pendientes.map(renderizarAutorBasico).join('')}
        </div>
      </section>
    ` : ''}
  `;
}

async function editarAutor(autor) {
  if (!esAdmin || !autor) return;

  const formulario = document.createElement('form');
  formulario.className = 'autor-formulario';
  formulario.innerHTML = `
    <div class="autor-formulario__foto">
      <div class="autor-formulario__vista" id="autor-vista-foto">
        ${autor.foto
          ? `<img src="${escapar(autor.foto)}" alt="Vista previa de ${escapar(autor.nombre)}">`
          : `<span aria-hidden="true">${escapar(iniciales(autor.nombre))}</span>`}
      </div>
      <label class="btn btn--secundario btn--pequeno" for="autor-archivo">Cambiar fotografía</label>
      <input id="autor-archivo" type="file" accept="image/jpeg,image/png,image/webp" hidden>
      <input id="autor-foto" type="hidden" value="${escapar(autor.foto || '')}">
      <small>Se recomienda una imagen vertical en proporción 4:5.</small>
    </div>
    <div class="autor-formulario__campos">
      <div class="campo">
        <label for="autor-nombre">Nombre completo</label>
        <input id="autor-nombre" type="text" maxlength="120" required value="${escapar(autor.nombre)}">
      </div>
      <div class="campo">
        <label for="autor-rol">Rol académico</label>
        <input id="autor-rol" type="text" maxlength="120" required value="${escapar(autor.rol)}">
      </div>
      <div class="campo">
        <label for="autor-frase">Frase motivadora</label>
        <textarea id="autor-frase" rows="4" maxlength="280">${escapar(autor.frase || '')}</textarea>
      </div>
      <div class="campo">
        <label for="autor-materia">Materia favorita a impartir</label>
        <input id="autor-materia" type="text" maxlength="160" value="${escapar(autor.materia || '')}">
      </div>
      <div class="campo">
        <label for="autor-orden">Orden de presentación</label>
        <input id="autor-orden" type="number" min="1" max="100" value="${Number(autor.orden) || 1}">
      </div>
      <div class="campo campo--casilla">
        <input id="autor-principal" type="checkbox" ${autor.principal ? 'checked' : ''}>
        <label for="autor-principal">Identificar como autor principal</label>
      </div>
    </div>
  `;

  const archivo = formulario.querySelector('#autor-archivo');
  const foto = formulario.querySelector('#autor-foto');
  const vista = formulario.querySelector('#autor-vista-foto');

  archivo.addEventListener('change', async evento => {
    const seleccionado = evento.target.files?.[0];
    if (!seleccionado) return;
    try {
      aviso('Subiendo fotografía...', 'info');
      const resultado = await subir(seleccionado);
      foto.value = resultado.url;
      vista.innerHTML = `<img src="${escapar(resultado.url)}" alt="Nueva fotografía del autor">`;
      aviso('Fotografía lista para guardar.', 'exito');
    } catch (error) {
      aviso(error.message || 'No se pudo subir la fotografía.', 'error');
    }
  });

  const guardar = await modal({
    titulo: `Editar a ${autor.nombre}`,
    contenido: formulario,
    acciones: [
      { texto: 'Cancelar', valor: false, clase: 'btn--secundario' },
      { texto: 'Guardar cambios', valor: true, clase: 'btn--primario' }
    ]
  });
  if (!guardar) return;

  const cambios = {
    nombre: formulario.querySelector('#autor-nombre').value.trim(),
    rol: formulario.querySelector('#autor-rol').value.trim(),
    frase: formulario.querySelector('#autor-frase').value.trim(),
    materia: formulario.querySelector('#autor-materia').value.trim(),
    foto: foto.value.trim() || null,
    orden: Number(formulario.querySelector('#autor-orden').value) || 1,
    principal: formulario.querySelector('#autor-principal').checked
  };

  if (!cambios.nombre || !cambios.rol) {
    aviso('El nombre y el rol académico son obligatorios.', 'error');
    return;
  }

  try {
    cargando(true);
    const guardado = await actualizar('autores', autor.id, cambios);
    autores = autores.map(item => item.id === guardado.id ? guardado : item);
    renderizarAutores();
    aviso('Perfil de autor actualizado.', 'exito');
  } catch (error) {
    aviso(error.message || 'No se pudo actualizar el perfil.', 'error');
  } finally {
    cargando(false);
  }
}

function renderizarReferencia(referencia) {
  const enlace = referencia.url
    ? `<a class="referencia__enlace" href="${escapar(referencia.url)}" target="_blank" rel="noopener noreferrer">Obtenido de: ${escapar(referencia.url)}</a>`
    : '<span class="referencia__enlace">Fuente interna del proyecto.</span>';

  return `
    <li class="referencia">
      <strong>${escapar(referencia.autor)} (${escapar(referencia.anio)}).</strong>
      <cite>${escapar(referencia.titulo)}</cite>.
      ${escapar(referencia.edicion)}.
      <br>${enlace}
    </li>
  `;
}

const contenido = document.getElementById('contenido');
if (contenido) {
  contenido.innerHTML = `
    <article class="creditos-pagina">
      <header class="creditos-portada">
        <div class="creditos-portada__texto">
          <h1>Autores y créditos</h1>
          <p>Autoría académica, prompts, fuentes clínicas, marcos de competencia digital y herramientas empleadas en el ecosistema.</p>
        </div>
      </header>

      <section class="tarjeta creditos-seccion" aria-labelledby="titulo-autores">
        <div>
          <h2 id="titulo-autores" class="creditos-seccion__titulo">Créditos de autoría</h2>
          <p class="creditos-seccion__descripcion">Maestrantes responsables del proyecto áulico.</p>
        </div>
        <div id="autores-contenido"></div>
        <p class="creditos-licencia">
          <strong>Ecosistema Educativo Digital Inteligente © 2026.</strong>
          Recurso educativo del Grupo 5 publicado bajo licencia
          <a href="https://creativecommons.org/licenses/by/4.0/deed.es" target="_blank" rel="noopener noreferrer">Creative Commons Atribución 4.0 Internacional</a>.
        </p>
      </section>

      <section class="tarjeta creditos-seccion" aria-labelledby="titulo-prompts">
        <div>
          <h2 id="titulo-prompts" class="creditos-seccion__titulo">Prompts desarrollados</h2>
          <p class="creditos-seccion__descripcion">Diseñados por el equipo y sujetos a revisión humana antes de utilizar resultados generados por IA.</p>
        </div>
        <ul class="prompts-lista">
          ${PROMPTS.map(prompt => `<li>${escapar(prompt)}</li>`).join('')}
        </ul>
      </section>

      <section class="creditos-seccion" aria-labelledby="titulo-bibliografia">
        <div>
          <h2 id="titulo-bibliografia" class="creditos-seccion__titulo">Referencias bibliográficas</h2>
          <p class="creditos-seccion__descripcion">
            Las fuentes clínicas orientan contenidos educativos y no sustituyen protocolos locales, supervisión docente ni criterio profesional.
          </p>
        </div>
        ${BIBLIOGRAFIA.map(grupo => `
          <section class="tarjeta bibliografia-grupo">
            <h3>${escapar(grupo.categoria)}</h3>
            <ol class="referencias-lista">
              ${grupo.referencias.map(renderizarReferencia).join('')}
            </ol>
          </section>
        `).join('')}
      </section>
    </article>
  `;

  renderizarAutores();

  document.getElementById('autores-contenido')?.addEventListener('click', evento => {
    const botonFoto = evento.target.closest('.autor-ver-foto');
    if (botonFoto) {
      verFoto(autores.find(autor => autor.id === botonFoto.dataset.autorId));
      return;
    }

    const botonEditarAutor = evento.target.closest('.autor-editar');
    if (!botonEditarAutor) return;
    editarAutor(autores.find(autor => autor.id === botonEditarAutor.dataset.autorId));
  });

  try {
    const respuesta = await listar('autores');
    if (Array.isArray(respuesta) && respuesta.length) {
      autores = respuesta;
      renderizarAutores();
    }
  } catch (error) {
    console.warn('Se utilizaron los autores integrados porque no se pudo consultar la colección.', error);
  }
}
