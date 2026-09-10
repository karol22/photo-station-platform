/** Filtrado puro de la navegación según los permisos del principal (en cualquier alcance). */
import type { PermissionKey, Principal } from '@psp/contracts';
import type { NavSectionDef } from '../shell/navigation';

export function hasAnyPermission(principal: Principal | undefined, permissions: PermissionKey[]): boolean {
  if (!principal) return false;
  if (permissions.length === 0) return true;
  const owned = new Set(principal.permissions.map((p) => p.key));
  return permissions.some((key) => owned.has(key));
}

export function hasPermissionAnywhere(principal: Principal | undefined, permission: PermissionKey): boolean {
  return hasAnyPermission(principal, [permission]);
}

/** Secciones con sólo los ítems visibles; las secciones vacías desaparecen. */
export function filterNavigation(sections: NavSectionDef[], principal: Principal | undefined): NavSectionDef[] {
  return sections
    .map((section) => ({ ...section, items: section.items.filter((item) => hasAnyPermission(principal, item.anyOf)) }))
    .filter((section) => section.items.length > 0);
}
