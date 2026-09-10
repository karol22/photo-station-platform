# @psp/config-engine

## Propósito

Motor determinista de configuración heredada. Recibe las capas de configuración de una máquina (plataforma → organización → blueprint → franquicia → región → ubicación → máquina → campañas vigentes) y produce un `EffectiveConfig` con:

- `values`: el valor efectivo de cada clave (defaults del registro `CONFIG_KEYS` más las escrituras aceptadas);
- `provenance`: qué nivel, entidad y capa aporta cada valor (`isDefault: true` cuando es el default del registro);
- `locks`: el bloqueo efectivo por clave (`mandatory`, `editable`, `range`, `hidden`), con el nivel que lo declara;
- `rejected`: cada escritura o bloqueo que no aplica, con el nivel que lo intenta y el motivo;
- `hash`: `stableHash({ values, locks })`, la identidad de la configuración.

También materializa bundles inmutables (`buildBundle`, `bundleDiff`), valida una capa antes de guardarla (`validateLayer`), explica un valor (`explainKey`) y expone la serialización canónica y el sha256 en TypeScript puro que usa para versionar (`stableStringify`, `stableHash`, `sha256Hex`).

Es lógica pura: sin I/O, sin `Date.now()` (el instante `now` se inyecta), sin dependencias más allá de `@psp/contracts` y zod. El mismo insumo produce siempre la misma salida y el mismo hash, en Node y en el navegador. Cubre los requisitos 15.2, 15.3, 16.2, 19.7, 36 y 44 y el ADR-007.

## Cómo se usa

### Resolver la configuración efectiva

Cada nivel es un `ConfigLayer` de contratos. El blueprint va aparte (`blueprint`) y cada campaña llega con su entidad y la capa que materializa su `configOverlay` (`campaigns`). El motor ordena las capas por nivel; el control-plane sólo tiene que juntarlas.

```ts
import type { Campaign, ConfigLayer } from '@psp/contracts';
import { explainKey, resolveEffectiveConfig, validateLayer } from '@psp/config-engine';

const at = '2026-09-01T00:00:00Z';

const organization: ConfigLayer = {
  id: 'cfg_org_1',
  level: 'organization',
  entityId: 'org_1',
  values: {
    'branding.publicName': 'Fotos Express',
    'branding.palette.primary': '#1E5EFF',
    'timing.idleTimeoutSec': 60,
  },
  locks: [
    { key: 'branding.palette.primary', policy: 'mandatory', setBy: 'organization' },
    {
      key: 'timing.idleTimeoutSec',
      policy: 'range',
      range: { min: 30, max: 120 },
      setBy: 'organization',
    },
  ],
  version: 3,
  updatedAt: at,
};
const franchise: ConfigLayer = {
  id: 'cfg_fr_1',
  level: 'franchise',
  entityId: 'fr_1',
  values: { 'branding.palette.primary': '#FF0000', 'branding.palette.accent': '#FFB020' },
  locks: [],
  version: 1,
  updatedAt: at,
};
const location: ConfigLayer = {
  id: 'cfg_loc_1',
  level: 'location',
  entityId: 'loc_1',
  values: { 'printing.defaultCopies': 2 },
  locks: [],
  version: 1,
  updatedAt: at,
};
const machine: ConfigLayer = {
  id: 'cfg_mch_1',
  level: 'machine',
  entityId: 'mch_1',
  values: { 'kiosk.screenBrightness': 70, 'timing.idleTimeoutSec': 200 },
  locks: [],
  version: 1,
  updatedAt: at,
};

// La campaña es una entidad de contratos; su overlay se materializa como capa de nivel `campaign`.
const campaign: Campaign = {
  id: 'cmp_verano',
  organizationId: 'org_1',
  name: { es: 'Verano' },
  startsAt: '2026-09-01T00:00:00Z',
  endsAt: '2026-10-01T00:00:00Z',
  targets: { scopes: [{ level: 'location', id: 'loc_1' }], tags: [] },
  productIds: [],
  priceOverrides: [],
  templateIds: [],
  assetIds: [],
  texts: {},
  priority: 5,
  status: 'active',
  configOverlay: { values: { 'branding.palette.accent': '#00C2A8' }, locks: [] },
  franchiseEditableKeys: [],
  mandatory: false,
  createdAt: at,
};
const campaignLayer: ConfigLayer = {
  id: 'cfg_cmp_verano',
  level: 'campaign',
  entityId: 'cmp_verano',
  values: campaign.configOverlay.values,
  locks: campaign.configOverlay.locks,
  version: 1,
  updatedAt: at,
};

const effective = resolveEffectiveConfig({
  layers: [organization, franchise, location, machine],
  campaigns: [{ campaign, layer: campaignLayer }],
  now: new Date('2026-09-09T12:00:00Z'), // inyectado: nunca Date.now() dentro del motor
  timezone: 'America/Mexico_City',
});
```

