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
| `no-hardcoded-business-text` | sin marcas, ciudades ni precios del dataset en `apps/*/src` |
| `no-secrets` | sin credenciales reconocibles en archivos versionados |
| `traceability` | `docs/trazabilidad.md` apunta a secciones reales con estados válidos |
| `progress-evidence` | filas `hecho` de `ops/state/PROGRESS.md` con evidencia |
| `validation-at-edges` | `safeParse` presente en control-plane, station-agent y clientes de kiosk/admin |
| `docs-present-tense` | sin "antes era", "anteriormente", "previously", "used to" en docs |
| `catalog-complete` | features, capacidades, permisos, claves de config, apps, paquetes y compuertas registrados |
| `typecheck` | paquetes (quick) o todo (full) |
| `unit-tests` | packages y tools (quick) o todo (full) |
| `build-apps` | kiosk y admin construyen (full) |

Agregar una compuerta: crear el objeto `Gate` en `src/gates.ts`, añadirlo a `ALL_GATES`; el catálogo la recoge solo.

## Cómo se prueba
```bash
pnpm --filter @psp/gates typecheck
pnpm gate:quick
```
