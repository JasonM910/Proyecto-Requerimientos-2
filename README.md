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

## Datos

Los usuarios, perfiles, categorías, publicaciones y solicitudes de ejemplo están en [`data/db.json`](data/db.json). La API local lee ese archivo y guarda allí las ediciones. Las contraseñas se almacenan como hashes con sal; la sesión se mantiene en una cookie `HttpOnly` y se invalida al cerrar sesión.

Para probar ambos roles, selecciona una cuenta en la pantalla de inicio de sesión o usa:

| Rol | Correo | Contraseña |
| --- | --- | --- |
| Proveedor | `proveedor@hogar.test` | `Proveedor2026!` |
| Cliente | `cliente@hogar.test` | `Cliente2026!` |

Las solicitudes incluidas son datos de ejemplo para consultar el historial y comprobar la privacidad. El flujo para enviar, aceptar o cotizar solicitudes queda fuera de estas primeras tres áreas. No uses datos reales en este archivo de demostración. Para recuperar los datos iniciales, restaura `data/db.json` desde Git.