Resultado (subconjunto):

```json
{
  "values": {
    "branding.publicName": "Fotos Express",
    "branding.palette.primary": "#1E5EFF",
    "branding.palette.accent": "#00C2A8",
    "timing.idleTimeoutSec": 60,
    "printing.defaultCopies": 2,
    "kiosk.screenBrightness": 70,
    "kiosk.volume": 50
  },
  "provenance": {
    "branding.palette.accent": {
      "level": "campaign",
      "entityId": "cmp_verano",
      "layerId": "cfg_cmp_verano",
      "isDefault": false
    },
    "kiosk.volume": { "level": "platform", "isDefault": true }
  },
  "locks": {
    "branding.palette.primary": {
      "key": "branding.palette.primary",
      "policy": "mandatory",
      "setBy": "organization",
      "setById": "org_1"
    },
    "timing.idleTimeoutSec": {
      "key": "timing.idleTimeoutSec",
      "policy": "range",
      "range": { "min": 30, "max": 120 },
      "setBy": "organization",
      "setById": "org_1"
    }
  },
  "rejected": [
    {
      "key": "branding.palette.primary",
      "level": "franchise",
      "entityId": "fr_1",
      "reason": "locked_by_organization"
    },
    {
      "key": "timing.idleTimeoutSec",
      "level": "machine",
      "entityId": "mch_1",
      "reason": "out_of_range"
    }
  ],
  "hash": "6a7bfdd1ca0dc208d23a1b328aa3b22be75fa318776e59de10b8e28b083dad54"
}
```

Lectura: la franquicia intenta cambiar el color primario, pero la organización lo declara `mandatory`, así que el valor sigue siendo el de la organización. La máquina pide 200 s de inactividad, fuera del rango 30–120 que fija la organización, así que se conserva el valor heredado (60). La campaña "Verano" está vigente en `now` y escribe el color de acento por encima de la franquicia. `kiosk.volume` no aparece en ninguna capa: vale su default y su procedencia es `platform` con `isDefault: true`. `values` incluye siempre todas las claves del registro.

### Explicar un valor

`explainKey` responde "¿de dónde sale este valor y por qué no aplica mi override?", que es lo que muestra la consola de administración (requisito 36):

```ts
explainKey(effective, 'branding.palette.primary');
```

```json
{
  "value": "#1E5EFF",
  "provenance": {
    "level": "organization",
    "entityId": "org_1",
    "layerId": "cfg_org_1",
    "isDefault": false
  },
  "present": true,
  "rejected": [
    {
      "key": "branding.palette.primary",
      "level": "franchise",
      "entityId": "fr_1",
      "reason": "locked_by_organization"
    }
  ],
  "lock": {
    "key": "branding.palette.primary",
    "policy": "mandatory",
    "setBy": "organization",
    "setById": "org_1"
  },
  "definition": {
    "key": "branding.palette.primary",
    "type": "color",
    "group": "branding",
    "name": { "es": "Color primario", "en": "Primary color" },
    "default": "#1E5EFF",
    "editableAt": ["organization", "franchise", "region", "location", "machine"],
    "sensitive": false
  }
}
```

Una clave ausente devuelve `present: false` y `value: undefined`. El tercer parámetro opcional recibe otro registro de definiciones si no se usa `CONFIG_KEYS`.

### Validar una capa antes de guardarla

`validateLayer` aplica las mismas reglas que el resolve a una sola capa contra sus capas superiores (`parents`; las de nivel igual o inferior se ignoran), sin resolver todo. Además comprueba el valor contra la definición de la clave (tipo, enumerado, `min`/`max`) y reporta bloqueos propios que no tendrían efecto o están mal formados. Sirve para que la UI muestre las violaciones antes de guardar:

```ts
validateLayer(machine, [organization, franchise, location]);
// { ok: false, violations: [{ key: 'timing.idleTimeoutSec', reason: 'out_of_range' }] }
```

### "Volverá al valor heredado si se elimina el override"

El motor es una función pura: para saber qué valor queda al quitar un override, se resuelve otra vez sin la clave en esa capa. La consola puede mostrar ambos resultados lado a lado:

