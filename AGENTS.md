# AGENTS.md · punto de entrada único

Llegas en frío. Este archivo te dice qué leer y qué reglas cumplir. `CLAUDE.md` y `GEMINI.md` sólo apuntan aquí.

## 0. Elige el modo antes de cargar contexto

Leer es cebar: lo que acabas de leer es lo que vas a alcanzar después. Por eso cada modo tiene su lista, y también lo que **no** debe abrir.

| Modo | Cuándo | Lee | No abras |
|---|---|---|---|
| **Ejecutor** | Correr, demostrar, sembrar datos, simular flota o despliegue | `docs/producto/00-que-es.md` → `docs/operacion/como-correr.md` → `pnpm catalog` | El código de los paquetes; la maquinaria de agentes |
| **Desarrollador** | Implementar, corregir, refactorizar una capacidad del producto | `ops/ATENCION.md` → `docs/producto/00-que-es.md` → `docs/producto/03-en-que-trabajar-ahora.md` → `ops/state/PROGRESS.md` → el `README.md` del paquete que tocas → `packages/contracts/src` de lo que uses | Campañas ajenas; los estándares de `docs/estandares/` |
| **Ingeniero de agentes** | Cambiar cómo trabajan los agentes aquí: este archivo, compuertas, estado, evaluaciones, navegación | `docs/estandares/` (los dos) → `ops/POLITICA.md` → `ops/campanas/` → `tools/gates/src/gates.ts` | El código de producto, salvo lo que la falla observada señale |

Si no sabes cuál, es **desarrollador**. No mezcles ingeniería de agentes con trabajo de producto salvo que una falla repetida demuestre que el entorno es el obstáculo.

Declara el modo en la campaña.

## 1. Qué es esto

**Lee `docs/producto/00-que-es.md` y `docs/producto/03-en-que-trabajar-ahora.md` antes de suponer nada.** Mandan sobre cualquier otra fuente, incluido este archivo.

En corto: cabina de autoservicio en centro comercial, la cámara está dentro, el cliente paga ahí, no hay app ni cuenta ni contraseña, y las fotografías nunca salen de la máquina. **La máquina física todavía no existe: no trabajes en papel, impresión ni gabinete.**

Plataforma multi-tenant con cuatro apps (`control-plane`, `station-agent`, `kiosk`, `admin`) y paquetes puros compartidos. Documentación y UI en español; código e identificadores en inglés.

## 2. Prueba hermética (segundos)

```bash
pnpm gate:quick
```

Typecheck, pruebas de `packages/*` y `tools/*`, y las compuertas de hechos. Sin red, sin hardware, sin servicios. **Debe pasar antes y después de cada cambio.** `pnpm gate:full` agrega apps y construcción.

## 3. Política dura

`ops/POLITICA.md` lista lo que no se puede olvidar nunca y cómo se hace cumplir en el borde de la herramienta. Lo esencial: **nunca `git push`**, ningún proveedor externo real, ninguna fotografía fuera de la máquina, ninguna clave inventada, ningún secreto versionado, ningún texto de negocio en el código de las interfaces, y nada se declara terminado con una compuerta en rojo.

## 4. Compuertas: hechos que bloquean

En `tools/gates/`. Cada una comprueba algo verificable, no una opinión: tamaño de este archivo, README por paquete, catálogo completo, paridad de idiomas, sin texto de negocio en las interfaces, sin secretos, trazabilidad válida, evidencia en el progreso, validación en los bordes, documentación en presente, typecheck, pruebas y construcción.

Un salto deliberado se registra en la campaña con su motivo, y su resultado no se publica.

## 5. Criterio: lo lees y lo aplicas

`ops/ATENCION.md` es la lista corta que debe seguir despierta. Reléela al empezar, después de una compresión de contexto, antes de una decisión de arquitectura y antes de declarar algo terminado.

Además, siempre:

