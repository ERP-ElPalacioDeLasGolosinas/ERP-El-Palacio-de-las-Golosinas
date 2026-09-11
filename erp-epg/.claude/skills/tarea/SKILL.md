---
name: tarea
description: Ejecuta UNA tarea puntual del ERP El Palacio de las Golosinas con foco estricto, siguiendo las reglas de CLAUDE.md — contexto mínimo, alcance cerrado, cambio mínimo, validación y cierre de documentación. Usala siempre que el usuario pida trabajar sobre algo concreto del proyecto: arreglar un bug, agregar o cambiar una pantalla, tocar una función `fn_*` o una migración, implementar una historia de usuario (A-05, S-04, C-07…) o una tarea de NEXT_ACTIONS (S2-1, TEC-2…), incluso si no dice "tarea" ni invoca el comando. También cuando pida "hacé solo esto y nada más", "sin tocar otra cosa" o "enfocate en X".
---

# Tarea enfocada

Ejecutás **una sola tarea**, la que el usuario pida, de punta a punta y sin desviarte.

El valor de esta skill no está en hacer más cosas, sino en hacer exactamente la pedida: abrir poco
contexto, cambiar poco código, y dejar la documentación al día. En este proyecto el contexto es
caro y la base de datos es compartida, así que la disciplina de foco es lo que evita romper el
trabajo de los demás.

Las reglas de `CLAUDE.md` mandan siempre. Esto es cómo aplicarlas paso a paso.

---

## Fase 1 · Encuadre (antes de abrir nada)

1. Leé `docs/CURRENT_STATE.md` y `docs/NEXT_ACTIONS.md`. Nada más todavía.
2. Escribí para vos mismo, en una o dos líneas: **qué se pide, qué NO se pide.**
3. Fijate si la tarea ya está descripta en `NEXT_ACTIONS.md` (`S2-x`, `TEC-x`) o corresponde a una
   historia del backlog (`A-05`, `S-04`, `C-07`…). Si es así, usá ese ID: ya trae objetivo,
   criterios de finalización y archivos probables, y te ahorra investigar de cero.
4. Usá `docs/PROJECT_MAP.md` para saber **qué abrir**. No recorras el repositorio.

Decí en una línea qué entendiste que hay que hacer y arrancá. No pidas confirmación para tareas
claras: la confirmación se reserva para los casos de la sección "Cuándo frenar".

## Fase 2 · Investigación dirigida

Buscá por símbolo, ruta, tabla, función o componente. Nunca leas carpetas enteras ni archivos
completos "por las dudas".

- Frontend: `src/app/(main)/…/page.js` para la pantalla, `src/lib/<dominio>/actions.js` para las
  llamadas RPC, `src/lib/<dominio>/errores.js` para los mensajes, `src/components/<dominio>/` para
  la UI.
- Base de datos: **el esquema real es la fuente de verdad, no `supabase/migrations/`**, que está
  incompleto. Consultá la base (MCP de Supabase) para ver columnas, funciones, triggers y políticas
  antes de asumir nada.
- Reglas de negocio: `docs/CONTEXT_PROY.md`, **solo la sección que corresponde**.
- Si algo del código contradice la documentación, gana el código. Anotalo, no lo "arregles" de
  paso.

Parás de investigar cuando podés nombrar los archivos que vas a tocar y explicar el flujo actual.
Si para seguir necesitás abrir mucho contexto no relacionado, es señal de que te falta una búsqueda
más específica, no más lectura.

## Fase 3 · Cambio mínimo

Antes de escribir código, tené claro cuál es el cambio más chico que cumple la tarea.

- Reutilizá los patrones que ya existen (server action que envuelve un `fn_*`, mapeo de códigos de
  error, clases `.palacio-*`). Copiar el patrón vigente vale más que inventar uno mejor.
- No agregues dependencias si se puede resolver con las que hay.
- Si el mismo problema ya está resuelto en otro dominio, seguilo en lugar de escribir algo nuevo.

## Fase 4 · Implementación

Tocá únicamente los archivos que identificaste. Si en el camino aparece algo roto, feo o duplicado
que no forma parte de la tarea, **no lo toques**: anotalo para el informe final.

Para la base de datos, además:

- Los cambios de esquema van por migración.
- Antes de modificar o ejecutar una función o un trigger existente, explicá brevemente qué hace hoy,
  qué problema tiene, qué cambia, cómo queda y qué efectos secundarios puede tener.
- Nada destructivo o irreversible sin decirlo explícitamente y esperar respuesta. Borrar una tabla,
  columna, constraint, función, trigger, dato o política como efecto colateral de otra cosa no es
  una opción.

## Fase 5 · Validación

Validá lo que tocaste, no todo el proyecto. En este repo no hay tests ni typecheck: la validación
real es `npm run lint` y, si el cambio afecta el render, `npm run build`.

```bash
npm run lint
```

Si tocaste base de datos, verificá el resultado contra la base (que la función exista con la firma
esperada, que la política esté, que el dato quedó como corresponde), no contra lo que creés que
hiciste.

Si algo falla, primero determiná si el fallo tiene que ver con tu cambio antes de tocar nada más.

## Fase 6 · Cierre

Actualizá solo lo que cambió de verdad, sin duplicar información entre documentos:

1. `docs/CURRENT_STATE.md` — solo si cambió el estado real del proyecto.
2. `docs/NEXT_ACTIONS.md` — borrá la tarea si quedó terminada; dejá clara la próxima acción.
3. `docs/DECISIONS.md` — solo si se tomó una decisión con valor futuro (nuevo `D-xxx`).
4. `docs/SESSION_LOG.md` — una entrada breve: fecha, objetivo, cambios, archivos, problemas,
   resultado, próximo paso.

Cerrá con un informe corto:

- **Qué se hizo** (una o dos líneas).
- **Archivos tocados.**
- **Cómo se validó** y con qué resultado real. Si algo falló o quedó sin verificar, decilo.
- **Fuera de alcance**: lo que encontraste y no tocaste, para que el usuario decida.

---

## Cuándo frenar y preguntar

Frená y consultá — no elijas por tu cuenta — cuando:

- La tarea depende de una **decisión de negocio** (¿el signo de un tipo de movimiento debe ser
  inmutable?, ¿qué rol cubre tesorería?, ¿el comprobante es entidad nueva o extiende `compra`?).
- El cambio es **destructivo o irreversible** en la base compartida.
- Dos lecturas razonables del pedido llevan a trabajos distintos.
- Descubrís que la tarea es en realidad tres tareas: proponé el corte antes de empezar.

En el resto de los casos, asumí el criterio más conservador, dejalo dicho y seguí.

## Qué no hacer

- Refactors, renombres, limpiezas o mejoras "de paso".
- Ampliar el alcance porque el código de al lado lo pedía a gritos.
- Leer `docs/CONTEXT_PROY.md` entero, `docs/archive/`, o todos los scripts.
- Releer un archivo que ya leíste en la sesión, salvo que haya cambiado.
- Repetir en la respuesta bloques de código que ya existen o explicar línea por línea.
- Dar por terminada la tarea sin validar, o decir que algo anda sin haberlo comprobado.
