# docs/estado.md · Estado del proyecto (máximo 30 líneas)
Sprint terminado: S09 · Fecha: 2026-10-26 · Review aprobada

## Funciona
- Agenda personal, institucional y por grupo con vistas mensual, semanal y lista.
- Fechas límite vinculadas a actividades muestran cumplimiento por estudiante.
- Recordatorios internos y del navegador se emiten una vez y quedan registrados por usuario.
- Alertas por fechas límite vencidas respetan los días de gracia y evitan duplicados por evento.
- Foros por asignatura y tema con respuestas, moderación, destacados y reportes.
- Panel administrativo de reportes para revisar y ocultar publicaciones.
- Configuración administrativa de Gemini, consulta de modelos y prueba de conexión.
- La clave de IA permanece únicamente en `.env`; nunca se guarda en datos versionables.
- Menú, permisos y ganchos aplican los roles estudiante, docente y administrador.

## Decisiones y cambios respecto a docs/contratos.md
- Las alertas vencidas guardan `referenciaId` para distinguir fechas límite del mismo tema.
- Los eventos de día completo se almacenan en UTC y FullCalendar recibe un fin exclusivo.
- Un evento docente sin grupo conserva alcance personal; solo “todos” es institucional.

## Problemas conocidos
- Los avisos nativos dependen del permiso y soporte de notificaciones del navegador.
- La disponibilidad y cuota de Gemini dependen del proveedor externo.

## Pendiente para el siguiente sprint
- Ejecutar las tareas del Sprint 10 según la guía del producto.
