# Hogar+

Página de servicios del hogar con espacios separados para clientes, proveedores y el equipo de revisión.

- Los usuarios inician sesión con correo o nombre de usuario y contraseña.
- El cliente puede editar sus datos, buscar servicios, enviar solicitudes, responder aclaraciones y aceptar propuestas.
- El proveedor puede editar su perfil, administrar publicaciones, responder solicitudes, cotizar e indicar el avance del trabajo.
- El equipo de Hogar+ revisa solicitudes de verificación e incidentes desde su propia bandeja.
- El servidor limita cada ruta al rol correspondiente. El contacto y las indicaciones exactas del cliente solo se muestran al proveedor cuando acepta una propuesta.

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
- [`src/components/InlineValidation.jsx`](src/components/InlineValidation.jsx) muestra los errores bajo cada campo, marca los campos incorrectos y lleva el foco al primero que requiere corrección. Los formularios de acceso y perfiles mantienen sus validaciones específicas con el mismo estilo.
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
npm run test:capturas
```

Las pruebas de navegador requieren Google Chrome instalado. Arrancan un servidor local en el puerto `4175` con una copia temporal del JSON, comprueban los tres roles, publicaciones, perfiles, solicitudes, privacidad, cotizaciones, reportes, rendimiento local y la vista móvil, y eliminan los datos de prueba al terminar. Tu archivo `data/db.json` no se modifica durante las pruebas.

La prueba de capturas guarda imágenes de los recorridos principales en `test-results/capturas/`. También se ejecuta con `npm run test:e2e`. Playwright borra `test-results/` al iniciar una nueva ejecución y guarda capturas adicionales de las pruebas que fallen.

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

El cliente abre un servicio y envía la descripción del trabajo, la urgencia y una zona general elegida de las zonas del proveedor. Puede agregar indicaciones privadas para llegar. La solicitud aparece en el panel del proveedor, con un contador de solicitudes pendientes que se actualiza mientras la página está abierta. El proveedor puede pedir una aclaración, aceptar preliminarmente o enviar una cotización en colones. El cliente responde las aclaraciones y acepta una propuesta. Después el proveedor marca el trabajo como en proceso y finalizado. Ambas partes ven una cronología con fechas y mensajes.

La aceptación del cliente habilita sus datos de contacto y sus indicaciones privadas para ese proveedor; antes de ello la API no los incluye en su respuesta. Los mensajes previos a la aceptación rechazan correos, teléfonos y enlaces. La notificación al proveedor ocurre dentro de la aplicación; se actualiza cada 15 segundos o al volver a la pestaña. No se envían correos ni avisos externos.

`tests/scopes-6.spec.js` recorre el flujo completo entre cliente y proveedor y verifica validaciones, permisos, privacidad, transiciones y persistencia. Las solicitudes iniciales permanecen como ejemplos de historial.

### Cotizaciones y pagos (alcance 7)

El proveedor desglosa mano de obra, materiales y otros conceptos; el cliente puede pedir ajustes, hacer una contraoferta, aceptar o rechazar. El panel financiero muestra cotizaciones y montos acordados, pagados y pendientes, con filtros de periodo. Los pagos se registran dentro de la aplicación y, al finalizar el trabajo, ambas partes pueden abrir el comprobante digital. Son registros de demostración: no se procesa dinero real. `tests/scopes-7.spec.js` comprueba estos flujos y sus permisos.

### Seguridad y confianza (alcance 8)

El proveedor solicita la verificación desde «Seguridad y confianza» cuando ha completado los datos requeridos. La cuenta «Equipo Hogar+» revisa la identificación y la referencia del documento, y aprueba o rechaza la solicitud. La insignia pública aparece solo mientras el perfil está verificado; un cambio en los datos de identidad la retira hasta una nueva revisión. La referencia del documento es texto de demostración; este flujo no permite subir archivos.

Clientes y proveedores pueden enviar reportes generales o asociados a una solicitud; los clientes también pueden reportar un perfil. El equipo recibe los casos en su bandeja, registra su revisión y los resuelve. El autor ve el historial del caso en «Seguridad y confianza». `tests/scopes-8.spec.js` comprueba el acceso por rol, las decisiones y la privacidad del contacto y de las indicaciones de llegada.

### Imágenes de muestra y evidencias (RF-24)

El proveedor puede adjuntar hasta tres fotos JPG o PNG al crear o editar un servicio y una foto pública a su perfil. El cliente puede adjuntar hasta tres fotos a una solicitud; ambas partes las ven en el seguimiento. Al tocar una miniatura en los detalles, en una solicitud o antes de guardar, se abre una vista ampliada; si hay varias fotos, se pueden recorrer con los botones o las flechas del teclado. Cada archivo de entrada puede pesar hasta 3 MB. El servidor comprueba el contenido, reduce las dimensiones, comprime la imagen y elimina sus metadatos antes de guardarla como Base64 en `data/db.json`. Esta solución está pensada para la demo y el archivo crecerá con cada foto. Las fotos de la solicitud son visibles para el proveedor desde que la recibe; el formulario recuerda evitar datos personales visibles en ellas. `tests/rf-24.spec.js` y `tests/nonfunctional.spec.js` comprueban la carga, visualización, persistencia, compresión y validación de formatos.

### Asistente guiado (RF-25)

En «Buscar servicios», el cliente puede abrir «Ayúdame a elegir». El asistente pregunta por el área del hogar, el tipo de ayuda, el problema y la urgencia. Con esas respuestas sugiere una categoría disponible y prepara una descripción editable. Al aceptar la sugerencia, filtra el catálogo y completa la descripción y la urgencia del formulario de solicitud; el cliente puede revisarlas antes de enviarla. Las recomendaciones siguen reglas locales y no requieren un servicio externo de inteligencia artificial. `tests/rf-25.spec.js` comprueba el recorrido, la persistencia de la solicitud y el uso en móvil.

## Requisitos no funcionales

| Requisito | Implementación y comprobación |
| --- | --- |
| RNF-01 | Los seis usuarios de demostración tienen hash scrypt con sal aleatoria y parámetros `N=32768, r=8, p=3`; no se guarda la contraseña en claro. |
| RNF-02 | La sesión en cookie `HttpOnly` expira tras 30 minutos sin interacción. Las consultas automáticas no renuevan su vencimiento; la interfaz cierra la sesión y muestra un aviso. |
| RNF-03 | Las respuestas públicas excluyen contacto, dirección exacta, identificación y cuenta bancaria. La API exige rol y oculta las indicaciones privadas al proveedor hasta aceptar el trabajo. |
| RNF-04 | Los perfiles públicos se resuelven desde un índice en memoria; la prueba hace 100 consultas simultáneas y comprueba el límite local de 1,5 segundos. |
| RNF-05 | Eliminar una publicación marca `status: inactive` y `deletedAt`; desaparece del catálogo, pero se conserva en JSON junto con las solicitudes históricas. |
| RNF-06 | La búsqueda usa un índice de trigramas sobre título, descripción y datos públicos del proveedor. La prueba verifica 100 búsquedas simultáneas dentro de 2 segundos en el servidor local. |
| RNF-07 | Las mutaciones se serializan en el proceso de la API y se guardan mediante archivo temporal y sustitución atómica; una prueba envía dos cambios de estado simultáneos y comprueba que solo uno se aplica. |
| RNF-08 | El servidor valida dos decimales y calcula conceptos, impuestos y saldos con céntimos enteros; multiplicaciones y redondeos usan `BigInt`. Cotizaciones, aprobaciones y pagos conservan fecha, actor y versión o referencia. |
| RNF-09 | Los reportes y notas administrativas rechazan marcado y caracteres de control. Los casos guardan estado, fecha, autor de revisión e historial. |
| RNF-10 | El servidor acepta únicamente JPEG/PNG válidos de hasta 3 MB, comprime fotos de perfiles, publicaciones y solicitudes, limita dimensiones y elimina metadatos. |

`tests/nonfunctional.spec.js` prueba estas garantías. Las metas de 1,5 y 2 segundos se verifican en la máquina local de pruebas; no garantizan esos tiempos en cualquier equipo o volumen de datos. El JSON sigue siendo una base de demostración: el índice y la cola de escritura viven en un solo proceso, por lo que no sustituyen índices relacionales ni transacciones ACID entre varios servidores. Para un despliegue con varias instancias se necesita una base transaccional y almacenamiento externo para imágenes.

## Datos

Los usuarios, perfiles, categorías, publicaciones y solicitudes de ejemplo están en [`data/db.json`](data/db.json). La API local lee ese archivo y guarda allí las ediciones. Las contraseñas se almacenan como hashes con sal; la sesión se mantiene en una cookie `HttpOnly` y se invalida al cerrar sesión o al pasar 30 minutos sin actividad.

Para probar los roles, selecciona una cuenta en la pantalla de inicio de sesión o usa:

| Rol | Correo | Contraseña |
| --- | --- | --- |
| Proveedor | `proveedor@hogar.test` | `Proveedor2026!` |
| Cliente | `cliente@hogar.test` | `Cliente2026!` |
| Laura Jiménez | `laura@hogar.test` | `Proveedor2026!` |
| Andrés Solís | `andres@hogar.test` | `Proveedor2026!` |
| Marta Rojas | `marta@hogar.test` | `Proveedor2026!` |
| Equipo Hogar+ | `admin@hogar.test` | `Admin2026!` |

No uses datos reales en este archivo de demostración. Para recuperar los datos iniciales, restaura `data/db.json` desde Git.
