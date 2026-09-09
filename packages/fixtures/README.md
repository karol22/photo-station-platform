# @psp/fixtures

## Propósito
Dataset demo canónico y determinista, validado contra `@psp/contracts`: dos marcas ficticias (Lumina Foto, MX/MXN, es+en; FotoRápida, CO/COP, es), franquicias Norte y Bajío, cuatro regiones, seis ubicaciones, diez máquinas con tres perfiles de hardware, catálogo con precios, promociones y disponibilidad por alcance, presets documentales versionados, plantillas, experiencias, campañas, activos SVG generados, retención, capas de configuración con bloqueos, planes y overrides de features, releases y rollouts, operación (incidencias, mantenimiento, consumibles, documentos, anuncios), usuarios con roles y 14 días de historial de sesiones. Incluye generadores con semilla de flota (`generateFleet`) y de historial (`generateSessionHistory`).

Es el insumo del seed del control-plane, del modo standalone del agente de estación, del admin y del kiosco. Nada usa `Math.random` ni `Date.now`: el "hoy" es `DEMO_NOW = 2026-09-09T12:00:00Z` y toda aleatoriedad pasa por `src/prng.ts` (mulberry32 con semilla textual).

## Cómo se usa
```ts
import { DEMO_IDS, DEMO_NOW, DEMO_USERS, assetContent, demoDataset, generateFleet, generateSessionHistory } from '@psp/fixtures';

const data = demoDataset();                                   // DemoDataset completo, 36 colecciones, misma salida en cada llamada
const fleet = generateFleet(data, 100, 'demo');               // 100 máquinas mch_sim_0001… con ubicaciones nuevas y capas mínimas
const history = generateSessionHistory({ ...data, machines: [...data.machines, ...fleet.machines], locations: [...data.locations, ...fleet.locations] }, 30, 'metrics');
const { mime, bytes } = assetContent(DEMO_IDS.asset.logoLumina); // SVG determinista; sha256(bytes) === asset.hash
```

- `DEMO_IDS`: todos los ids fijos (organizaciones, franquicias, regiones, ubicaciones, máquinas, productos, presets, plantillas, activos, capas, planes, releases…). Los consumidores usan estas constantes, no literales.
- `DEMO_USERS`: los siete usuarios de `docs/operacion/como-correr.md` con `password` (`demo`), `passwordHash` (sha256 hex), `roleKey` y `scope`. `User` nunca lleva la credencial; el seed la toma de aquí.
- `demoDatasetWithoutSessions()`: el dataset sin historial, para seeds que generan su propio historial.
- `TECH_PANEL_PIN` (`2468`): su sha256 va en `techPanel.pinHash` de las capas de organización.
- `assetContent(assetId)`: contenido SVG de los 19 activos; `Asset.hash`, `bytes` y `path` (`assets/<hash>.svg`) se derivan del mismo contenido, así el manifiesto del bundle y el almacén de activos coinciden.
- `SessionHistoryBase` y `FleetBase` son subconjuntos de `DemoDataset`: se puede pasar el dataset entero.

