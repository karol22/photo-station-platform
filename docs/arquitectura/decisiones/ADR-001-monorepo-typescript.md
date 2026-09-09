# ADR-001 · Monorepo TypeScript con pnpm y turbo

## Contexto
La plataforma tiene cuatro aplicaciones (control-plane, station-agent, kiosk, admin) que comparten contratos, lógica de dominio y design system. Van a evolucionar con agentes de IA que necesitan un solo lenguaje, una sola forma de probar y una sola forma de correr.

## Decisión
Un monorepo con pnpm workspaces y turbo. Todo en TypeScript estricto. Los paquetes exportan código fuente (`src/index.ts`) sin paso de build: Vite y tsx lo consumen directamente. Sólo las apps tienen `build`.

## Consecuencias
- Un cambio de contrato se ve en todas las apps en el mismo commit.
- `pnpm test` y `pnpm typecheck` cubren todo el repo.
- Los paquetes no publican a npm; si algún día hace falta, se agrega build por paquete.
