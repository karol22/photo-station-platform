# Configuración heredada

Motor determinista que resuelve, para cualquier máquina, un único `EffectiveConfig` a partir de capas por nivel de jerarquía, un blueprint y las campañas vigentes. Implementado en `packages/config-engine` (`resolveEffectiveConfig`, `explainKey`, `validateLayer`, `buildBundle`, `bundleDiff`), sin I/O y con `now` siempre inyectado. Cubre los requisitos 15, 19.7, 36 y 44 (ADR-007).

## 1. Orden de capas

```
defaults del registro (CONFIG_KEYS)
        │
   platform
        │
   organization
        │
   blueprint            ← defaults del tipo de estación (requisito 44)
        │
   franchise
        │
   region
        │
   location
        │
   machine
        │
   campaign (por prioridad ascendente, sólo las vigentes en `now`)
```

Cada nivel puede sobrescribir lo que declaró el nivel anterior, salvo que un bloqueo lo impida (§3). A igual nivel, la última capa de la lista gana. El blueprint se trata como un nivel propio (`layerRank`: `platform` 0 &lt; `organization` 1 &lt; `blueprint` 2 &lt; `franchise` 3 &lt; `region` 4 &lt; `location` 5 &lt; `machine` 6 &lt; `campaign` 7), así que una franquicia puede sobrescribir lo que trae el blueprint de la máquina, y una máquina puede sobrescribir lo que trae su franquicia — el blueprint sólo aporta los valores de partida al crear la máquina (requisito 44). Las campañas activas se aplican al final, en orden de `priority` ascendente (la de mayor prioridad gana; empates: la que empieza después y, si persiste, la de `id` mayor). Que una campaña esté vigente depende sólo de `startsAt <= now < endsAt`; el campo `status` no participa en el cálculo — así es posible previsualizar una campaña en `draft` (requisito 16.3) sin publicarla.

Cada nivel sólo puede escribir una clave si su definición lo permite (`ConfigKeyDefinition.editableAt`; el blueprint cuenta como `organization` y la campaña como `location` para ese chequeo). Escribir una clave sin definición se acepta igual, para no cerrar la extensibilidad; sólo que `validateLayer` no la valida contra ningún tipo.

## 2. Procedencia

Cada valor de `EffectiveConfig.values` trae en `provenance` de qué nivel y capa salió (`ProvenanceEntry`: `level`, `entityId?`, `layerId?`, `isDefault`). Una clave que ninguna capa tocó vale su default del registro con `{ level: "platform", isDefault: true }`. Esto es lo que la consola de administración muestra junto a cada campo (requisito 36: "de dónde sale este valor").

<!-- contract: EffectiveConfig -->
```json
{
  "values": { "branding.palette.primary": "#1E5EFF", "branding.palette.accent": "#00C2A8", "timing.idleTimeoutSec": 60, "kiosk.volume": 50 },
  "provenance": {
    "branding.palette.primary": { "level": "organization", "entityId": "org_1", "layerId": "cfg_org_1", "isDefault": false },
    "branding.palette.accent": { "level": "campaign", "entityId": "cmp_verano", "layerId": "cfg_cmp_verano", "isDefault": false },
    "timing.idleTimeoutSec": { "level": "platform", "isDefault": true },
    "kiosk.volume": { "level": "platform", "isDefault": true }
  },
  "locks": {
    "branding.palette.primary": { "key": "branding.palette.primary", "policy": "mandatory", "setBy": "organization", "setById": "org_1" }
  },
  "rejected": [
    { "key": "branding.palette.primary", "level": "franchise", "entityId": "fr_1", "reason": "locked_by_organization" }
  ],
  "hash": "6a7bfdd1ca0dc208d23a1b328aa3b22be75fa318776e59de10b8e28b083dad54"
}
```

## 3. Bloqueos: un ejemplo de cada política

Un nivel declara un `ConfigLock` que rige para los niveles **inferiores**, nunca para sí mismo. La fuerza relativa es `editable < range < mandatory < hidden`: un nivel inferior sólo sustituye el bloqueo efectivo si el suyo es estrictamente más fuerte, o si es un `range` contenido en el `range` superior; lo demás se ignora (`lock_ignored`).

| Política | Efecto | Ejemplo (`ConfigLock`) |
|---|---|---|
| `mandatory` | Ningún nivel inferior puede escribir la clave; su intento cae en `rejected` con `locked_by_<nivel>` | `{ "key": "branding.palette.primary", "policy": "mandatory", "setBy": "organization", "setById": "org_1" }` — la franquicia no puede cambiar el color primario de la marca |
| `editable` | No restringe nada; declara explícitamente que el nivel inferior puede sobrescribir (documenta intención, no cambia el resultado) | `{ "key": "printing.cutMarks", "policy": "editable", "setBy": "organization", "setById": "org_1" }` |
| `range` | Acepta un número dentro de `[min, max]` o una cadena en `allowed`; fuera de rango se rechaza con `out_of_range` | `{ "key": "timing.idleTimeoutSec", "policy": "range", "range": { "min": 30, "max": 120 }, "setBy": "organization", "setById": "org_1" }` — una máquina que pida 200 s se queda con el valor heredado |
| `hidden` | Rechaza toda escritura inferior igual que `mandatory`, y además señala a la UI que no debe ofrecer el campo a niveles de franquicia hacia abajo (el valor sí viaja en el bundle: ocultarlo en pantalla es responsabilidad de la UI, que lee `locks[key].policy`) | `{ "key": "techPanel.pinHash", "policy": "hidden", "setBy": "organization", "setById": "org_1" }` — ninguna franquicia ve ni edita el PIN técnico de otra ubicación |