```ts
const withoutOverride = resolveEffectiveConfig({
  layers: [
    organization,
    franchise,
    location,
    { ...machine, values: { 'kiosk.screenBrightness': 70 } },
  ],
  campaigns: [{ campaign, layer: campaignLayer }],
  now: new Date('2026-09-09T12:00:00Z'),
  timezone: 'America/Mexico_City',
});
withoutOverride.values['timing.idleTimeoutSec']; // 60, procedencia organization
```

Como la escritura de la máquina estaba rechazada, `withoutOverride.hash === effective.hash`: las escrituras rechazadas y la procedencia no forman parte del hash; sólo `values` y `locks`.

### Materializar un bundle

`buildBundle` recibe todo el contenido del `ConfigBundle` salvo `version` y `contractsVersion`, y devuelve el bundle con `contractsVersion: 'v1'` y `version` = hash estable de todo el contenido excepto `generatedAt`. Dos generaciones con el mismo contenido tienen la misma versión aunque se produzcan en momentos distintos; cualquier cambio en la configuración efectiva, el catálogo, los presets, las plantillas, las campañas, las features o el manifiesto de activos produce otra versión.

```ts
import { buildBundle, bundleDiff } from '@psp/config-engine';

const bundle = buildBundle({
  machineId: 'mch_1',
  organizationId: 'org_1',
  generatedAt: now.toISOString(),
  effective /* …catálogo, presets, plantillas, campañas, features, activos */,
});
bundle.version; // sha256 hex del contenido

bundleDiff(previous, bundle);
// { configKeys: ['timing.idleTimeoutSec'], productsAdded: [], productsRemoved: [], pricesChanged: [],
//   campaignsChanged: [], featuresChanged: [], templatesChanged: [], presetsChanged: [],
//   experiencesChanged: [], assetsChanged: [] }
```

`bundleDiff` sirve para mostrar "qué cambia" antes de confirmar un cambio masivo y para que el agente sepa qué activos descargar antes de activar el bundle. `configKeys` incluye claves cuyo valor **o** bloqueo efectivo cambia; `pricesChanged` sólo cubre productos presentes en ambos bundles; `presetsChanged` considera la entidad y sus versiones.

### Hash estable

```ts
import { sha256Hex, stableHash, stableStringify } from '@psp/config-engine';

stableStringify({ b: 1, a: { z: [3, 1, 2] } }); // '{"a":{"z":[3,1,2]},"b":1}'
stableHash({ b: 1, a: 2 }) === stableHash({ a: 2, b: 1 }); // true
sha256Hex('abc'); // 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
```

`stableStringify` ordena las claves en todos los niveles, conserva el orden de los arrays, omite `undefined` en objetos (y lo vuelve `null` en arrays), respeta `toJSON` y serializa `NaN`/`Infinity` como `null`, igual que `JSON.stringify`. `sha256Hex` acepta cadenas (codificadas como UTF-8) o bytes.

### Reglas del motor

