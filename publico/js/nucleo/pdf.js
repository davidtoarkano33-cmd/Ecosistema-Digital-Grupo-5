// publico/js/nucleo/pdf.js · Generación y descarga de diplomas y certificados en PDF
import { llamar } from './api.js';
import { fechaLarga } from './util.js';
import { aviso } from './ui.js';

/**
 * Carga de forma dinámica la librería jsPDF desde cdnjs si no está presente en window
 * @returns {Promise<Function>} Constructor jsPDF
 */
async function asegurarJsPDF() {
  if (typeof window !== 'undefined' && window.jspdf && window.jspdf.jsPDF) {
    return window.jspdf.jsPDF;
  }

  return new Promise((resolve, reject) => {
    const idScript = 'cdn-jspdf-lib';
    let script = document.getElementById(idScript);
    if (!script) {
      script = document.createElement('script');
      script.id = idScript;
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
      document.head.appendChild(script);
    }

    script.addEventListener('load', () => {
      if (window.jspdf && window.jspdf.jsPDF) {
        resolve(window.jspdf.jsPDF);
      } else {
        reject(new Error('jsPDF no se inicializó correctamente'));
      }
    });

    script.addEventListener('error', () => {
      reject(new Error('Error al cargar la librería jsPDF desde CDN'));
    });
  });
}

/**
 * Lee los colores del sistema de diseño desde tokens.css
 * @returns {Object} Paleta institucional
 */
function obtenerColoresSistema() {
  const estilos = getComputedStyle(document.documentElement);
  return {
    primario: estilos.getPropertyValue('--primario').trim() || '#002e45',
    secundario: estilos.getPropertyValue('--secundario').trim() || '#264763',
    acento: estilos.getPropertyValue('--acento').trim() || '#ff6900',
    fondo: estilos.getPropertyValue('--fondo').trim() || '#f5f7f8',
    texto: estilos.getPropertyValue('--texto').trim() || '#182d3e',
    textoSuave: estilos.getPropertyValue('--texto-suave').trim() || '#627586'
  };
}

/**
 * Genera y descarga un diploma en formato PDF (A4 horizontal)
 * @param {Object} opciones
 * @param {"cumplimiento"|"nivel-quiz"} opciones.tipo
 * @param {string} [opciones.temaId]
 * @param {number} [opciones.nivel]
 * @returns {Promise<{ codigo: string }>}
 */
export async function generarDiploma({ tipo, temaId, nivel } = {}) {
  // 1. Solicitar emisión al servidor
  const cert = await llamar('POST', '/api/certificados', { tipo, temaId, nivel });
  if (!cert || !cert.codigo) {
    throw new Error('No se pudo obtener el certificado');
  }

  // 2. Cargar motor jsPDF
  const jsPDF = await asegurarJsPDF();
  const colores = obtenerColoresSistema();

  // 3. Crear documento A4 horizontal (297 x 210 mm)
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  const ancho = 297;
  const alto = 210;

  // Fondo sutil
  doc.setFillColor(colores.fondo);
  doc.rect(0, 0, ancho, alto, 'F');

  // Marco exterior (azul institucional)
  doc.setDrawColor(colores.primario);
  doc.setLineWidth(2.5);
  doc.rect(10, 10, ancho - 20, alto - 20);

  // Marco interior (naranja acento institucional)
  doc.setDrawColor(colores.acento);
  doc.setLineWidth(0.8);
  doc.rect(13, 13, ancho - 26, alto - 26);

  // Cabecera institucional
  doc.setTextColor(colores.primario);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('UNIVERSIDAD ESTATAL DE MILAGRO', ancho / 2, 28, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(colores.secundario);
  doc.text('ECOSISTEMA EDUCATIVO DIGITAL', ancho / 2, 34, { align: 'center' });

  // Título del diploma
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(colores.primario);
  doc.text('DIPLOMA DE RECONOCIMIENTO', ancho / 2, 52, { align: 'center' });

  // Línea decorativa bajo el título
  doc.setDrawColor(colores.acento);
  doc.setLineWidth(1.2);
  doc.line(ancho / 2 - 45, 56, ancho / 2 + 45, 56);

  // Texto "Otorgado a"
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  doc.setTextColor(colores.textoSuave);
  doc.text('Otorgado a:', ancho / 2, 72, { align: 'center' });

  // Nombre del estudiante
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(26);
  doc.setTextColor(colores.primario);
  doc.text(cert.nombreCompleto || 'Estudiante', ancho / 2, 88, { align: 'center' });

  // Detalle del logro
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(13);
  doc.setTextColor(colores.texto);
  const textoDetalle = cert.detalle || 'Por cumplimiento destacado de las actividades académicas.';
  const lineasDetalle = doc.splitTextToSize(textoDetalle, 210);
  doc.text(lineasDetalle, ancho / 2, 108, { align: 'center' });

  // Fecha de emisión
  const fechaFormateada = cert.fecha ? fechaLarga(cert.fecha) : new Date().toLocaleDateString('es-EC');
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(11);
  doc.setTextColor(colores.textoSuave);
  doc.text(`Ecuador · ${fechaFormateada}`, ancho / 2, 134, { align: 'center' });

  // Firmas simbólicas
  doc.setDrawColor(colores.textoSuave);
  doc.setLineWidth(0.5);
  doc.line(45, 165, 115, 165);
  doc.line(182, 165, 252, 165);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(colores.texto);
  doc.text('Dirección Académica', 80, 171, { align: 'center' });
  doc.text('Coordinación de Carrera', 217, 171, { align: 'center' });

  // Pie de página con código y verificación
  const urlBase = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
  const urlVerificar = `${urlBase}/paginas/verificar.html?codigo=${encodeURIComponent(cert.codigo)}`;

  doc.setFillColor(colores.primario);
  doc.rect(13, alto - 24, ancho - 26, 11, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor('#ffffff');
  doc.text(`CÓDIGO DE CERTIFICADO: ${cert.codigo}`, 20, alto - 17);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(`Verifica la autenticidad en: ${urlVerificar}`, ancho - 20, alto - 17, { align: 'right' });

  // 4. Descargar archivo PDF
  doc.save(`diploma-${cert.codigo}.pdf`);
  aviso('¡Diploma descargado exitosamente!', 'exito');

  return { codigo: cert.codigo };
}

export default {
  generarDiploma
};
