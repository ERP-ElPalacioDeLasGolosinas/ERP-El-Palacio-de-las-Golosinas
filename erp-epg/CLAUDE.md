# Plan de implementación — Reorganización de rutas

## Cambios

### `(deposito)/` → renombrar a `(main)/`

- `src/app/(deposito)/layout.js` → `src/app/(main)/layout.js`
- `src/app/(deposito)/page.js` → `src/app/(main)/page.js`

---

### [NEW] Rutas de Inventario — `src/app/(main)/inventario/`

- `depositos/page.js` — listado (contenido del antiguo `/deposito/page.js`)
- `depositos/nuevo/page.js`
- `depositos/[id]/editar/page.js`
- `productos/page.js` — placeholder
- `marcas/page.js` — placeholder
- `stock/page.js` — placeholder
- `movimientos/page.js` — placeholder historial
- `movimientos/nuevo/page.js` — placeholder registrar
- `movimientos/tipos/page.js` — placeholder tipos

### [NEW] Rutas de Catálogo — `src/app/(main)/catalogo/`

- `unidades-medida/page.js` — placeholder
- `rubros/page.js` — placeholder
- `categorias/page.js` — placeholder

### [NEW] Redirect de compatibilidad

- `src/app/(main)/deposito/page.js` → `redirect("/inventario/depositos")`

---

### [MODIFY] `AppShell.js`

Reemplazar array `NAV` con 3 secciones. Movimientos tiene submenú colapsable (se expande automáticamente si el pathname empieza con `/inventario/movimientos`).

```js
const NAV = [
  {
    section: "INICIO",
    items: [
      { href: "/", label: "Dashboard", icon: HomeIcon, match: (p) => p === "/" },
    ],
  },
  {
    section: "INVENTARIO",
    items: [
      { href: "/inventario/productos", label: "Productos",  icon: BoxIcon,       match: (p) => p.startsWith("/inventario/productos") },
      { href: "/inventario/marcas",    label: "Marcas",     icon: TagIcon,       match: (p) => p.startsWith("/inventario/marcas") },
      { href: "/inventario/stock",     label: "Stock",      icon: ChartIcon,     match: (p) => p.startsWith("/inventario/stock") },
      {
        label: "Movimientos", icon: ArrowsIcon,
        match: (p) => p.startsWith("/inventario/movimientos"),
        children: [
          { href: "/inventario/movimientos",       label: "Historial" },
          { href: "/inventario/movimientos/nuevo", label: "Registrar movimiento" },
          { href: "/inventario/movimientos/tipos", label: "Tipos de movimiento" },
        ],
      },
      { href: "/inventario/depositos", label: "Depósitos",  icon: WarehouseIcon, match: (p) => p.startsWith("/inventario/depositos") },
    ],
  },
  {
    section: "CATÁLOGO",
    items: [
      { href: "/catalogo/unidades-medida", label: "Unidades de medida", icon: RulerIcon,  match: (p) => p.startsWith("/catalogo/unidades-medida") },
      { href: "/catalogo/rubros",          label: "Rubros",             icon: FolderIcon, match: (p) => p.startsWith("/catalogo/rubros") },
      { href: "/catalogo/categorias",      label: "Categorías",         icon: ListIcon,   match: (p) => p.startsWith("/catalogo/categorias") },
    ],
  },
];
```

Agregar iconos SVG inline: `HomeIcon`, `BoxIcon`, `TagIcon`, `ChartIcon`, `ArrowsIcon`, `RulerIcon`, `FolderIcon`, `ListIcon`.

---

### [MODIFY] `middleware.js` — `REGLAS_POR_RUTA`

Eliminar la regla de `/deposito`:

```js
const REGLAS_POR_RUTA = [
  { prefijo: "/compras",  roles: ["Empleado Compras", "Gerente"] },
  { prefijo: "/ventas",   roles: ["Empleado Ventas",  "Gerente"] },
  { prefijo: "/gerencia", roles: ["Gerente"] },
];
```

---

### [MODIFY] `src/app/(main)/page.js`

Actualizar tarjetas del dashboard con links a `/inventario/...` y `/catalogo/...`.