| Regla                   | Comportamiento                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Orden de capas          | `layerRank`: platform 0 < organization 1 < blueprint 2 < franchise 3 < region 4 < location 5 < machine 6 < campaign 7. A igual nivel, la última capa de `layers` gana. El blueprint y las campañas se normalizan a su nivel por posición en el insumo.                                                                                                                                                                                                        |
| Defaults                | Toda clave del registro (`definitions`, por defecto `CONFIG_KEYS`) arranca con su default y procedencia `{ level: 'platform', isDefault: true }`.                                                                                                                                                                                                                                                                                                             |
| `editableAt`            | Una capa sólo escribe una clave con definición si su nivel está en `editableAt`. Para ese chequeo el blueprint cuenta como `organization` y la campaña como `location` (`scopeLevelFor`). Motivo: `not_editable_at_level`.                                                                                                                                                                                                                                    |
| Claves sin definición   | Se aceptan con procedencia normal (extensibilidad); los bloqueos también les aplican. `validateLayer` no las valida contra ninguna definición.                                                                                                                                                                                                                                                                                                                |
| Bloqueos                | Los de una capa rigen para los niveles inferiores, nunca para la propia capa. `mandatory` y `hidden` rechazan (`locked_by_<nivel>`); `range` acepta un número dentro de `min`/`max` o una cadena en `allowed` y rechaza lo demás (`out_of_range`); `editable` no restringe pero se conserva como declaración explícita. `setBy` es siempre el nivel de la capa que declara el bloqueo.                                                                        |
| Precedencia de bloqueos | Fuerza: editable < range < mandatory < hidden. Un nivel inferior sólo sustituye el bloqueo efectivo si es estrictamente más fuerte, o si es un `range` contenido en el `range` superior. Lo demás se ignora y se reporta como `lock_ignored`.                                                                                                                                                                                                                 |
| Campañas                | Sólo se aplican las vigentes: `startsAt <= now < endsAt` comparando instantes UTC (`isCampaignActive`). Se aplican en prioridad ascendente, así la de mayor `priority` gana; empates: gana la que empieza después y, si persiste, la de `id` mayor (`orderCampaigns`). El `status` no se evalúa: quien llama decide qué campañas pasa (esto permite previsualizar un borrador, requisito 16.3). `timezone` queda reservado para la activación por hora local. |
| `rejected`              | Una entrada por escritura o bloqueo que no aplica, en orden de capa y clave. Motivos del resolve: `REJECTION_REASONS`; adicionales de `validateLayer`: `VALIDATION_REASONS` (`invalid_type`, `not_in_enum`, `out_of_definition_range`, `invalid_lock`).                                                                                                                                                                                                       |
| Hash                    | `stableHash({ values, locks })`. La procedencia, los rechazos, los ids de capa y el orden de claves del insumo no lo alteran.                                                                                                                                                                                                                                                                                                                                 |
| Errores                 | Un `now` inválido lanza `RangeError`. Nada más lanza: todo insumo con la forma de contratos produce un resultado.                                                                                                                                                                                                                                                                                                                                             |

### Advertencias para integradores

- El resolve no valida tipos ni rangos de definición (sólo `editableAt` y bloqueos). Valida cada capa con `validateLayer` antes de persistirla; así la configuración efectiva nunca contiene valores fuera de definición.
- Un `mandatory`/`hidden` de un nivel de jerarquía bloquea también los overlays de campaña, incluidas las campañas de la propia organización. Para que una campaña pueda cambiar una clave, usa `range` o no la bloquees.
- Los valores de la capa de una campaña deben venir de `campaign.configOverlay`; el motor usa `campaign.id` como `entityId` de su procedencia.
- `hidden` sólo rechaza escrituras inferiores y marca el bloqueo; el valor sí viaja en el bundle. Ocultarlo a los usuarios de franquicia es responsabilidad de la UI, que lee `locks[key].policy`.
- Para expresar "sin override" se quita la clave de la capa; `null` es un valor válido (por ejemplo, un `asset` sin asignar) y se hereda como tal.
- `CATALOG` registra el paquete y una entrada `configKey` por cada clave de `CONFIG_KEYS`; `@psp/catalog` la agrega.

## Cómo se prueba

```bash
pnpm --filter @psp/config-engine typecheck
pnpm --filter @psp/config-engine test
```

Las pruebas viven en `src/__tests__/`:

- `hash.test.ts`: vectores conocidos de sha256 (`""`, `"abc"`, dos bloques, bordes de 55/56/64 bytes, UTF-8 multibyte), comparación con `node:crypto` para longitudes 0–300, propiedades de `stableStringify` y estabilidad de `stableHash` ante el orden de claves.
- `levels.test.ts`: orden de rangos y mapeo de `editableAt`.
- `resolve.test.ts`: herencia de seis niveles con procedencia, override y retiro (dos resolves), `mandatory`/`range`/`hidden`, precedencia de bloqueos, blueprint, `editableAt`, campañas por vigencia y prioridad, hash estable, `explainKey`.
- `validate.test.ts`: violaciones por `editableAt`, bloqueos, definición y bloqueos propios; coincidencia con lo que rechaza el resolve.
- `bundle.test.ts`: bundle válido según contratos, versión determinista salvo `generatedAt`, `bundleDiff` por tipo de contenido.
- `catalog.test.ts`: una entrada por clave y validez contra `CatalogEntry`.
- `evals.test.ts`: ejecuta los casos de `src/__evals__/config.json`.

`src/__evals__/config.json` es el conjunto de evaluación propio: cada caso tiene `input` (`layers`, `blueprint`, `campaigns`, `now`, `timezone`, con las formas de contratos) y `expected` (`values`, `provenance`, `locks`, `absentLocks`, `rejected`; todos opcionales y comparados como subconjunto, salvo `rejected`, que se compara completo). Cuando una persona rechaza un resultado del motor, el caso se agrega ahí y la nota va en `ops/notes/rechazos.md`.
