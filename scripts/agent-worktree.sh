#!/usr/bin/env bash
# Crea un worktree aislado para un agente: ../psp-wt-<nombre> en la rama agent/<nombre>.
set -euo pipefail
name="${1:?uso: scripts/agent-worktree.sh <nombre>}"
root="$(git rev-parse --show-toplevel)"
target="$root/../psp-wt-$name"
git -C "$root" worktree add -b "agent/$name" "$target" HEAD
echo "worktree listo en $target (rama agent/$name). Recuerda: PSP_AGENT=1 y nunca push."
