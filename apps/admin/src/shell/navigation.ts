/**
 * Navegación agrupada por conceptos de negocio. Cada ítem declara los permisos que lo hacen
 * visible (`anyOf`): basta con tener uno de ellos en cualquier alcance. Así el portal de
 * franquicia es la misma app con menos ítems.
 */
import type { PermissionKey } from '@psp/contracts';

export interface NavItemDef {
  key: string;
  labelKey: string;
  path: string;
  anyOf: PermissionKey[];
}

export interface NavSectionDef {
  key: string;
  labelKey: string;
  items: NavItemDef[];
}

export const NAVIGATION: NavSectionDef[] = [
  {
    key: 'operation',
    labelKey: 'admin.nav.section.operation',
    items: [
      { key: 'dashboard', labelKey: 'admin.nav.dashboard', path: '/', anyOf: ['machines.view', 'metrics.view'] },
      { key: 'machines', labelKey: 'admin.nav.machines', path: '/machines', anyOf: ['machines.view'] },
      { key: 'locations', labelKey: 'admin.nav.locations', path: '/locations', anyOf: ['locations.view'] },
      { key: 'incidents', labelKey: 'admin.nav.incidents', path: '/incidents', anyOf: ['incidents.manage', 'incidents.close', 'machines.view'] },
      { key: 'maintenance', labelKey: 'admin.nav.maintenance', path: '/maintenance', anyOf: ['maintenance.log', 'machines.maintenance', 'machines.view'] },
      { key: 'consumables', labelKey: 'admin.nav.consumables', path: '/consumables', anyOf: ['machines.view', 'maintenance.log'] },
      { key: 'sessions', labelKey: 'admin.nav.sessions', path: '/sessions', anyOf: ['sessions.view'] },
      { key: 'metrics', labelKey: 'admin.nav.metrics', path: '/metrics', anyOf: ['metrics.view'] },
    ],
  },
  {
    key: 'network',
    labelKey: 'admin.nav.section.network',
    items: [
      { key: 'organizations', labelKey: 'admin.nav.organizations', path: '/organizations', anyOf: ['organizations.view'] },
      { key: 'franchises', labelKey: 'admin.nav.franchises', path: '/franchises', anyOf: ['franchises.view'] },
      { key: 'territories', labelKey: 'admin.nav.territories', path: '/territories', anyOf: ['franchises.view'] },
      { key: 'regions', labelKey: 'admin.nav.regions', path: '/regions', anyOf: ['franchises.view', 'locations.view'] },
      { key: 'hardware-profiles', labelKey: 'admin.nav.hardwareProfiles', path: '/hardware-profiles', anyOf: ['machines.view'] },
      { key: 'blueprints', labelKey: 'admin.nav.blueprints', path: '/blueprints', anyOf: ['machines.edit', 'machines.view'] },
    ],
  },
  {
    key: 'offer',
    labelKey: 'admin.nav.section.offer',
    items: [
      { key: 'products', labelKey: 'admin.nav.products', path: '/products', anyOf: ['products.manage', 'pricing.edit', 'machines.view'] },
      { key: 'prices', labelKey: 'admin.nav.prices', path: '/prices', anyOf: ['pricing.edit', 'products.manage', 'machines.view'] },
      { key: 'promotions', labelKey: 'admin.nav.promotions', path: '/promotions', anyOf: ['pricing.edit', 'products.manage', 'campaigns.publish', 'campaigns.edit_local'] },
      { key: 'presets', labelKey: 'admin.nav.presets', path: '/presets', anyOf: ['presets.manage', 'products.manage', 'machines.view'] },
      { key: 'templates', labelKey: 'admin.nav.templates', path: '/templates', anyOf: ['templates.manage', 'products.manage', 'machines.view'] },
      { key: 'experiences', labelKey: 'admin.nav.experiences', path: '/experiences', anyOf: ['products.manage', 'templates.manage', 'machines.view'] },
      { key: 'campaigns', labelKey: 'admin.nav.campaigns', path: '/campaigns', anyOf: ['campaigns.publish', 'campaigns.edit_local', 'machines.view'] },
      { key: 'assets', labelKey: 'admin.nav.assets', path: '/assets', anyOf: ['assets.manage', 'templates.manage', 'campaigns.publish', 'campaigns.edit_local', 'branding.manage'] },
    ],
  },
  {
    key: 'platform',
    labelKey: 'admin.nav.section.platform',
    items: [
      { key: 'features', labelKey: 'admin.nav.features', path: '/features', anyOf: ['features.manage', 'organizations.view', 'franchises.view'] },
      { key: 'releases', labelKey: 'admin.nav.releases', path: '/releases', anyOf: ['releases.manage', 'releases.rollback', 'machines.view'] },
      { key: 'users', labelKey: 'admin.nav.users', path: '/users', anyOf: ['users.manage', 'permissions.edit'] },
      { key: 'support', labelKey: 'admin.nav.support', path: '/support', anyOf: ['support.grant'] },
      { key: 'audit', labelKey: 'admin.nav.audit', path: '/audit', anyOf: ['audit.view'] },
      { key: 'announcements', labelKey: 'admin.nav.announcements', path: '/announcements', anyOf: ['announcements.publish', 'franchises.view'] },
      { key: 'docs', labelKey: 'admin.nav.docs', path: '/docs', anyOf: ['docs.manage', 'machines.view'] },
      { key: 'import-export', labelKey: 'admin.nav.importExport', path: '/import-export', anyOf: ['data.import', 'data.export'] },
      { key: 'catalog', labelKey: 'admin.nav.catalog', path: '/catalog', anyOf: ['features.manage', 'releases.manage'] },
    ],
  },
];

/** Ítem de navegación cuyo `path` prefija la ruta actual (el más largo gana). */
export function activeNavKey(pathname: string, sections: NavSectionDef[] = NAVIGATION): string | undefined {
  let best: NavItemDef | undefined;
  for (const section of sections) {
    for (const item of section.items) {
      const matches = item.path === '/' ? pathname === '/' : pathname === item.path || pathname.startsWith(`${item.path}/`);
      if (matches && (!best || item.path.length > best.path.length)) best = item;
    }
  }
  return best?.key;
}
