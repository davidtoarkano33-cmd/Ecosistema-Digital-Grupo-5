// publico/js/nucleo/menu.js · Definición de enlaces del menú
export const MENU = [
  { texto: "Noticias", href: "/paginas/noticias.html", roles: ["sesion"] },
  { texto: "Canciones", href: "/paginas/canciones.html", roles: ["sesion"] },
  { texto: "Inicio", href: "/index.html", roles: ["publico"] },
  { texto: "Mi perfil", href: "/paginas/perfil.html", roles: ["sesion"] },
  { texto: "Mi progreso", href: "/paginas/mi-progreso.html", roles: ["estudiante"] },
  { texto: "Mis asignaturas", href: "/paginas/asignaturas.html", roles: ["estudiante", "docente"] },
  { texto: "Actividades", href: "/paginas/actividades.html", roles: ["estudiante", "docente"] },
  { texto: "Panel docente", href: "/paginas/panel-docente.html", roles: ["docente", "admin"] },
  { texto: "Contenidos", href: "/paginas/editor-contenidos.html", roles: ["docente", "admin"] },
  { texto: "Usuarios", href: "/paginas/admin-usuarios.html", roles: ["admin"] },
  { texto: "Asignaturas", href: "/paginas/admin-asignaturas.html", roles: ["admin"] },
  { texto: "Distributivo", href: "/paginas/distributivo.html", roles: ["admin"] }
];

export default MENU;
