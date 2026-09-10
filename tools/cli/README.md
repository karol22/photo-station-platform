# @psp/cli

## Propósito
Comandos operativos con los que una persona o un agente descubre y opera la plataforma sin leer código: `pnpm psp <comando>`.

## Cómo se usa
```bash
pnpm psp --help
pnpm catalog                          # = pnpm psp catalog
pnpm seed                             # = pnpm psp seed  (--force recrea; --fleet=100 agrega máquinas simuladas)
pnpm psp bundle --machine=mch_demo_thermal_01
pnpm psp simulate-fleet --count=100   # requiere control-plane corriendo
pnpm psp demo                         # estado de los servicios y guía de escenarios
pnpm psp gates quick                  # = pnpm gate:quick
```
Cada comando está registrado en el catálogo (`kind: command`). Agregar uno: crear `src/commands/<nombre>.ts` exportando un `Command` y añadirlo a `COMMANDS` en `src/main.ts`.

## Cómo se prueba
```bash
pnpm --filter @psp/cli typecheck && pnpm --filter @psp/cli test
```
