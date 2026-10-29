// publico/js/nucleo/menu.js · Definición de enlaces del menú
export const MENU = [
  { texto: "Inicio", icono: "inicio", href: "/index.html", roles: ["publico"], destacado: true },
  { texto: "Actividades", icono: "actividades", href: "/paginas/actividades.html", roles: ["estudiante", "docente", "admin"] },
  { texto: "Tutor socrático", icono: "tutor", href: "/paginas/tutor.html", roles: ["estudiante"], destacado: true },
  { texto: "Agenda", icono: "agenda", href: "/paginas/agenda.html", roles: ["sesion"] },
  { texto: "Asignaturas", icono: "asignaturas", href: "/paginas/admin-asignaturas.html", roles: ["admin"] },
  { texto: "Autores y créditos", icono: "autores", href: "/paginas/creditos.html", roles: ["publico"], destacado: true },
  { texto: "Banco de preguntas", icono: "preguntas", href: "/paginas/banco-preguntas.html", roles: ["docente", "admin"] },
  { texto: "Canciones", icono: "canciones", href: "/paginas/canciones.html", roles: ["sesion"] },
  { texto: "Configuración IA", icono: "configuracion", href: "/paginas/admin-ia.html", roles: ["admin"] },
  { texto: "Contenidos", icono: "contenidos", href: "/paginas/editor-contenidos.html", roles: ["docente", "admin"] },
  { texto: "Distributivo", icono: "distributivo", href: "/paginas/distributivo.html", roles: ["admin"] },
  { texto: "Foros", icono: "foros", href: "/paginas/foros.html", roles: ["sesion"] },
  { texto: "Glosario general", icono: "glosario", href: "/recursos/documentos/glosario-general-semiologia-atencion-prehospitalaria.pdf", roles: ["publico"], nuevaPestana: true },
  { texto: "Mensajes", icono: "mensajes", href: "/paginas/mensajes.html", roles: ["sesion"] },
  { texto: "Mi perfil", icono: "perfil", href: "/paginas/perfil.html", roles: ["sesion"] },
  { texto: "Mi progreso", icono: "progreso", href: "/paginas/mi-progreso.html", roles: ["estudiante"] },
  { texto: "Mis asignaturas", icono: "mis-asignaturas", href: "/paginas/asignaturas.html", roles: ["estudiante", "docente"], destacado: true },
  { texto: "Noticias", icono: "noticias", href: "/paginas/noticias.html", roles: ["sesion"] },
  { texto: "Panel docente", icono: "docente", href: "/paginas/panel-docente.html", roles: ["docente", "admin"] },
  { texto: "Reportes", icono: "reportes", href: "/paginas/admin-reportes.html", roles: ["admin"] },
  { texto: "Simulaciones", icono: "simulaciones", href: "/paginas/simulaciones.html", roles: ["sesion"] },
  { texto: "Usuarios", icono: "usuarios", href: "/paginas/admin-usuarios.html", roles: ["admin"] }
];

export default MENU;
