# Docs/estado.md · Estado del proyecto (máximo 30 líneas)
Sprint terminado: S13 · Fecha: 2026-10-29 · Sprint Review con Product Owner validada

## Funciona
- La autenticación purga sesiones vencidas y rechaza fechas inválidas, cuentas inexistentes, inactivas o no habilitadas.
- El administrador elimina usuarios y sus datos vinculados con protecciones para la cuenta propia y grupos asignados.
- El distributivo admite varios docentes por grupo y conserva compatibilidad con `docenteId`.
- Los permisos, alertas, foros, mensajes, agenda y resúmenes reconocen a todos los docentes asignados.
- El editor propone con IA unidades y temas de una asignatura usando contexto validado por el servidor.
- La nueva interfaz incorpora imágenes educativas, navegación con iconos, créditos y autoría administrable.
- Canelo ofrece ayuda de navegación y tutoría socrática; el estudiante dispone de acceso dorado en el menú.
- Notificaciones, índice global, Canelo y menú lateral se adaptan a teléfonos desde 360 px.
- Los manuales de estudiante, docente y administrador están documentados y descargables en PDF desde Mi perfil.
- Se crearon guiones, resultados y tablero de defectos para la verificación del Sprint 13.

## Decisiones y cambios respecto al contrato
- `distributivo` añade `docentesIds`; `docenteId` conserva el primer docente para compatibilidad.
- El contenido sugerido por IA no sustituye la validación ni el guardado explícito del usuario.
- El tutor continúa limitado a temas publicados y autorizados; no se habilitaron temas libres sin contexto académico.
- Los manuales PDF se publican como recursos estáticos y Mi perfil selecciona el correspondiente al rol.

## Problemas conocidos
- Quedan 34 de 37 pruebas prioritarias E2E pendientes; no se registraron fallos bloqueantes en las ejecutadas.
- La prueba de los manuales con una persona externa está pendiente por falta de participante.
- `DEF-001` y `DEF-002` continúan registrados en el tablero de defectos.
- La generación y tutoría dependen de la disponibilidad y configuración del proveedor IA.

## Pendiente
- Ningún pendiente funcional bloquea el cierre; las verificaciones anteriores deben continuar después de la etiqueta.
