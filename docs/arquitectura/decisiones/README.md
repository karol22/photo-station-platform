# Decisiones de arquitectura (ADR)

Cada decisión relevante se registra como un ADR corto: contexto, decisión, consecuencias. Se escriben en presente. Si una decisión se reemplaza, el ADR nuevo lo indica y el antiguo se marca como `reemplazado por`.

| ADR | Decisión | Estado |
|---|---|---|
| [001](ADR-001-monorepo-typescript.md) | Monorepo TypeScript con pnpm y turbo | vigente |
| [002](ADR-002-sqlite-embebido.md) | SQLite embebido (`node:sqlite`) con migraciones SQL | vigente |
| [003](ADR-003-kiosco-solo-habla-con-agente.md) | El kiosco sólo habla con el agente local | vigente |
| [004](ADR-004-sync-por-pull.md) | Sincronización por pull con comandos en heartbeat | vigente |
| [005](ADR-005-vision-y-edicion-en-dispositivo.md) | Visión y edición en el dispositivo | vigente |
| [006](ADR-006-integraciones-como-puertos.md) | Integraciones externas como puertos con adaptadores mock | vigente |
| [007](ADR-007-bundles-inmutables.md) | Bundles de configuración inmutables con procedencia | vigente |
| [008](ADR-008-contratos-zod.md) | Contratos zod compartidos y aditivos | vigente |
| [009](ADR-009-react-pwa.md) | React + Vite como PWA, migrable a WebView Android | vigente |
| [010](ADR-010-repo-evolutivo-con-agentes.md) | Repo evolutivo con agentes: entrada única, estado en disco, compuertas | vigente |