### Escenarios de `docs/requisitos-producto.md`
| Escenario | Qué lo demuestra | Ids |
|---|---|---|
| A · Foto documental | Estación universitaria con auto-captura, preset MX 35×45 y hoja 4x6 con marcas de corte | `mch_demo_doc_01`, `prd_doc_universitaria`, `prd_doc_graduacion`, `pst_mx_universidad`, `tpl_sheet_4x6`, `edp_doc_neutral` |
| B · Foto divertida | Experiencia de cuatro poses con stickers, presets creativos y tira 2x6 con variante `en` | `prd_tira_amigos`, `exp_best_friends`, `tpl_strip_2x6`, `ast_sticker_*`, `edp_vivid`/`edp_retro`/`edp_bw_soft` |
| C · Dos máquinas diferentes | Documental (foto 4x6/5x7) vs. térmica (58 mm B/N) con productos, branding y precios distintos; la premium añade pago con terminal | `mch_demo_doc_01`, `mch_demo_thermal_01`, `mch_demo_premium_01`, `hw_doc_station`, `hw_thermal_kiosk`, `hw_premium_booth`, `prd_foto_recibo`, `tpl_thermal_58` |
| D · Franquicia | Norte administra sus máquinas y capas; su `branding.palette.primary` es rechazado por el bloqueo `mandatory` de la organización; su precio de tira (7000) cae dentro del rango 5000–12000 | `fr_norte`, `usr_franq_norte`, `cfg_fr_norte`, `cfg_org_lumina`, `prr_norte_tira`, `prr_org_tira_amigos`, `pav_ia_norte_on` |
| E · Campaña nacional | Campaña programada, obligatoria, con patrocinador y `configOverlay`, dirigida a regiones Norte y Centro; la franquicia sólo edita `branding.footerText` | `cmp_navidad_2026`, `prd_retrato_navidad`, `exp_christmas`, `tpl_postcard_5x7`, `ast_frame_navidad`, `ast_logo_sponsor_aurora` |
| F · Fallo de impresora | Cabina premium sin papel (`active_with_warnings`, capacidad `printer.photo` no operativa, consumible en 0), térmica fuera de servicio esperando refacción, bitácoras de técnico | `inc_premium_paper`, `inc_terminal_thermal`, `mch_demo_premium_01`, `mch_terminal_01`, `mnt_doc_paper`, `chk_doc_station` |
| G · Privacidad | Políticas de retención con texto al cliente; los productos documentales borran al terminar y las sesiones registran `retention.deleteAt`/`deletedAt` sin fotografías | `ret_delete_on_finish`, `ret_temp_30min`, `ret_metadata_only`, `ret_derivatives_24h`, `cfg_org_lumina` (`privacy.defaultRetentionPolicyId`) |
| H · Deployment gradual | 0.1.0 completada en toda la flota; 0.2.0 en piloto por etiqueta `piloto` + `mch_demo_doc_01` (2 completadas, 1 descargando); 0.3.0-pilot.1 en canal pilot; `generateFleet` escala a 100+ máquinas | `rel_0_1_0`, `rel_0_2_0`, `rel_0_3_0_pilot`, `rol_010_all`, `rol_020_pilot`, `mch_demo_unit_01` |
| I · Feature restringida | `ai.experiences` oculta en la organización y habilitada sólo en Norte; el producto IA está deshabilitado en la organización y habilitado en Norte; FotoRápida lo tiene bloqueado por plan | `fov_ai_lumina_hidden`, `fov_ai_norte`, `pav_ia_org_off`, `pav_ia_norte_on`, `prd_ia_anime`, `plan_starter`, `plan_enterprise` |
| J · Cambio de preset oficial | `pst_mx_universidad` tiene v1 y v2 (`currentVersion` 2, publicada el 2 de septiembre); las sesiones anteriores registran `presetVersion` 1 y las nuevas 2 | `pst_mx_universidad`, `presetVersions`, `sessionRecords` |

### Decisiones y desviaciones documentadas
- `techPanel.pinHash` va en `cfg_org_lumina` y `cfg_org_fotorapida`, no en `cfg_platform`: el registro `CONFIG_KEYS` sólo lo admite en organización, franquicia y máquina; en plataforma el motor lo rechazaría y el PIN `2468` no llegaría al kiosco.
- Hay nueve plantillas (no seis): cuatro hojas documentales (`tpl_sheet_4x6` 35×45, `tpl_sheet_5x7` 50×70, `tpl_sheet_4x6_51x51` visa, `tpl_sheet_4x6_25x30` credencial) para que `documentSheet` coincida con las medidas físicas de cada preset; la prueba lo verifica.
- La impresora de la cabina premium declara `2x6in-strip` además de 4x6/6x8/5x7 (las tiras se cortan de hojas 4x6); así `prd_tira_amigos` es imprimible en la cabina y el historial de sesiones lo respeta.
- `prd_fr_tira` (FotoRápida) usa `exp_couple` y `tpl_strip_2x6`, plantillas y experiencia globales; la máquina de Bogotá es documental, por lo que no genera sesiones de tira hasta que exista una cabina en Colombia.
- El precio de `prd_doc_universitaria` es `mandatory` a nivel organización; aun así `cmp_regreso_clases` lo baja a 7000 en la universidad porque, en `resolvePrice`, la sobrescritura de campaña es la última palabra.
- La franquicia Norte tiene dos máquinas en el dataset base; las cinco del escenario D se completan con `generateFleet`.
- El historial de sesiones sólo cubre máquinas `active`, `active_with_warnings` y `demo`, dentro del horario de la ubicación y con productos imprimibles por la máquina; ~84 % completadas, `paid_simulated` con adaptador `mock` en máquinas de pago, `demo` en la unidad demo y `courtesy` en el hotel.

## Cómo se prueba
```bash
pnpm --filter @psp/fixtures typecheck && pnpm --filter @psp/fixtures test
```
Las pruebas validan cada colección con su esquema zod, la integridad referencial de todas las referencias cruzadas (jerarquía, catálogo, presets↔hojas, plantillas dentro del lienzo, activos, campañas, capas, features, releases, operación y sesiones), el determinismo (`demoDataset`, `generateFleet`, `generateSessionHistory`, `assetContent` con hash), los escenarios I, J, E, C y los usuarios prometidos, y la distribución del historial (≥ 25 sesiones por día). `packages/bundler` materializa además todas las máquinas del dataset en sus propias pruebas.
