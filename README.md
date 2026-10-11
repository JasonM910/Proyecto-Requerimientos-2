# Hogar+

Página de servicios del hogar con espacios separados para clientes y proveedores.

- Los usuarios inician sesión con correo o nombre de usuario y contraseña.
- El cliente puede editar sus datos, consultar el historial de solicitudes y buscar servicios.
- El proveedor puede editar su perfil público y sus datos privados, consultar solicitudes recibidas y administrar sus publicaciones.
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

## Datos

Los usuarios, perfiles, categorías, publicaciones y solicitudes de ejemplo están en [`data/db.json`](data/db.json). La API local lee ese archivo y guarda allí las ediciones. Las contraseñas se almacenan como hashes con sal; la sesión se mantiene en una cookie `HttpOnly` y se invalida al cerrar sesión.

Para probar ambos roles, selecciona una cuenta en la pantalla de inicio de sesión o usa:

| Rol | Correo | Contraseña |
| --- | --- | --- |
| Proveedor | `proveedor@hogar.test` | `Proveedor2026!` |
| Cliente | `cliente@hogar.test` | `Cliente2026!` |

Las solicitudes incluidas son datos de ejemplo para consultar el historial y comprobar la privacidad. El flujo para enviar, aceptar o cotizar solicitudes queda fuera de estas primeras tres áreas. No uses datos reales en este archivo de demostración. Para recuperar los datos iniciales, restaura `data/db.json` desde Git.
