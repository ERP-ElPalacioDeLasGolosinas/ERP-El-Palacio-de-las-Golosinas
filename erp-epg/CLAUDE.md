# Logout + Persistencia de Sesión + Auto-logout por Inactividad

## Descripción

Sobre la base de autenticación ya implementada (login con Supabase SSR, middleware con protección de rutas y roles), se agrega:

1. **Server Action `logout`** — llama a `supabase.auth.signOut()` e invalida la sesión en el servidor.
2. **Componente `<LogoutButton>`** — botón cliente reutilizable que invoca la Server Action.
3. **Provider `<InactivityProvider>`** — Context client-side que detecta inactividad y cierra sesión automáticamente a los 25 minutos, con modal de aviso previo a los 24 minutos.
4. **Integración en el `RootLayout`** — el provider envuelve toda la app y solo activa los timers cuando hay sesión activa.

**Decisiones confirmadas:**
- Timeout de **25 minutos** para todos los roles por igual.
- Lógica de inactividad **solo en el cliente** (browser), sin sincronización server-side.

---

## Propuesta de cambios

### Server Action de Logout

#### [NEW] [`actions.js`](file:///c:/Proyectos/ERP-EPG/erp-epg/src/app/(auth)/logout/actions.js)
Ruta: `src/app/(auth)/logout/actions.js`

```js
"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
```

---

### Componente de Logout

#### [NEW] [`LogoutButton.jsx`](file:///c:/Proyectos/ERP-EPG/erp-epg/src/components/auth/LogoutButton.jsx)
Ruta: `src/components/auth/LogoutButton.jsx`

- Client Component (`"use client"`).
- Usa `useFormStatus` para manejar el estado `pending` durante el logout.
- Renderiza un `<form action={logout}>` con un `<button type="submit">`.
- Texto: `"Cerrar sesión"` / `"Cerrando..."` mientras pending.
- Sin estilos propios — recibe `className` como prop para ser reutilizable en cualquier navbar/sidebar.

---

### Provider de Inactividad

#### [NEW] [`InactivityProvider.jsx`](file:///c:/Proyectos/ERP-EPG/erp-epg/src/components/auth/InactivityProvider.jsx)
Ruta: `src/components/auth/InactivityProvider.jsx`

**Lógica central:**

| Constante | Valor |
|---|---|
| `TIMEOUT_MS` | `25 * 60 * 1000` (25 min) |
| `WARNING_MS` | `60 * 1000` (1 min antes = aviso en min 24) |
| Intervalo de check | `30_000` ms |

**Ciclo de vida:**
1. Al montar, se suscribe a `supabase.auth.onAuthStateChange`.
2. Si hay sesión activa → registra listeners de actividad en `window` (eventos: `mousemove`, `mousedown`, `keydown`, `scroll`, `touchstart`, `click`) con `{ capture: true, passive: true }`.
3. Cada evento reinicia el timer actualizando `lastActivityRef = Date.now()`.
4. Un `setInterval` cada 30 s evalúa el tiempo inactivo:
   - `>= TIMEOUT_MS - WARNING_MS` y `< TIMEOUT_MS` → muestra modal de aviso.
   - `>= TIMEOUT_MS` → ejecuta logout.
5. Logout: llama `supabase.auth.signOut()` (cliente browser) + `router.push("/login")`.
6. Si no hay sesión (usuario en `/login`) → no registra nada, sin efecto.
7. Al desmontar o cerrar sesión → limpia listeners e interval.

**Modal de aviso:**
- Aparece cuando restan ≤ 60 segundos.
- Muestra countdown en tiempo real (actualizado cada segundo con un `setInterval` interno).
- Botón **"Seguir conectado"**: reinicia `lastActivityRef`, cierra modal.
- Si no hay interacción y el tiempo llega a 0 → logout automático.

**Props:**
```jsx
// Sin props necesarias; timeout hardcodeado. Se puede exportar
// INACTIVITY_TIMEOUT_MS como constante para tests futuros.
<InactivityProvider>{children}</InactivityProvider>
```

---

### Integración en el Layout

#### [MODIFY] [`layout.js`](file:///c:/Proyectos/ERP-EPG/erp-epg/src/app/layout.js)
Ruta: `src/app/layout.js`

```diff
 import "./globals.css";
+import { InactivityProvider } from "@/components/auth/InactivityProvider";

 export default function RootLayout({ children }) {
   return (
     <html lang="es" className="h-full antialiased">
-      <body className="min-h-full flex flex-col">{children}</body>
+      <body className="min-h-full flex flex-col">
+        <InactivityProvider>{children}</InactivityProvider>
+      </body>
     </html>
   );
 }
```

---

### Documentación

#### [MODIFY] [`AGENTS.md`](file:///c:/Proyectos/ERP-EPG/erp-epg/AGENTS.md)

Agregar al final una nueva sección que documente:
- Archivos creados y su propósito.
- Flujo de logout manual y de auto-logout por inactividad.
- Comportamiento de la persistencia de sesión (cookies httpOnly + refresco via middleware).
- Cómo usar `<LogoutButton>` en cualquier navbar/sidebar.

---

## Estructura de archivos resultante

```
src/
  app/
    (auth)/
      login/
        actions.js       ← existente
        page.jsx         ← existente
      logout/
        actions.js       ← NUEVO
    layout.js            ← MODIFICADO (agrega InactivityProvider)
    page.js              ← sin cambios
  components/
    auth/
      LogoutButton.jsx   ← NUEVO
      InactivityProvider.jsx ← NUEVO
  lib/
    auth/
      roles.js           ← sin cambios
    supabase/
      client.js          ← sin cambios
      middleware.js      ← sin cambios
      server.js          ← sin cambios
AGENTS.md                ← MODIFICADO (nueva sección al final)
```

---

## Plan de verificación

### Pruebas manuales

| Caso | Pasos | Resultado esperado |
|---|---|---|
| Logout manual | Clic en "Cerrar sesión" | Redirect a `/login`, cookies eliminadas, botón "atrás" no recupera la sesión |
| Persistencia | Login → recargar página | Sesión se mantiene sin redirigir |
| Auto-logout (aviso) | Inactividad 24 min | Modal aparece con countdown visible |
| Cancelar aviso | Clic "Seguir conectado" en modal | Timer reiniciado, modal cerrado, sin logout |
| Auto-logout (forzado) | Ignorar modal 60 s | Logout automático + redirect a `/login` |
| Sin sesión | Navegar a `/login` | No se registran listeners, sin efecto secundario |
| Rutas protegidas | Acceder a `/` sin sesión | Redirect a `/login` vía middleware |
