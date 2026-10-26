// publico/js/nucleo/util.js · Utilidades de formato, texto, fechas y colecciones
import { escapar } from './ui.js';

export function normalizar(texto) {
  if (texto === null || texto === undefined) return '';
  let str = String(texto).trim().toUpperCase();
  // Conservar la Ñ reemplazándola temporalmente por un carácter del área de uso privado
  str = str.replace(/Ñ/g, '\uE000');
  // Quitar acentos y diéresis descomponiendo diacríticos
  str = str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  // Restaurar la Ñ
  str = str.replace(/\uE000/g, 'Ñ');
  return str;
}

export function barajar(lista) {
  if (!Array.isArray(lista)) return [];
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

export function fechaLarga(iso) {
  if (!iso) return '';
  const fecha = new Date(iso);
  if (isNaN(fecha.getTime())) return '';
  return new Intl.DateTimeFormat('es-EC', {
    dateStyle: 'long',
    timeZone: 'America/Guayaquil'
  }).format(fecha);
}

export function fechaCorta(iso) {
  if (!iso) return '';
  const fecha = new Date(iso);
  if (isNaN(fecha.getTime())) return '';
  return new Intl.DateTimeFormat('es-EC', {
    dateStyle: 'short',
    timeZone: 'America/Guayaquil'
  }).format(fecha);
}

export function fechaRelativa(iso) {
  if (!iso) return '';
  const fecha = new Date(iso);
  if (isNaN(fecha.getTime())) return '';
  const ahora = new Date();
  const difSegundos = Math.round((fecha.getTime() - ahora.getTime()) / 1000);

  const rtf = new Intl.RelativeTimeFormat('es-EC', { numeric: 'auto' });
  const absSeg = Math.abs(difSegundos);

  if (absSeg < 60) {
    return rtf.format(difSegundos, 'second');
  }
  const difMinutos = Math.round(difSegundos / 60);
  const absMin = Math.abs(difMinutos);
  if (absMin < 60) {
    return rtf.format(difMinutos, 'minute');
  }
  const difHoras = Math.round(difMinutos / 60);
  const absHoras = Math.abs(difHoras);
  if (absHoras < 24) {
    return rtf.format(difHoras, 'hour');
  }
  const difDias = Math.round(difHoras / 24);
  const absDias = Math.abs(difDias);
  if (absDias < 30) {
    return rtf.format(difDias, 'day');
  }
  const difMeses = Math.round(difDias / 30);
  const absMeses = Math.abs(difMeses);
  if (absMeses < 12) {
    return rtf.format(difMeses, 'month');
  }
  const difAnios = Math.round(difDias / 365);
  return rtf.format(difAnios, 'year');
}

export function parametro(nombre) {
  if (typeof window === 'undefined' || !window.location) return null;
  const params = new URLSearchParams(window.location.search);
  return params.get(nombre);
}

export function formatoBasico(texto) {
  if (texto === null || texto === undefined) return '';
  let seguro = escapar(texto);
  seguro = seguro.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

  const bloques = seguro.split(/\n\s*\n/);
  const partes = [];

  for (const bloque of bloques) {
    const limpio = bloque.trim();
    if (!limpio) continue;

    const lineas = limpio.split('\n');
    const tieneLista = lineas.some(l => l.trim().startsWith('- '));

    if (tieneLista) {
      let enLista = false;
      let htmlBloque = '';

      for (const linea of lineas) {
        const lineaTrim = linea.trim();
        if (lineaTrim.startsWith('- ')) {
          if (!enLista) {
            htmlBloque += '<ul>';
            enLista = true;
          }
          htmlBloque += `<li>${lineaTrim.slice(2).trim()}</li>`;
        } else {
          if (enLista) {
            htmlBloque += '</ul>';
            enLista = false;
          }
          if (lineaTrim) {
            htmlBloque += `<p>${lineaTrim}</p>`;
          }
        }
      }
      if (enLista) {
        htmlBloque += '</ul>';
      }
      partes.push(htmlBloque);
    } else {
      partes.push(`<p>${lineas.join('<br>')}</p>`);
    }
  }

  return partes.join('');
}

export default {
  normalizar,
  barajar,
  fechaLarga,
  fechaCorta,
  fechaRelativa,
  parametro,
  formatoBasico
};
