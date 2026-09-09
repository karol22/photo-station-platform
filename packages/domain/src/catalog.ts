/**
 * Registro descubrible (`pnpm catalog`): el paquete, cada permiso y cada feature.
 */
import { FEATURE_DEFINITIONS, PermissionKey, type CatalogEntry } from '@psp/contracts';

/** Descripción en español de cada permiso (requisito 3.2). */
export const PERMISSION_DESCRIPTIONS: Record<PermissionKey, string> = {
  'organizations.view': 'Ver organizaciones.',
  'organizations.create': 'Crear organizaciones.',
  'organizations.edit': 'Editar organizaciones.',
  'franchises.view': 'Ver franquiciatarios.',
  'franchises.create': 'Crear franquiciatarios.',
  'franchises.edit': 'Editar franquiciatarios.',
  'locations.view': 'Ver ubicaciones.',
  'locations.create': 'Crear ubicaciones.',
  'locations.edit': 'Editar ubicaciones.',
  'machines.view': 'Ver máquinas.',
  'machines.edit': 'Editar máquinas.',
  'machines.maintenance': 'Reiniciar o colocar una máquina en mantenimiento.',
  'machines.commands': 'Enviar comandos remotos a una máquina.',
  'pricing.edit': 'Cambiar precios dentro de los rangos permitidos.',
  'products.manage': 'Administrar el catálogo de productos.',
  'campaigns.publish': 'Publicar campañas.',
  'campaigns.edit_local': 'Editar los campos permitidos de una campaña en su franquicia.',
  'templates.manage': 'Gestionar plantillas de impresión.',
  'presets.manage': 'Gestionar presets documentales.',
  'assets.manage': 'Gestionar activos de contenido.',
  'photos.view_exceptional': 'Ver fotografías cuando una política excepcional lo permite.',
  'sessions.view': 'Ver registros de sesión.',
  'metrics.view': 'Ver métricas.',
  'data.export': 'Exportar datos.',
  'data.import': 'Importar datos.',
  'users.manage': 'Administrar usuarios.',
  'permissions.edit': 'Modificar permisos.',
  'features.manage': 'Administrar funciones habilitadas.',
  'releases.manage': 'Gestionar versiones y despliegues.',
  'releases.rollback': 'Realizar rollback de una versión.',
  'audit.view': 'Ver el registro de auditoría.',
  'branding.manage': 'Administrar branding.',
  'privacy.edit': 'Cambiar políticas de privacidad y retención.',
  'config.edit': 'Editar configuración heredable.',
  'maintenance.log': 'Registrar mantenimiento.',
  'incidents.manage': 'Abrir y gestionar incidencias.',
  'incidents.close': 'Cerrar incidencias.',
  'support.grant': 'Conceder accesos de soporte acotados.',
  'announcements.publish': 'Publicar anuncios internos.',
  'docs.manage': 'Gestionar documentación operativa interna.',
};

export const CATALOG: CatalogEntry[] = [
  {
    kind: 'package',
    key: '@psp/domain',
    name: 'Dominio puro',
    description:
      'Jerarquía y alcance, RBAC, precios y promociones, capacidades, features y entitlements, sesiones, retención, releases y auditoría. Sin I/O.',
    package: '@psp/domain',
    status: 'stable',
    docs: 'docs/arquitectura/01-apis-de-paquetes.md',
  },
  ...PermissionKey.options.map(
    (key): CatalogEntry => ({
      kind: 'permission',
      key,
      name: key,
      description: PERMISSION_DESCRIPTIONS[key],
      package: '@psp/domain',
      status: 'stable',
    }),
  ),
  ...FEATURE_DEFINITIONS.map(
    (feature): CatalogEntry => ({
      kind: 'feature',
      key: feature.key,
      name: feature.name.es,
      description: feature.description.es,
      package: '@psp/domain',
      status: feature.defaultMode === 'coming_soon' ? 'planned' : 'stable',
    }),
  ),
];
