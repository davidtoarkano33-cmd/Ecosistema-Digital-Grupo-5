# docs/estado.md · Estado del proyecto (máximo 30 líneas)
Sprint terminado: S11 · Fecha: 2026-10-27 · Review validada

## Funciona
- Tutor IA socrático por tema con acceso validado, contexto curricular, historial reciente y límite diario.
- La interfaz del tutor ofrece preguntas guía, chat accesible, límite 429 y conversaciones nuevas en memoria.
- Canelo aparece como identidad del tutor y avatar guía en tutor y juegos, con voz, estados y movimiento reducido.
- Silenciar y ocultar se recuerdan; un control permite volver a mostrar a Canelo tras recargar.
- El tutor cambia a pensando durante la consulta, habla al responder y celebra insignias nuevas.
- El panel docente muestra los cinco temas más consultados y las consultas por estudiante.
- El historial textual requiere autorización del estudiante y solo lo revisan su docente de grupo o un admin.
- El estudiante puede revocar futuras autorizaciones y borrar todo su historial compartido.
- Mensajería muestra avatares actuales del emisor y receptor; los cambios de foto se reflejan al recargar.
- Ahorcado admite palabras de 4 a 14 letras y el glosario semilla fue corregido al español.

## Decisiones y cambios respecto al contrato
- Por decisión del Product Owner se añadió revisión educativa opcional del historial, con retención de 90 días.
- Se documentaron la consulta con historial, su borrado, la colección historial-tutor y la retención configurable.
- Canelo usa una imagen dentro del SVG del avatar para conservar una sola pieza visual y sus estados CSS.

## Problemas conocidos
- Las conversaciones previas a la autorización no se almacenan ni pueden recuperarse.
- La voz depende de speechSynthesis y de las voces en español instaladas en el navegador.
- Los registros vencidos se filtran al consultar y se eliminan físicamente al guardar un nuevo historial.

## Pendiente
- Ningún pendiente bloqueante para cerrar el Sprint 11.
