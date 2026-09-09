# @psp/bundler

## Propósito
Materializa el `ConfigBundle` de una máquina a partir de las colecciones de negocio (jerarquía, capas de configuración, catálogo, presets, plantillas, experiencias, campañas, features, activos). Lo usa el control-plane para responder `/fleet/v1/bundle` y para recalcular la versión objetivo de cada máquina cuando algo cambia; el agente de estación lo usa en modo standalone con el dataset demo. Misma entrada → mismo bundle → misma `version` (hash de contenido, `generatedAt` no participa).

Es un paquete puro: no lee reloj, red ni disco. Todo lo temporal entra por `now`.

## Cómo se usa

```ts
import { materializeBundle, computeKioskAvailability, type BundleSource } from '@psp/bundler';

const bundle = materializeBundle(source, 'mch_demo_doc_01', {
  now: new Date('2026-09-09T12:00:00Z'),
  assetUrlBase: '/fleet/v1/assets',        // url = assetUrlBase + '/' + hash
  catalogRevision: 'opcional',            // por defecto: hash de ids y fechas del catálogo de la organización
  generatedAt: 'opcional',                // por defecto: now.toISOString(); no altera `version`
});

const availability = computeKioskAvailability(bundle, {
  machine, printers, maintenance: false, now: new Date(),
});
```

`BundleSource` es el subconjunto del `DemoDataset` con las 24 colecciones que participan (ver `src/materialize.ts`).

Pasos de `materializeBundle`:

1. **Cadena de alcance** con `scopeChain` de `@psp/domain`: plataforma → organización → franquicia → región → ubicación → máquina.
2. **Capas**: las de `configLayers` que coinciden con cada alcance de la cadena (a igual nivel, la de mayor `version` gana) más el blueprint de la máquina como capa `blueprint` (la declarada en `configLayers` con `level: 'blueprint'` o, si no existe, la sintetizada desde `blueprint.configValues` con id `cfg_blueprint_<id>`).
3. **Campañas aplicables**: de la organización, en estado `active` o `scheduled`, de la franquicia si son locales, y cuyo `targets.scopes` contenga la máquina (`scopeContains`) o cuyos `targets.tags` intersecten las etiquetas de la máquina o de su ubicación. Todas van al bundle para que la máquina las active por fecha local; al overlay de configuración y a los precios sólo entran las vigentes en `now` (ventana `startsAt`–`endsAt`).
4. **Configuración efectiva** con `resolveEffectiveConfig` de `@psp/config-engine` y el registro `CONFIG_KEYS`.
5. **Features** con `resolveFeatures` (overrides, entitlements, planes, capacidades de la máquina).
6. **Productos**: los activos de la organización no desactivados por una `ProductAvailability` de la cadena (la más específica gana; `temporaryUntil` vencido se ignora), ordenados por `priorityOverride ?? priority` y después por id.
7. **Precios**: `resolvePrice` por producto con las reglas del producto, las promociones activas cuyo alcance contiene la máquina, las campañas vigentes y el `payment.businessMode` efectivo.
8. **Presets** referenciados por productos en su versión actual (`currentVersion`), **plantillas** referenciadas por productos, hojas documentales, experiencias y campañas, **experiencias** referenciadas por productos y campañas, y **presets de edición** referenciados por productos y experiencias. Las políticas de retención son las de la organización más las globales; los checklists, los de la organización o globales compatibles con el perfil de hardware.
9. **Activos**: sólo los referenciados por lo anterior (claves `asset` y listas `*AssetIds` del efectivo, portadas y videos de productos, elementos `image`/`frame`/`background` de plantillas y variantes, ejemplos y siluetas de poses, marcos/stickers/overlays de experiencias, `assetIds` y logo del patrocinador de campañas). Un id sin activo en la fuente se omite.
10. `buildBundle` calcula la `version`.

`computeKioskAvailability` envuelve `computeAvailability` de `@psp/domain` con los productos del bundle (ya filtrados por alcance), sus features y el estado en tiempo real (impresoras, mantenimiento).

Notas:
- `featureModes` y `productIds` del blueprint son valores por defecto al crear la máquina (los aplica el control-plane); en la materialización el blueprint sólo aporta su capa de configuración.
- Errores con código: `BundlerError` (`machine_not_found`, `organization_not_found`, `hardware_profile_not_found`).

## Cómo se prueba
```bash
pnpm --filter @psp/bundler test
```
Las pruebas construyen un dataset mínimo a mano validado con los contratos (dos organizaciones, franquicias, campañas de cada tipo, bloqueos, disponibilidad por alcance) y comprueban determinismo, capas, campañas, productos, precios, presets, features y manifiesto. Una prueba adicional materializa todas las máquinas del dataset demo cuando `@psp/fixtures` está disponible.
