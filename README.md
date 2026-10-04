# Hogar+

Página para que un proveedor publique y administre sus servicios del hogar. Permite crear publicaciones con título, descripción y categoría, consultarlas, filtrarlas, editarlas y eliminarlas.

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

El usuario, las categorías y las publicaciones iniciales están en [`data/db.json`](data/db.json). La página obtiene los datos de la API local; al crear, editar o eliminar una publicación, el servidor actualiza ese mismo archivo. Los cambios se conservan después de recargar la página y pueden revisarse directamente en el JSON.

La aplicación utiliza por ahora un único usuario de demostración. No incluye inicio de sesión. Para recuperar los datos iniciales, restaura `data/db.json` desde Git.
