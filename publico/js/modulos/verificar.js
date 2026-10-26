// publico/js/modulos/verificar.js · Verificación pública de certificados y diplomas
import { montarPlantilla } from '../nucleo/plantilla.js';
import { llamar } from '../nucleo/api.js';
import { parametro, fechaLarga } from '../nucleo/util.js';
import { escapar, cargando } from '../nucleo/ui.js';

await montarPlantilla({ titulo: "Verificar Certificado", roles: [] });

const contenido = document.getElementById('contenido');

function renderizarModulo() {
  if (!contenido) return;

  const codigoInicial = parametro('codigo') || '';

  contenido.innerHTML = `
    <div class="verificar-layout">
      <header class="verificar-cabecera">
        <h1 class="verificar-cabecera__titulo">Validación de Certificados</h1>
        <p class="verificar-cabecera__subtitulo">
          Ingresa el código alfanumérico impreso en el diploma para comprobar su validez oficial.
        </p>
      </header>

      <section class="tarjeta" style="padding: var(--espacio-l);">
        <form id="form-verificar" class="verificar-formulario" role="search" aria-label="Búsqueda de certificado">
          <div class="campo">
            <label for="input-codigo" class="campo__etiqueta">Código del Certificado</label>
            <input type="text"
                   id="input-codigo"
                   class="campo__control"
                   placeholder="Ej: EE-2026-AB12CD"
                   value="${escapar(codigoInicial)}"
                   required
                   autocomplete="off"
                   spellcheck="false">
          </div>
          <button type="submit" class="btn btn--primario" style="align-self: flex-end; height: 42px;">
            Verificar Código
          </button>
        </form>
      </section>

      <div id="contenedor-resultado" aria-live="polite"></div>
    </div>
  `;

  const form = document.getElementById('form-verificar');
  const inputCod = document.getElementById('input-codigo');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const codigo = inputCod.value.trim();
    if (codigo) {
      await verificarCertificado(codigo);
    }
  });

  if (codigoInicial) {
    verificarCertificado(codigoInicial);
  }
}

async function verificarCertificado(codigoRaw) {
  const cont = document.getElementById('contenedor-resultado');
  if (!cont) return;

  const codigo = String(codigoRaw).trim().toUpperCase();
  cargando(true);

  try {
    const res = await llamar('GET', `/api/certificados/verificar/${encodeURIComponent(codigo)}`);

    if (res && res.valido) {
      cont.innerHTML = `
        <article class="resultado-tarjeta resultado-tarjeta--valido" role="region" aria-label="Resultado de verificación exitosa">
          <div class="resultado-cabecera">
            <span class="resultado-icono" aria-hidden="true">✅</span>
            <div>
              <h2 class="resultado-titulo">Certificado Auténtico y Vigente</h2>
              <span class="insignia insignia--exito" style="margin-top: var(--espacio-xs);">Registro Verificado</span>
            </div>
          </div>

          <div class="resultado-detalles">
            <div class="resultado-item">
              <span class="resultado-item__etiqueta">Código Oficial</span>
              <div>
                <span class="resultado-item__codigo">${escapar(res.codigo || codigo)}</span>
              </div>
            </div>

            <div class="resultado-item">
              <span class="resultado-item__etiqueta">Otorgado a</span>
              <div class="resultado-item__valor resultado-item__valor--destacado">
                ${escapar(res.nombreCompleto)}
              </div>
            </div>

            <div class="resultado-item">
              <span class="resultado-item__etiqueta">Acreditación Académica</span>
              <div class="resultado-item__valor">
                ${escapar(res.detalle)}
              </div>
            </div>

            <div class="resultado-item">
              <span class="resultado-item__etiqueta">Fecha de Emisión</span>
              <div class="resultado-item__valor">
                ${res.fecha ? fechaLarga(res.fecha) : 'Fecha no especificada'}
              </div>
            </div>

            <div class="resultado-item" style="border-top: 1px solid var(--borde); padding-top: var(--espacio-m); margin-top: var(--espacio-s);">
              <small style="color: var(--texto-suave);">
                Emitido por la <strong>Universidad Estatal de Milagro</strong> a través del <strong>Ecosistema Educativo Digital</strong>.
              </small>
            </div>
          </div>
        </article>
      `;
    } else {
      cont.innerHTML = `
        <article class="resultado-tarjeta resultado-tarjeta--invalido" role="region" aria-label="Resultado de verificación fallida">
          <div class="resultado-cabecera">
            <span class="resultado-icono" aria-hidden="true">❌</span>
            <div>
              <h2 class="resultado-titulo">Certificado No Encontrado</h2>
              <span class="insignia insignia--error" style="margin-top: var(--espacio-xs);">No Válido</span>
            </div>
          </div>

          <p style="margin: 0; color: var(--texto); font-size: var(--tamano-m); line-height: var(--linea-normal);">
            El código <strong>«${escapar(codigo)}»</strong> no corresponde a ningún certificado registrado en nuestra base de datos.
          </p>
          <p style="margin-top: var(--espacio-s); color: var(--texto-suave); font-size: var(--tamano-s);">
            Por favor, revisa que no haya errores tipográficos en el código ingresado e inténtalo nuevamente.
          </p>
        </article>
      `;
    }
  } catch (err) {
    cont.innerHTML = `
      <div class="alerta alerta--error">
        Error al consultar la base de certificados: ${escapar(err.message)}
      </div>
    `;
  } finally {
    cargando(false);
  }
}

renderizarModulo();