- **Contratos primero.** Cambia `packages/contracts` antes que una app. Dentro de `v1` sólo se agrega.
- **Lógica pura en `packages/`, I/O en `apps/`.** Si se puede probar sin red ni disco, va en un paquete.
- **Determinismo.** Nada de `Math.random()` ni `Date.now()` sin inyección en lógica de dominio.
- **Presente, no bitácora.** Al cambiar algo, reescribe la sección afectada.
- **Lo externo es un puerto** con adaptador simulado en `packages/integrations`.

## 6. Estado en disco, nunca en la sesión

| Archivo | Qué es |
|---|---|
| `ops/POLITICA.md` | Lo que no se olvida nunca |
| `ops/ATENCION.md` | El criterio que sigue despierto |
| `ops/campanas/` | Trabajo que no cabe en una conversación; se reescribe, no se acumula |
| `ops/state/PROGRESS.md` | Pasos con evidencia verificable |
| `ops/state/ARTIFACTS.md` | Versiones de artefactos |
| `ops/ledger/paid-calls.jsonl` | Cada llamada pagada, idempotente |
| `ops/evals/` · `ops/notes/rechazos.md` | Casos que ya no deben fallar, y por qué se rechazó algo |

Una sesión nueva retoma leyendo la campaña abierta y el progreso. Si empiezas algo, escríbelo antes de tocar código.

## 7. Cómo trabajar

1. Elige el modo. Lee su lista. Corre `pnpm gate:quick`.
2. Abre o actualiza la campaña en `ops/campanas/`.
3. Si hay incertidumbre, explora en ramas con evidencia separada antes de converger. No ataques un problema difícil de frente diez veces.
4. Contratos → paquete puro con pruebas → app → docs → catálogo → trazabilidad.
5. **Trabajo de interfaz termina ejerciendo la interfaz**, con la pantalla corriendo, no leyendo el código. Mira reposo, camino feliz, carga, éxito, cancelación, expiración, fallo recuperable y regreso a reposo.
6. `pnpm gate:quick`, y `gate:full` si tocaste apps. Marca el paso con evidencia. Commit en presente: `kiosk: agrega revisión documental con criterios`.
7. **Nunca `git push`.** Un worktree por agente: `scripts/agent-worktree.sh <nombre>`.
8. Si algo que necesitabas no existe, no lo inventes en silencio: anótalo en la campaña.

## 8. Mapa

```
apps/control-plane   API central (/admin/v1, /fleet/v1), SQLite, seed, simulación de flota
apps/station-agent   servicio local de la máquina (/station/v1, SSE, sync, hardware simulado)
apps/kiosk           UI táctil del cliente y panel técnico (React PWA)
apps/admin           consola de administración y portal de franquicia (React)
packages/contracts   esquemas zod: única fuente de verdad de formas
packages/domain      lógica pura: RBAC, precios, capacidades, features, sesiones, pagos, retención
packages/config-engine · bundler   herencia de configuración con procedencia; bundles por máquina
packages/vision      rostro, recorte de persona, gestos, detección; todo dentro del aparato
packages/imaging     edición, efectos de fondo, composición, PNG, QR real
packages/integrations  puertos y simulaciones: pagos, IA, entrega, fiscal, CRM
packages/i18n · ui · sqlite · fixtures · catalog
tools/cli            pnpm psp <comando>          tools/gates   compuertas de hechos
docs/                producto, arquitectura, protocolos, operación, estándares, trazabilidad
ops/                 política, atención, campañas, progreso, evaluaciones
```

## 9. Comandos

```bash
pnpm install     # hermético, sin compilación nativa
pnpm dev         # las cuatro apps
pnpm seed        # dataset demo en var/
pnpm catalog     # capacidades registradas
pnpm psp --help  # todo el CLI
pnpm gate:quick  # prueba hermética
pnpm gate:full   # todo
```

Credenciales demo, puertos y usuarios: `docs/operacion/como-correr.md`. Cómo se conduce el trabajo con agentes: `docs/estandares/como-se-aplica.md`.
