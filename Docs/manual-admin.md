# Manual del administrador

Este manual explica las tareas de configuración y supervisión reservadas al administrador.

## Cómo gestionar usuarios

1. Abre **Usuarios** y busca por nombre, apellido, correo o rol.
2. Cambia el rol o activa y desactiva cuentas según corresponda; usa **Restablecer clave** para generar una contraseña temporal.
3. Para borrar una cuenta, pulsa **Eliminar usuario y datos** y confirma. No puedes eliminar tu propia cuenta y primero debes reasignar los grupos de un docente.

## Cómo gestionar asignaturas y contenidos

1. Entra en **Asignaturas** para crear, editar o revisar las asignaturas disponibles.
2. Usa **Contenidos** para administrar unidades, temas y recursos.
3. Comprueba las relaciones antes de eliminar información que pueda estar en uso.

## Cómo configurar el distributivo

1. Abre **Distributivo** y selecciona asignatura, periodo y paralelo.
2. Asigna el docente y añade los estudiantes correspondientes.
3. Guarda y verifica que docentes y estudiantes puedan ver sus asignaturas.

## Cómo configurar la IA

1. Entra en **Configuración IA** y revisa proveedor, modelo y límites disponibles.
2. Mantén la clave únicamente en la configuración segura del servidor; nunca la publiques ni la envíes por mensajes.
3. Ejecuta la prueba del servicio y revisa el error mostrado si no responde.

## Cómo supervisar reportes

1. Abre **Reportes** y revisa el tipo, motivo y contenido relacionado.
2. Decide si corresponde ocultar el contenido, desactivar al usuario o cerrar el reporte.
3. Conserva la información necesaria para seguimiento y aplica las medidas de forma proporcional.

## Cómo apoyar la gestión académica

1. Usa **Panel docente** para consultar información académica cuando sea necesario.
2. Administra **Banco de preguntas**, **Contenidos** y **Simulaciones** con los mismos controles disponibles para docentes.
3. Utiliza **Agenda**, **Noticias**, **Foros** y **Mensajes** para comunicaciones institucionales.

## Cómo proteger y mantener la plataforma

1. Revisa periódicamente usuarios activos, permisos, reportes y funcionamiento de la IA.
2. No compartas claves administrativas ni archivos `.env`; usa una cuenta individual para cada responsable.
3. Antes de una actualización importante, comprueba que exista un respaldo reciente de `datos/` y de los archivos subidos.

## Preguntas frecuentes

1. **¿Por qué no puedo eliminar mi cuenta?** La plataforma lo impide para evitar que el sistema quede sin el administrador conectado.
2. **¿Por qué no puedo eliminar a un docente?** Primero debes reasignar o eliminar los grupos donde figura como docente.
3. **¿Qué hago si alguien olvidó su contraseña?** Usa **Restablecer clave** y entrega la contraseña temporal por un medio seguro.
4. **¿Dónde se configura Gemini?** En **Configuración IA** y en las variables privadas del servidor; la clave nunca debe guardarse en GitHub.
5. **¿Desactivar y eliminar es lo mismo?** No. Desactivar impide el acceso y conserva los registros; eliminar borra la cuenta y sus datos relacionados.
