# @psp/catalog

## Propósito
Registro descubrible de capacidades. Lo que no está aquí no existe para un agente que llega en frío. Agrega tres fuentes: el `CATALOG` que exporta cada paquete, entradas derivadas de los contratos (features, capacidades de hardware, permisos, claves de configuración) y entradas estáticas (apps, paquetes, protocolos). Las compuertas y los comandos del CLI se agregan en el CLI (`GATE_CATALOG`, `CLI_CATALOG`) para evitar ciclos.

## Cómo se usa
```bash
pnpm catalog                 # tabla completa
pnpm catalog --kind feature  # filtra por tipo
pnpm catalog --json          # JSON para herramientas
```
```ts
import { fullCatalog } from '@psp/catalog';
const entries = await fullCatalog();
```
Registrar algo nuevo: exportar `CATALOG: CatalogEntry[]` desde el paquete (kinds: `feature`, `adapter`, `port`, `editingOp`, `visionCriterion`, …) o, si es una app/protocolo, añadirlo a `STATIC_CATALOG`. La compuerta `catalog-complete` falla si una lista cerrada de contratos tiene claves sin entrada.

## Cómo se prueba
```bash
pnpm --filter @psp/catalog test
```