Un `mandatory`/`hidden` de un nivel de jerarquía bloquea también los overlays de campaña, incluidas las campañas de la propia organización; para que una campaña pueda tocar una clave, esa clave debe quedar en `range` o sin bloquear.

## 4. `rejected`

Cada intento de escritura o de bloqueo que no aplica queda registrado, en orden de capa y clave, con el nivel que lo intentó y el motivo (`REJECTION_REASONS` del resolve: `locked_by_<nivel>`, `out_of_range`, `not_editable_at_level`, `lock_ignored`; `validateLayer` añade `invalid_type`, `not_in_enum`, `out_of_definition_range`, `invalid_lock`). `rejected` no participa en el `hash`: dos resoluciones con el mismo `values`/`locks` pero distinta procedencia de rechazo son la misma configuración. Es lo que permite responder, sin adivinar, "¿por qué mi cambio no se aplicó?".

## 5. Hash

`hash = stableHash({ values, locks })` (`packages/config-engine`, `sha256Hex` de `stableStringify`, puro y síncrono en Node y en el navegador). Ni la procedencia, ni `rejected`, ni los ids de capa, ni el orden de claves del insumo lo alteran — sólo lo que la máquina realmente ejecuta. Es la pieza con la que una máquina puede comparar "¿mi configuración activa sigue siendo la vigente?" sin transportar el objeto completo.

## 6. Bundle

`buildBundle` toma el `EffectiveConfig` resuelto más el catálogo con precios ya resueltos, presets y sus versiones, plantillas, experiencias, presets de edición, campañas, features resueltas, políticas de retención, checklists y el manifiesto de activos, y produce un `ConfigBundle` cuya `version` es el hash estable de **todo** ese contenido (salvo `generatedAt`). Es inmutable: un bundle nunca se edita, sólo se reemplaza por uno nuevo con otra versión (ADR-007; forma completa y ejemplo en `docs/protocolos/fleet-sync-v1.md` §6). `packages/bundler` (`materializeBundle`) es quien arma ese insumo a partir de las colecciones de negocio para una máquina concreta — `config-engine` sólo resuelve capas y construye el bundle a partir de lo que ya se le entrega resuelto.

`bundleDiff(anterior, nuevo)` compara dos bundles y devuelve, por tipo, qué cambió (`configKeys`, `productsAdded`/`Removed`, `pricesChanged`, `campaignsChanged`, `featuresChanged`, `templatesChanged`, `presetsChanged`, `experiencesChanged`, `assetsChanged`). El agente lo usa para saber qué activos le faltan antes de activar; la consola lo usa para explicar "qué cambia" antes de confirmar.

## 7. Previsualización masiva

Antes de aplicar un `ConfigPatchRequest` sobre varias entidades a la vez, la consola llama `POST /admin/v1/bulk/preview` (`docs/protocolos/admin-api-v1.md` §4.11), que resuelve el bundle de cada máquina alcanzada con y sin el cambio propuesto y devuelve `affected[]` con `wouldChange: boolean` por máquina, más un `confirmToken`. `POST /admin/v1/bulk/apply` exige ese mismo token: nunca se aplica un cambio masivo sin haber mostrado antes cuántas máquinas cambian y cuáles (requisito 36, 13.4). El mismo par previsualización/confirmación cubre acciones masivas que no son de configuración (`feature_override`, `price_rule`, `product_availability`, `campaign_assign`, `command`, `status`).

## 8. "Volverá al valor heredado"

El motor es una función pura: para saber qué valor queda si se elimina un override, la consola vuelve a llamar `resolveEffectiveConfig` sin esa clave en la capa (o usa `ConfigPatchRequest.unset`, que hace exactamente eso en el servidor) y compara ambos resultados. No hace falta ningún camino especial: `explainKey` sobre el resultado "sin override" ya muestra la procedencia a la que volvería.

## 9. Copia de configuración y blueprints

Un **blueprint** (`Blueprint`, requisito 44) es una configuración reusable que representa un tipo comercial de estación: trae `hardwareProfileId`, `productIds` y `configValues`/`featureModes` de partida, más un `maintenanceChecklistId` y `baseCampaignIds`. Al crear una máquina desde un blueprint, el control-plane copia esos defaults a la capa `machine` inicial (o a una capa `blueprint` propia, si la máquina la declara) — desde ahí son overrides normales: la máquina puede seguir editándolos si su nivel tiene permiso y nada superior los bloquea. El dataset demo trae cuatro (`bp_doc_university`, `bp_thermal_cafe`, `bp_premium_booth`, `bp_demo_unit`).

