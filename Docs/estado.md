# docs/estado.md · Estado del proyecto (máximo 30 líneas)
Sprint terminado: S12 · Fecha: 2026-10-28 · Sprint Review validada

## Funciona
- El catálogo agrupa simulaciones por tema y distingue escenarios ramificados y prácticas de rol.
- El motor de escenarios recorre decisiones, muestra consecuencias, calcula puntaje e informa el recorrido final.
- La vista previa no registra intentos ni modifica puntos o logros.
- Docentes y administradores crean borradores, editan escenas, imágenes, opciones, destinos y consecuencias.
- La publicación valida destinos, alcanzabilidad, escenas finales, ciclos, consecuencias y límites de puntos.
- El mapa indentado permite revisar visualmente las rutas antes de publicar.
- Gemini genera borradores de escenarios de 5 a 10 escenas usando el contenido autorizado del tema.
- Gemini también genera personaje, contexto, objetivo, rúbrica y turnos para prácticas de rol.
- El modo rol conversa con el personaje, limita turnos y anima al avatar al pensar y hablar.
- La evaluación de rol entrega puntos por criterio, comentario general y registra el intento del estudiante.
- Los preparadores verifican acceso, limitan el historial y no aceptan instrucciones desde el navegador.
- El servidor vuelve a validar escenarios y prácticas de rol antes de publicarlos.

## Decisiones y cambios respecto al contrato
- Se añadió la tarea generar-rol para ofrecer creación asistida también en el editor del modo rol.
- Los borradores generados por IA nunca se guardan hasta que el docente pulsa Guardar.
- Las escenas finales se representan sin opciones; las escenas de decisión requieren de 2 a 4.

## Problemas conocidos
- Las respuestas de conversación y evaluación dependen de la disponibilidad y configuración del proveedor IA.
- La voz del avatar depende de speechSynthesis y de las voces en español instaladas en el navegador.

## Pendiente
- Ningún pendiente bloqueante para cerrar el Sprint 12.
