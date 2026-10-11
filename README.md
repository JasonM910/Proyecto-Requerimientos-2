# Hogar+

Página de servicios del hogar con espacios separados para clientes y proveedores.

- Los usuarios inician sesión con correo o nombre de usuario y contraseña.
- El cliente puede editar sus datos, buscar servicios, enviar solicitudes, responder aclaraciones y aceptar propuestas.
- El proveedor puede editar su perfil, administrar publicaciones, responder solicitudes, cotizar e indicar el avance del trabajo.
- El servidor limita cada ruta al rol correspondiente. Los datos de contacto del cliente solo se muestran al proveedor cuando una solicitud está aceptada o en una etapa posterior.

## Ejecutar

```bash
npm install
npm run dev
```

Abre la dirección que muestre Vite. Para comprobar o servir la versión compilada:

```bash
npm run build
npm run preview
```

## Diseño y componentes

La interfaz utiliza **Tailwind CSS 4**, **shadcn/ui** (Radix) y **Motion**. Conserva la marca Hogar+, los fondos verdes y los espacios de cliente y proveedor.

- [`src/index.css`](src/index.css) contiene la paleta con nombres, las tipografías y la correspondencia de variables con Tailwind. La distribución y los estilos de cada vista están en sus componentes JSX.
- [`src/components/ui`](src/components/ui) contiene los componentes de shadcn: botones, tarjetas, campos, etiquetas, selectores y diálogos accesibles. Su configuración está en [`components.json`](components.json).
- [`src/components/AppShell.jsx`](src/components/AppShell.jsx) comparte el menú y la cabecera entre roles. [`src/components/page.jsx`](src/components/page.jsx) reúne encabezados, estados vacíos y notificaciones.
- Motion anima el acceso, los cambios de vista, las tarjetas y las notificaciones. La política global de [`src/main.jsx`](src/main.jsx) respeta la preferencia de movimiento reducido del dispositivo.
- Los paneles de cada rol se cargan bajo demanda para reducir el código necesario en el inicio de sesión.

Para agregar otro componente de shadcn:

```bash
npx shadcn@latest add nombre-del-componente
```

Referencias: [Tailwind con Vite](https://tailwindcss.com/docs/installation/using-vite), [shadcn con Vite](https://ui.shadcn.com/docs/installation/vite), [Motion y movimiento reducido](https://motion.dev/docs/react-motion-config).

## Verificación

```bash
npm run lint
npm run build
npm run test:e2e
```

Las pruebas de navegador requieren Google Chrome instalado. Arrancan un servidor local en el puerto `4175` con una copia temporal del JSON, comprueban ambos roles, publicaciones, perfiles, privacidad, modales y la vista móvil, y eliminan los datos de prueba al terminar. Tu archivo `data/db.json` no se modifica durante las pruebas.

### Publicación y búsqueda de servicios (alcances 4 y 5)

| Requisito | Funcionamiento |
| --- | --- |
| RF-09 | El proveedor publica título, descripción y categoría. El servidor valida los campos y guarda el servicio en JSON. |
| RF-10 | Cada proveedor puede editar y eliminar sus publicaciones. Los cambios se reflejan al consultar el catálogo. Las solicitudes conservan el título y los datos originales aunque la publicación cambie o se elimine. |
| RF-11 | El catálogo tiene dos niveles: área de servicio y categoría. El campo `group` de cada categoría en `data/db.json` define su área. El formulario agrupa las opciones y el cliente puede navegar por área, categoría y ruta de regreso. |
| RF-12 | La búsqueda combina área, categoría y zona del proveedor, muestra el total y permite limpiar los filtros. |
| RF-13 | Las palabras se buscan sin distinguir mayúsculas ni tildes. Deben coincidir todos los términos; se priorizan coincidencias en el título sobre la descripción, con información del proveedor y categoría como criterios adicionales. Los empates se ordenan por actualización reciente. |

`tests/scopes-4-5.spec.js` comprueba la publicación y sus cambios en el catálogo del cliente, validaciones, permisos, conservación del historial, navegación por categorías, filtros combinados, resultados vacíos y orden por relevancia. Cada caso restaura su copia temporal de los datos al terminar.

### Solicitudes y seguimiento (alcance 6)

El cliente abre un servicio y envía la descripción del trabajo, la urgencia y una zona general. La solicitud aparece en el panel del proveedor, con un contador de solicitudes pendientes que se actualiza mientras la página está abierta. El proveedor puede pedir una aclaración, aceptar preliminarmente o enviar una cotización con monto estimado en colones. El cliente responde las aclaraciones y acepta una propuesta. Después el proveedor marca el trabajo como en proceso y finalizado. Ambas partes ven una cronología con fechas y mensajes.

La aceptación del cliente habilita sus datos de contacto para ese proveedor; antes de ello la API no los incluye en su respuesta. Los mensajes previos a la aceptación rechazan correos, teléfonos y enlaces. El monto es una estimación simple: el desglose de costos, pagos y comprobantes corresponden al alcance 7. La notificación al proveedor ocurre dentro de la aplicación; se actualiza cada 15 segundos o al volver a la pestaña. No se envían correos ni avisos externos.

`tests/scopes-6.spec.js` recorre el flujo completo entre cliente y proveedor y verifica validaciones, permisos, privacidad, transiciones y persistencia. Las solicitudes iniciales permanecen como ejemplos de historial.

## Datos

Los usuarios, perfiles, categorías, publicaciones y solicitudes de ejemplo están en [`data/db.json`](data/db.json). La API local lee ese archivo y guarda allí las ediciones. Las contraseñas se almacenan como hashes con sal; la sesión se mantiene en una cookie `HttpOnly` y se invalida al cerrar sesión.

Para probar ambos roles, selecciona una cuenta en la pantalla de inicio de sesión o usa:

| Rol | Correo | Contraseña |
| --- | --- | --- |
| Proveedor | `proveedor@hogar.test` | `Proveedor2026!` |
| Cliente | `cliente@hogar.test` | `Cliente2026!` |
| Laura Jiménez | `laura@hogar.test` | `Proveedor2026!` |
| Andrés Solís | `andres@hogar.test` | `Proveedor2026!` |
| Marta Rojas | `marta@hogar.test` | `Proveedor2026!` |

No uses datos reales en este archivo de demostración. Para recuperar los datos iniciales, restaura `data/db.json` desde Git.
