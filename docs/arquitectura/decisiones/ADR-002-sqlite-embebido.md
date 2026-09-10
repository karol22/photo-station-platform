# ADR-002 · SQLite embebido (`node:sqlite`) con migraciones SQL

## Contexto
La máquina necesita una base de datos local sin servidor. El plano de control, en esta fase, necesita arrancar con `pnpm dev` sin infraestructura. Node ≥ 22.13 trae `node:sqlite` sin dependencias nativas.

## Decisión
`packages/sqlite` envuelve `node:sqlite` con migraciones SQL numeradas y repositorios tipados. Sin ORM: el SQL es explícito y legible por agentes. El mismo esquema lógico se usa en control-plane y station-agent con tablas distintas.

## Consecuencias
- Instalación hermética: `pnpm install` no compila nada.
- El camino a Postgres es un adaptador de conexión y una revisión de tipos SQL (`docs/arquitectura/05-evolucion-y-nube.md`).
- Las pruebas usan bases en memoria.
