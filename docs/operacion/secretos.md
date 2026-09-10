# Secretos

Hoy no hay proveedores reales, así que no hay secretos reales. El mecanismo existe para que el primero no se improvise.

- `packages/integrations/src/secrets.ts` expone `resolveSecret(name)`: busca en variables de entorno y en `var/secrets.json` (ignorado). Devuelve un `SecretHandle` cuyo `toString()` es `[secreto:name]`; el valor sólo se lee con `handle.reveal()` en el punto de uso y nunca se registra.
- Nada versionado contiene valores; `tools/gates/secrets.ts` lo comprueba.
- En agentes paralelos, los secretos se resuelven desde el checkout principal; un worktree no los copia.
