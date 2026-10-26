# docs/estado.md · Estado del proyecto (máximo 30 líneas)
Sprint terminado: S07 · Fecha: 2026-10-25 · Velocidad real: 3/3 tareas

## Funciona
- Servicio de IA: Gemini por `fetch` nativo, clave solo en servidor, límite diario, consumo sin textos, timeout, validación JSON y reintento.
- Prueba administrativa de IA operativa con modelo configurable mediante `IA_MODELO`.
- Generación de glosario: cantidad 5–20, propuestas editables, duplicados señalados y aprobación docente antes de guardar.
- Glosario aprobado visible desde el tema y accesible directamente desde la asignatura; términos de IA identificados por origen.
- Crucigrama: generador puro con 30 órdenes, 8–12 palabras cuando el glosario lo permite, cuadrícula recortada, pistas y teclado.
- Crucigrama registra puntaje, errores, ayudas, duración, gamificación y resumen.
- Alertas de actividades: 3 o más errores actualizan la alerta activa y vuelven a notificar al docente.

## Decisiones y cambios respecto a docs/contratos.md
- Proveedor elegido: Google Gemini; el modelo se mantiene exclusivamente en `.env` para poder sustituirlo sin cambiar código.
- El glosario aprobado de temas publicados es visible para cualquier sesión; la edición continúa limitada al docente asignado y admin.
- Las alertas activas se reutilizan con contador de reiteraciones para evitar duplicados en el panel.

## Problemas conocidos
- La disponibilidad y cuota de Gemini dependen del proveedor; los fallos se devuelven de forma controlada sin detener el servidor.
- Git no está instalado o disponible en `PATH` y esta carpeta aún no contiene `.git`.

## Pendiente para el siguiente sprint
- Sprint 8: banco de preguntas, motor del quiz y página del quiz con diplomas por nivel.
