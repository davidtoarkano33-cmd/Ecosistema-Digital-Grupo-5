// publico/js/modulos/privacidad.js · Contenido del aviso de privacidad según LOPDP Ecuador
import { montarPlantilla } from '../nucleo/plantilla.js';

await montarPlantilla({ titulo: "Aviso de Privacidad" });

const contenido = document.getElementById('contenido');
if (contenido) {
  contenido.innerHTML = `
    <article class="privacidad-contenedor tarjeta">
      <h1 class="tarjeta__titulo">Aviso de Privacidad y Protección de Datos</h1>
      <p class="tarjeta__subtitulo">Cumplimiento con la Ley Orgánica de Protección de Datos Personales (LOPDP) de la República del Ecuador</p>

      <section class="privacidad-seccion">
        <h2>1. Finalidad del Tratamiento</h2>
        <p>
          Los datos personales recopilados a través del Ecosistema Educativo Digital son tratados con el propósito exclusivo de gestionar el proceso de enseñanza-aprendizaje, la evaluación formativa, el seguimiento del rendimiento académico, la personalización pedagógica y la acreditación de logros educativos.
        </p>
      </section>

      <section class="privacidad-seccion">
        <h2>2. Datos Personales Tratados</h2>
        <p>Para la prestación del servicio educativo se tratan las siguientes categorías de datos:</p>
        <ul>
          <li><strong>Datos identificativos:</strong> Nombre y apellido.</li>
          <li><strong>Datos de contacto:</strong> Dirección de correo electrónico institucional o personal.</li>
          <li><strong>Registro de actividad:</strong> Interacciones en la plataforma, inicio de sesión, progreso en temas, respuestas en actividades, puntajes y eventos en el sistema.</li>
        </ul>
      </section>

      <section class="privacidad-seccion">
        <h2>3. Derechos de los Titulares (LOPDP)</h2>
        <p>
          De conformidad con lo dispuesto en la LOPDP del Ecuador, usted tiene derecho a ejercer sus facultades de:
        </p>
        <ul>
          <li><strong>Acceso:</strong> Conocer qué datos personales suyos están siendo tratados.</li>
          <li><strong>Rectificación y actualización:</strong> Solicitar la corrección o actualización de datos inexactos o incompletos.</li>
          <li><strong>Eliminación:</strong> Solicitar la supresión de sus datos personales cuando hayan dejado de ser necesarios para la finalidad educativa o cuando revoque su consentimiento.</li>
        </ul>
      </section>

      <section class="privacidad-seccion">
        <h2>4. Contacto y Ejercicio de Derechos</h2>
        <p>
          Para ejercer sus derechos de acceso, rectificación, eliminación o ante cualquier inquietud sobre el tratamiento de sus datos personales, puede comunicarse con el canal oficial de atención:
        </p>
        <p>
          <strong>Correo de contacto:</strong> <a href="mailto:privacidad@unemi.edu.ec">privacidad@unemi.edu.ec</a>
        </p>
      </section>

      <div class="fila fila--s" style="margin-top: var(--espacio-l); border-top: 1px solid var(--borde); padding-top: var(--espacio-m);">
        <a href="/paginas/registro.html" class="btn btn--primario">Volver al Registro</a>
        <a href="/index.html" class="btn btn--secundario">Ir al Inicio</a>
      </div>
    </article>
  `;
}
