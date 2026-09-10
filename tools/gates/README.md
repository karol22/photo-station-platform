# @psp/gates

## Propósito
Compuertas sobre hechos: cada una comprueba algo verificable y bloquea si no se cumple. Son la definición ejecutable de las reglas de `AGENTS.md` §3. Lo que es criterio (no hecho) no vive aquí sino en documentos.

## Cómo se usa
```bash
pnpm gate:quick                 # compuertas + typecheck y pruebas de packages/tools (segundos)
pnpm gate:full                  # además apps: typecheck, pruebas y build
pnpm gate:quick -- readmes i18n-parity   # sólo algunas, por clave
```
Salida: una línea por compuerta con ✅/❌ y mensajes; código de salida 1 si alguna falla.

| Clave | Hecho que comprueba |
|---|---|
| `agents-size` | `AGENTS.md` < 12 000 caracteres |
| `readmes` | README con `Propósito`, `Cómo se usa`, `Cómo se prueba` en cada paquete y app |
| `i18n-parity` | mismas claves es/en en `@psp/i18n` y en `src/i18n/extra.ts` de las apps |
| `no-hardcoded-business-text` | sin marcas, ciudades ni precios del dataset en `apps/*/src` (patrones en `FORBIDDEN_BUSINESS_TEXT`) |
| `no-secrets` | sin credenciales reconocibles en archivos versionados |
| `traceability` | `docs/trazabilidad.md` apunta a secciones reales con estados válidos |
| `progress-evidence` | filas `hecho` de `ops/state/PROGRESS.md` con evidencia |
| `validation-at-edges` | `safeParse` presente en control-plane, station-agent y clientes de kiosk/admin |
| `docs-present-tense` | los documentos no contienen frases de bitácora (la lista vive en `src/gates.ts`) |
| `catalog-complete` | features, capacidades, permisos, claves de config, apps, paquetes y compuertas registrados |
| `typecheck` | paquetes (quick) o todo (full) |
| `unit-tests` | packages y tools (quick) o todo (full) |
| `build-apps` | kiosk y admin construyen (full) |

Agregar una compuerta: crear el objeto `Gate` en `src/gates.ts`, añadirlo a `ALL_GATES`; el catálogo la recoge solo.

La marca real del cliente (**Una de Todos**) se busca como nombre propio (`Una de Todos`, `UNA DE TODOS`)
y como identificador (`unadetodos.demo`, `org_una_de_todos`), nunca como frase suelta en minúsculas:
«¡Qué buena una de todos!» es el copy del paso 4 del recorrido (`docs/producto/01-flujo-de-sesion.md`)
y vive en el catálogo de traducción del kiosco. Un patrón que ignore las mayúsculas convierte ese copy
en un hallazgo falso y empuja a reescribir el texto del producto para callar la compuerta.

## Cómo se prueba
```bash
pnpm --filter @psp/gates typecheck
pnpm --filter @psp/gates test
pnpm gate:quick
```

`src/gates.test.ts` fija el comportamiento de `FORBIDDEN_BUSINESS_TEXT`: qué formas de marca, ciudad y
precio se marcan y qué copy del producto pasa. El resto de las compuertas se comprueba corriéndolas.
