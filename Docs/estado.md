# docs/estado.md · Estado del proyecto (máximo 30 líneas)
Sprint terminado: S10 · Fecha: 2026-10-26 · Review aprobada

## Funciona
- Mensajería privada entre contactos autorizados según rol, grupos y configuración institucional.
- Conversaciones con historial paginado, enlaces seguros, lectura y contador de no leídos.
- Los mensajes nuevos aparecen en menos de cinco segundos mientras la pestaña está visible.
- La interfaz se adapta a una sola columna en celular y permite volver a la bandeja.
- Docentes pueden difundir un mensaje a todos los estudiantes de uno de sus grupos.
- Los usuarios pueden bloquear, desbloquear y reportar mensajes recibidos.
- Los bloqueos se aplican en ambos sentidos y el servidor impide nuevos envíos.
- Administradores revisan el mensaje reportado y los cinco anteriores como contexto.
- Moderación permite ocultar el mensaje, desactivar al autor o descartar el reporte.
- Permisos, límites de envío y escape de texto se aplican en el servidor y navegador.

## Decisiones y cambios respecto a docs/contratos.md
- Las conversaciones informan si el bloqueo pertenece al usuario o al contacto para controlar la interfaz.
- El sondeo usa control de caché y solapa un segundo para no perder mensajes con fechas cercanas.
- Ocultar o desactivar desde moderación también marca el reporte como resuelto.

## Problemas conocidos
- La actualización en vivo usa sondeo cada cuatro segundos, no conexiones persistentes.
- Las notificaciones del navegador dependen del permiso concedido por el usuario.

## Pendiente para el siguiente sprint
- Ejecutar las tareas del Sprint 11 según la guía del producto.
