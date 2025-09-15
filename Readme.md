### Retos
## Reto 1 
- Investigue diferentes sistemas para el envío de notificaciones por diferentes canales (Email, SMS, ... ) y seleccione uno.
- Verifique que sea viable su integración con otros servicios.
- Despliegue en un contenedor con el sistema seleccionado dentro del docker compose usado para la autenticación.

## Reto 2
- Investigue diferentes sistemas de gestión de mensajes y seleccione uno (http://landscape.cncf.io/).
- Despliegue un contenedor con el sistema seleccionado dentro del docker compose usado para la autenticación.

## Reto 3 y 4
- Configure, o cambie su sistema de autenticación para que permita la generación de al menos uno de los siguientes eventos:
  - Se registra un nuevo usuario.
  - Se realiza autenticación en el sistema.
  - Se solicita la recuperación de claves.
  - Se realicen actualizaciones de claves.

- Los eventos generados deberán comunicarse de forma asíncrona haciendo uso del
bus de comunicación.

## Reto 5 
- Cree un nuevo servicio Orquestador de Notificaciones (en un proyecto independiente), el cual tendrá la responsabilidad de escuchar los diferentes eventos del sistema que debido a reglas de negocio requieran el envío de notificaciones a los diferentes usuarios. El servicio deberá seleccionar la plantilla de la notificación a enviar, el canal o los canales que deberán
usarse para la notificación y finalmente hacer la solicitud al servicio de notificaciones.
- NOTA: Las solicitudes de envío de notificaciones deberán hacerse mediante comunicación asíncrona.

- Las primeras reglas de negocio que debe tener en cuenta son:
  - Cuando se crea una nueva cuenta, se debe enviar un correo al usuario para que confirme su email y de esta forma active su cuenta.
  - Se requiere enviar notificaciones de seguridad via email y sms a los usuarios cada vez que se realiza un ingreso a sus cuentas para evitar posibles vulneraciones de seguridad.
  - Para la recuperación de claves se debe enviar un correo electrónico con el link para la recuperación.
  - Se requiere enviar notificaciones de seguridad via email y sms a los usuarios cada vez que se actualiza la clave.