**Copiar configuración de una máquina a otra** (requisito 43) no tiene una ruta ni una función dedicada hoy: se logra leyendo la capa `machine` de origen (`GET /admin/v1/config/effective?level=machine&id=<origen>`) y escribiéndola como `ConfigPatchRequest` sobre el destino. Queda anotado como hueco abierto en el reporte final de esta sesión de documentación.

## 10. Registro de claves (`CONFIG_KEYS`)

Fuente: `packages/contracts/src/config.ts`. `fromOrg` = `organization, franchise, region, location, machine`; `all` = ese mismo conjunto más `platform`.

| Clave | Tipo | Grupo | Default | Editable en |
|---|---|---|---|---|
| `branding.publicName` | string | branding | `""` | fromOrg |
| `branding.logoAssetId` | asset | branding | `null` | fromOrg |
| `branding.secondaryLogoAssetId` | asset | branding | `null` | fromOrg |
| `branding.hostLogoAssetId` | asset | branding | `null` | location, machine |
| `branding.sponsorLogoAssetId` | asset | branding | `null` | fromOrg |
| `branding.palette.primary` | color | branding | `#1E5EFF` | fromOrg |
| `branding.palette.secondary` | color | branding | `#0B1B3F` | fromOrg |
| `branding.palette.accent` | color | branding | `#FFB020` | fromOrg |
| `branding.palette.background` | color | branding | `#F6F7FB` | fromOrg |
| `branding.palette.text` | color | branding | `#0B1B3F` | fromOrg |
| `branding.attractImageAssetIds` | stringList | branding | `[]` | fromOrg |
| `branding.tone` | enum(`friendly`,`formal`,`playful`) | branding | `friendly` | fromOrg |
| `branding.footerText` | text | branding | `""` | fromOrg |
| `branding.completionMessage` | text | branding | `""` | fromOrg |
| `branding.printLogoAssetId` | asset | branding | `null` | fromOrg |
| `kiosk.defaultLocale` | enum(`es`,`en`) | kiosk | `es` | all |
| `kiosk.locales` | stringList | kiosk | `["es","en"]` | all |
| `kiosk.showPricesOnIdle` | boolean | kiosk | `true` | all |
| `kiosk.attractRotationSec` | number [3–120] | kiosk | `8` | all |
| `kiosk.surveillanceNotice` | boolean | kiosk | `false` | all |
| `kiosk.simplifiedMode` | boolean | accessibility | `false` | all |
| `kiosk.accessibleTimeoutMultiplier` | number [1–4] | accessibility | `1.5` | all |
| `kiosk.screenBrightness` | number [10–100] | kiosk | `80` | machine |
| `kiosk.volume` | number [0–100] | kiosk | `50` | machine |
| `kiosk.orientation` | enum(`portrait`,`landscape`) | kiosk | `portrait` | machine |
| `timing.idleTimeoutSec` | number [15–600] | timing | `60` | all |
| `timing.warningBeforeCancelSec` | number [5–60] | timing | `15` | all |
| `timing.captureCountdownSec` | number [1–10] | timing | `3` | all |
| `timing.prepareBeforeCaptureSec` | number [0–10] | timing | `2` | all |
| `timing.reviewTimeoutSec` | number [15–600] | timing | `90` | all |
| `timing.autoCaptureStabilityMs` | number [300–5000] | timing | `1200` | all |
| `legal.privacyNotice` | text | legal | `""` | organization, franchise |
| `legal.terms` | text | legal | `""` | organization, franchise |
| `legal.supportContact` | string | legal | `""` | fromOrg |
| `privacy.defaultRetentionPolicyId` | string | privacy | `ret_delete_on_finish` | organization, franchise |
| `privacy.deleteIncompleteSessions` | boolean | privacy | `true` | organization, franchise |
| `printing.defaultCopies` | number [1–10] | printing | `1` | all |
| `printing.cutMarks` | boolean | printing | `true` | all |
| `printing.pickupInstructions` | text | printing | `""` | all |
| `payment.businessMode` | enum(`paid`,`free_sponsored`,`demo`,`courtesy`,`included`,`promotional`,`internal`) | payment | `paid` | all |
| `payment.terminalAdapter` | enum(`none`,`mock`,`nayax`,`mercadopago_qr`) | payment | `mock` | organization, franchise, machine |
| `payment.timeoutSec` | number [20–600] | payment | `90` | all |
| `session.maxRetakesDefault` | number [0–10] | session | `3` | all |
| `sync.heartbeatIntervalSec` | number [5–600] | sync | `30` | platform, organization |
| `sync.eventBatchSize` | number [1–1000] | sync | `100` | platform, organization |
| `techPanel.pinHash` | string (`sensitive`) | techPanel | `""` | organization, franchise, machine |

`sensitive: true` en `techPanel.pinHash` marca que la consola no debe mostrar su valor en claro (aparece como `[oculto]` o similar en cualquier vista, incluida `EffectiveConfigView`).
