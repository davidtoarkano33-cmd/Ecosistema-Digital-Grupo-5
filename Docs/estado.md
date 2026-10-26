# docs/estado.md · Estado del proyecto (máximo 30 líneas)
Sprint terminado: S08 · Fecha: 2026-10-25 · Velocidad real: 3/3 tareas

## Funciona
- Banco docente de preguntas por tema y cinco niveles de Bloom, con creación manual, edición, contadores y propuestas IA aprobables.
- Permisos y ganchos impiden que estudiantes lean preguntas o sesiones; cada docente solo gestiona sus asignaturas.
- Tres temas disponen de 20 preguntas aprobadas por nivel: 300 preguntas conservadas también en la semilla.
- Motor del quiz: progresión por nivel, preguntas no vistas, reutilización de las más antiguas y aviso diario por banco insuficiente.
- Las respuestas se guardan una vez; el cliente nunca recibe soluciones antes de responder y completar usa texto normalizado.
- La finalización calcula porcentaje, repaso, puntos, insignias, alertas y el máximo nivel aprobado.
- Página estudiantil con cinco tarjetas, pregunta por turno, progreso, retroalimentación, reintento y resumen.
- Cada nivel aprobado habilita diploma verificable; docentes tienen accesos para gestionar glosarios, preguntas y canciones.

## Decisiones y cambios respecto a docs/contratos.md
- Los niveles aprobados pueden repetirse para mejorar el porcentaje sin volver a bloquear la progresión.
- `quiz-sesiones` conserva fecha de fin y resumen del resultado; se documentó en el contrato.
- Los datos operativos siguen ignorados por Git; el banco inicial se versiona en `datos/semilla/preguntas.json`.
- La plantilla del tutor quedó preparada pero inactiva hasta el sprint correspondiente.

## Problemas conocidos
- La disponibilidad y cuota de Gemini dependen del proveedor; los fallos se controlan sin detener el servidor.
- El tema “Abordaje inicial” tiene contenido fuente breve, por lo que algunas preguntas pueden resultar similares.
- El historial Git comienza en Sprint 7; no existen cierres recuperables de los Sprints 0–6.

## Pendiente para el siguiente sprint
- Ejecutar las tareas del Sprint 9 según la guía del producto.
