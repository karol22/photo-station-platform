# APIs públicas de los paquetes

Este documento fija la superficie pública de cada paquete de `packages/`. Los consumidores (apps, CLI, otros paquetes) programan contra estas firmas; los implementadores las respetan. Toda función aquí es pura salvo que se indique `async` o "I/O". Los tipos con mayúscula que no se definen aquí vienen de `@psp/contracts`.

Regla: cada paquete exporta además `CATALOG: CatalogEntry[]` con sus capacidades registrables.

---

## @psp/domain

```ts
// identificadores y códigos
makeId(prefix: string, random?: () => string): string           // 'mch_' + 12 chars base36; determinista si se inyecta random
shortCode(seed: string, length?: number): string                  // código humano A-Z2-9 sin ambigüedad, determinista
stableHash(value: unknown): string                                // sha256 hex de stableStringify (misma implementación que config-engine)
stableStringify(value: unknown): string

// jerarquía y alcance
interface HierarchyIndex { organizations: Map<Id, Organization>; franchises: Map<Id, Franchise>; regions: Map<Id, Region>; locations: Map<Id, Location>; machines: Map<Id, Machine> }
buildHierarchyIndex(data: { organizations: Organization[]; franchises: Franchise[]; regions: Region[]; locations: Location[]; machines: Machine[] }): HierarchyIndex
scopeChain(index: HierarchyIndex, target: Scope): Scope[]         // [platform, organization, franchise?, region?, location?, machine?] hasta el target
scopeContains(index: HierarchyIndex, outer: Scope, inner: Scope): boolean
machinesInScope(index: HierarchyIndex, scope: Scope): Machine[]
resolveRolloutTargets(index: HierarchyIndex, targets: RolloutTarget[]): Machine[]   // percentage determinista: stableHash(seed + machineId) ordena y toma el %

// rbac
ROLE_DEFINITIONS: Role[]                                          // los 13 roles con permisos
resolvePrincipal(user: User, assignments: RoleAssignment[], supportAccesses: SupportAccess[], now: Date): Principal
can(principal: Principal, permission: PermissionKey, target: Scope, index: HierarchyIndex): boolean
visibleScopes(principal: Principal): Scope[]                      // alcances desde los que el usuario ve algo
narrowListToPrincipal<T extends { organizationId: Id; franchiseId?: Id; regionId?: Id; locationId?: Id; id?: Id }>(items: T[], principal: Principal, index: HierarchyIndex, permission: PermissionKey, level: ScopeLevel): T[]

// capacidades y disponibilidad
capabilityMap(machine: Machine): Partial<Record<CapabilityKey, MachineCapabilityState>>
checkCapabilities(required: CapabilityKey[], machine: Machine): { missing: CapabilityKey[]; notOperational: CapabilityKey[] }
computeAvailability(input: { products: Product[]; machine: Machine; features: FeatureState[]; printers: PrinterRuntime[]; availabilities: ProductAvailability[]; chain: Scope[]; now: Date; timezone: string; maintenance: boolean }): ProductAvailabilityState[]

// features y entitlements
resolveFeatures(input: { chain: Scope[]; overrides: FeatureOverride[]; entitlements: Entitlement[]; plans: EntitlementPlan[]; machine?: Machine; now: Date }): FeatureState[]
featureMode(features: FeatureState[], key: FeatureKey): FeatureMode

// precios y promociones
resolvePrice(input: { product: Product; rules: PriceRule[]; promotions: Promotion[]; campaigns: Campaign[]; chain: Scope[]; now: Date; timezone: string; businessMode: string }): ResolvedPrice
validatePriceRule(rule: PriceRule, parentRules: PriceRule[]): { ok: boolean; reason?: string }   // respeta lock range/mandatory del padre
applyPromotion(list: Money, promo: Promotion): Money

// tiempo local
localTimeParts(now: Date, timezone: string): { hhmm: string; day: number; isoDate: string }
scheduleMatches(schedules: DailySchedule[], now: Date, timezone: string): boolean     // lista vacía = siempre
windowMatches(window: { start: string; end?: string } | undefined, now: Date): boolean
inMaintenanceWindow(hhmm: string, start?: string, end?: string): boolean               // soporta ventanas que cruzan medianoche
compareSemver(a: string, b: string): number

// sesiones
SESSION_TRANSITIONS: Record<SessionStage, SessionStage[]>
canTransition(from: SessionStage, to: SessionStage): boolean
stagesForProduct(product: Product, opts: { paymentRequired: boolean; consentRequired: boolean }): SessionStage[]   // recorrido ordenado
computeTimers(effectiveValues: Record<string, unknown>, product: Product, accessible: boolean): SessionTimers
resolveRetentionPolicy(policies: RetentionPolicy[], product: Product, effectiveValues: Record<string, unknown>): RetentionPolicy
retentionDeadline(policy: RetentionPolicy, endedAt: Date): Date | undefined
commercialStateFor(input: { businessMode: string; paymentState: PaymentState; isDemo: boolean; promotionIds: Id[] }): CommercialState
sessionRecordFrom(session: StationSession, ctx: { machine: Machine; softwareVersion: string; endedAt?: Date; result?: SessionResult }): SessionRecord
nextReleaseStatus(current: MachineReleaseStatus, event: 'assign' | 'download' | 'ready' | 'install' | 'complete' | 'fail' | 'rollback' | 'pause' | 'resume'): MachineReleaseStatus

// auditoría
auditDiff(before: unknown, after: unknown): { before: unknown; after: unknown }   // sólo claves que cambian (primer nivel)
```

## @psp/config-engine

```ts
interface ResolveInput { layers: ConfigLayer[]; blueprint?: ConfigLayer; campaigns?: Array<{ campaign: Campaign; layer: ConfigLayer }>; definitions?: ConfigKeyDefinition[]; now: Date; timezone: string }
resolveEffectiveConfig(input: ResolveInput): EffectiveConfig
// orden: defaults del registro → platform → organization → blueprint → franchise → region → location → machine → campañas activas por prioridad.
// Un nivel sólo puede escribir una clave si su definición lo permite (editableAt) y ningún nivel superior la bloqueó (mandatory/hidden; range valida min/max/allowed). Lo rechazado va a `rejected`.
explainKey(effective: EffectiveConfig, key: string): { value: unknown; provenance: ProvenanceEntry; lock?: ConfigLock; definition?: ConfigKeyDefinition }
validateLayer(layer: ConfigLayer, parents: ConfigLayer[], definitions?: ConfigKeyDefinition[]): { ok: boolean; violations: Array<{ key: string; reason: string }> }
layerRank(level: ConfigLevel): number
stableStringify(value: unknown): string
stableHash(value: unknown): string                                // sha256 puro en TS, síncrono, mismo resultado en Node y navegador
buildBundle(input: Omit<ConfigBundle, 'version' | 'contractsVersion'>): ConfigBundle   // version = stableHash del contenido sin generatedAt
bundleDiff(a: ConfigBundle, b: ConfigBundle): { configKeys: string[]; productsAdded: Id[]; productsRemoved: Id[]; pricesChanged: Id[]; campaignsChanged: Id[]; featuresChanged: FeatureKey[]; templatesChanged: Id[]; presetsChanged: Id[] }
```

## @psp/vision

```ts
type ImageDataLike = { data: Uint8ClampedArray; width: number; height: number }
interface Box { x: number; y: number; w: number; h: number }                      // normalizado 0..1
interface FaceLandmarks { points: Array<{ x: number; y: number; z?: number }>; box: Box; blendshapes?: Record<string, number>; headPose?: { yawDeg: number; pitchDeg: number; rollDeg: number }; score: number }
interface FrameMetrics { brightness: number; contrast: number; sharpness: number; backgroundUniformity: number; glare: number }   // 0..1 salvo sharpness (varianza laplaciana)
interface FrameAnalysis { width: number; height: number; faces: FaceLandmarks[]; metrics: FrameMetrics; atMs: number }
interface FaceAnalyzer { readonly kind: 'mediapipe' | 'mock'; init(): Promise<void>; analyze(frame: ImageDataLike, atMs: number): Promise<FrameAnalysis>; dispose(): void }
computeFrameMetrics(img: ImageDataLike, faceBox?: Box): FrameMetrics                // puro; submuestrea para velocidad
class MockFaceAnalyzer implements FaceAnalyzer { constructor(script?: (atMs: number) => FaceLandmarks[]) }   // por defecto: un rostro centrado ideal
createMediaPipeAnalyzer(opts: { modelUrl: string; wasmBaseUrl: string; numFaces?: number }): FaceAnalyzer   // en './adapters/mediapipe.ts', sólo navegador, import dinámico
syntheticFace(opts: Partial<{ cx: number; cy: number; height: number; roll: number; yaw: number; pitch: number; eyesOpen: number; smile: number }>): FaceLandmarks   // para pruebas y para la fuente de cámara sintética

type VisionCriterionKey = 'face.detected' | 'face.count' | 'face.size' | 'face.vertical' | 'face.horizontal' | 'head.roll' | 'head.yaw' | 'head.pitch' | 'eyes.open' | 'gaze.front' | 'face.obstruction' | 'light.low' | 'light.high' | 'contrast' | 'background.uniform' | 'shadows' | 'sharpness' | 'glasses.glare' | 'expression' | 'framing'
type InstructionKey = 'move_left' | 'move_right' | 'move_closer' | 'move_back' | 'chin_up' | 'chin_down' | 'look_front' | 'head_straight' | 'open_eyes' | 'no_smile' | 'remove_glasses' | 'fix_hair' | 'wait_focus' | 'only_one_person' | 'no_face' | 'more_light' | 'less_light' | 'plain_background' | 'hold_still' | 'ok'
VISION_CRITERIA: Array<{ key: VisionCriterionKey; blocking: boolean; name: LocalizedText }>
interface CriterionResult { key: VisionCriterionKey; status: 'ok' | 'warn' | 'block' | 'na'; instruction: InstructionKey; value?: number }
interface ComplianceResult { criteria: CriterionResult[]; canAutoCapture: boolean; primaryInstruction: InstructionKey; score: number; crop?: { x: number; y: number; w: number; h: number } }   // crop en px del frame
evaluateDocumentCompliance(analysis: FrameAnalysis, spec: DocumentPresetSpec): ComplianceResult
computeDocumentCrop(face: FaceLandmarks, spec: DocumentPresetSpec, frame: { width: number; height: number }): { x: number; y: number; w: number; h: number }
evaluatePoseGuidance(analysis: FrameAnalysis, guidance: PoseGuidance | undefined): { ok: boolean; hints: InstructionKey[] }   // orientativo, nunca bloquea
class AutoCaptureController { constructor(opts: { stabilityMs: number; cooldownMs?: number }); update(result: ComplianceResult, atMs: number): { state: 'idle' | 'stabilizing' | 'ready' | 'fired' | 'cooldown'; progress: number; shouldCapture: boolean }; reset(): void }
```

## @psp/imaging

```ts
type Raster = { width: number; height: number; data: Uint8ClampedArray }   // RGBA, compatible con ImageData
createRaster(width, height, fill?: [r, g, b, a]): Raster
cloneRaster(r): Raster
// operaciones puras (devuelven un Raster nuevo)
crop(r, rect: { x; y; w; h }): Raster
resize(r, width, height): Raster                                  // bilineal
rotate90(r, times: number): Raster
rotateSmall(r, degrees: number, background?: [r, g, b, a]): Raster   // ±15°, bilineal
mirrorH(r): Raster
brightness(r, amount: number /* -1..1 */), contrast(r, amount), exposure(r, stops), saturation(r, amount), temperature(r, amount), grayscale(r), sharpen(r, amount 0..1), vignette(r, strength 0..1), blurBox(r, radius)
blend(base: Raster, overlay: Raster, x: number, y: number, opacity?: number): Raster
fillRect(r, rect, color): Raster
// pipeline de edición
type EditOpKey = 'crop' | 'rotate' | 'levelRotation' | 'mirror' | 'brightness' | 'contrast' | 'exposure' | 'saturation' | 'temperature' | 'grayscale' | 'sharpen' | 'vignette' | 'preset' | 'backgroundAdjust' | 'frame' | 'sticker' | 'text' | 'overlay'
EDIT_OPS: Record<EditOpKey, { tool: EditingTool; documentSafe: boolean; params: Record<string, { min?: number; max?: number; default?: unknown }> }>
validateEditOps(ops: EditOp[], allowedTools: EditingTool[]): { ok: boolean; rejected: EditOp[] }
applyEditOps(r: Raster, ops: EditOp[], resources?: { assets?: Record<Id, Raster> }): Raster   // ignora ops de texto/sticker si no hay recursos (documentado)
editingPresetToOps(preset: EditingPreset): EditOp[]
// composición (plan → primitivas absolutas en px)
type Primitive = { kind: 'fill'; rect; color } | { kind: 'photo'; rect; slotIndex; fit; radiusPx; borderPx; borderColor } | { kind: 'asset'; rect; assetId; fit; opacity } | { kind: 'logo'; rect; role: LogoRole; fit } | { kind: 'text'; rect; text: string; style: { fontFamily; sizePx; color; align; weight } } | { kind: 'cutMarks'; rects: Array<{ x; y; w; h }>; lengthPx } | { kind: 'qr'; rect; payload: string }
type RenderPlan = { widthPx: number; heightPx: number; dpi: number; primitives: Primitive[] }
mmToPx(mm: number, dpi: number): number
selectVariant(template: PrintTemplate, selector: TemplateVariantSelector): { elements: TemplateElement[]; canvas: { widthMm; heightMm } }
planTemplate(template: PrintTemplate, ctx: { selector?: TemplateVariantSelector; locale: LocaleCode; tokens: Record<string, string>; photoCount: number }): RenderPlan
planDocumentSheet(template: PrintTemplate, photo: { widthMm; heightMm }, copies: number, opts?: { cutMarks?: boolean; gutterMm?: number }): { plan: RenderPlan; fitted: number; sheets: number }   // empaqueta N copias, orientación automática
renderPlan(plan: RenderPlan, sources: { photos: Raster[]; assets?: Record<Id, Raster>; logos?: Partial<Record<LogoRole, Raster>> }): Raster   // puro; el texto se dibuja con la fuente bitmap interna 5x7 escalada
encodePNG(r: Raster): Uint8Array                                  // puro, deflate sin compresión (válido, más grande)
decodePNG(bytes: Uint8Array): Raster                              // sólo PNG de 8 bits RGB/RGBA sin entrelazado (los que produce encodePNG y los navegadores)
// './browser' (sólo navegador)
canvasToRaster(source: HTMLCanvasElement | HTMLVideoElement | ImageBitmap | HTMLImageElement, opts?: { width?; height? }): Raster
rasterToCanvas(r: Raster, canvas?: HTMLCanvasElement): HTMLCanvasElement
rasterToDataUrl(r: Raster, type?: 'image/png' | 'image/jpeg', quality?: number): string
loadRaster(url: string): Promise<Raster>
renderPlanToCanvas(plan: RenderPlan, sources: { photos: CanvasImageSource[]; assets?: Record<Id, CanvasImageSource>; logos?: Partial<Record<LogoRole, CanvasImageSource>> }, canvas?: HTMLCanvasElement): HTMLCanvasElement   // texto con fuentes reales
```

## @psp/integrations

```ts
// pagos: máquina de estados pura + puerto + adaptadores
type PaymentEvent = 'start' | 'approve' | 'decline' | 'cancel' | 'expire' | 'review' | 'device_out' | 'device_ok' | 'retry'
nextPaymentState(state: PaymentState, event: PaymentEvent): PaymentState            // lanza InvalidTransition
initialPaymentState(input: { businessMode: string; isDemo: boolean; operatorStarted: boolean; terminalStatus: PaymentTerminalStatus; amount: Money }): PaymentState
interface PaymentTerminal { readonly adapter: string; status(): PaymentTerminalStatus; createIntent(input: { sessionId: Id; amount: Money; timeoutSec: number }): Promise<PaymentIntent>; cancel(intentId: Id): Promise<PaymentIntent>; get(intentId: Id): PaymentIntent | undefined; onUpdate(cb: (intent: PaymentIntent) => void): () => void; simulate(intentId: Id, outcome: 'approve' | 'decline' | 'cancel' | 'expire' | 'review' | 'device_out' | 'recover'): Promise<PaymentIntent>; setDeviceState(state: PaymentTerminalStatus): void }
class MockPaymentTerminal implements PaymentTerminal { constructor(opts: { clock: () => Date; idFactory: () => string; autoOutcome?: 'none' | 'approve' | 'decline'; autoDelayMs?: number }) }
class NayaxTerminalStub implements PaymentTerminal            // status() = 'not_configured'; createIntent lanza NotConfiguredError con el camino de integración en el mensaje
class MercadoPagoQrStub implements PaymentTerminal
createPaymentTerminal(adapter: 'none' | 'mock' | 'nayax' | 'mercadopago_qr', deps): PaymentTerminal
// IA
interface AiProvider { readonly provider: string; capabilities(): AiExperienceKey[]; submit(input: { sessionId: Id; captureId: Id; experience: AiExperienceKey; image: Uint8Array; consent: ConsentRecord }): Promise<AiJob>; get(jobId: Id): AiJob | undefined; onUpdate(cb: (job: AiJob) => void): () => void }
class MockAiProvider implements AiProvider { constructor(opts: { clock; idFactory; delayMs?: number; transform: (image: Uint8Array, experience: AiExperienceKey) => Promise<Uint8Array>; failEvery?: number }) }
class ExternalAiProviderStub implements AiProvider             // 'coming_soon'
// entrega, fiscal, CRM
interface DeliveryChannel { readonly channel: 'whatsapp' | 'sms' | 'email'; send(input: { sessionId: Id; destination: string; imageRef: string }): Promise<DeliveryRequestRecord> }
class MockDeliveryChannel implements DeliveryChannel
interface FiscalProvider { issue(input): Promise<{ state: 'not_available' | 'simulated'; ref?: string }> }
interface CrmProvider { track(event): Promise<void> }
// secretos y libro mayor
class SecretHandle { readonly name: string; reveal(): string; toString(): string /* '[secreto:name]' */; toJSON(): string }
resolveSecret(name: string, sources?: { env?: Record<string, string | undefined>; file?: Record<string, string> }): SecretHandle | undefined
class PaidCallLedger { constructor(write: (line: string) => void, existing?: string[]); record(entry: PaidCallEntry): boolean /* false si idempotencyKey ya existe */; has(idempotencyKey: string): boolean }
```

## @psp/i18n

```ts
type Locale = 'es' | 'en'
messages: Record<Locale, Record<string, string>>     // claves con puntos: common.*, kiosk.*, admin.*, errors.*, instructions.*, criteria.*, stages.*, payment.*, features.*
t(locale: Locale, key: string, params?: Record<string, string | number>): string    // {{param}}; cae a 'es'; si falta, devuelve la clave
tl(locale: Locale, text: LocalizedText | undefined, fallback?: string): string
createTranslator(locale: Locale): { t: (key, params?) => string; tl: (text) => string; locale }
formatMoney(money: Money, locale: Locale): string      // 8000 MXN → "$80.00" (es-MX) usando Intl
formatDate(iso: string, locale: Locale, timezone: string, style?: 'short' | 'long'): string
formatTime(iso: string, locale: Locale, timezone: string): string
formatNumber(n: number, locale: Locale): string
formatDuration(seconds: number, locale: Locale): string
```

## @psp/ui

Componentes React (19) con CSS propio en `src/styles.css` (importar una vez por app). Tokens en variables CSS `--psp-*`. `applyBrandingTheme(values)` mapea `branding.palette.*` a variables. Sin nombres de marca. Todos aceptan `className` y `data-testid`.

Kiosco (táctil, grande): `KioskShell`, `BigButton`, `ChoiceCard`, `Countdown`, `ProgressDots`, `TimeoutBar`, `CriteriaList`, `InstructionBanner`, `PriceTag`, `StatusPill`, `Sheet`, `Notice`, `ErrorPanel`, `NumericKeypad`, `TouchSlider`, `Toggle`, `ThumbGrid`, `CompareView`, `LangSwitch`, `Spinner`, `IconButton`.
Admin (denso): `AppShell`, `PageHeader`, `DataTable`, `FilterBar`, `StatCard`, `Badge`, `Tabs`, `Field`, `Input`, `Select`, `Textarea`, `Switch`, `NumberInput`, `ColorInput`, `ProvenanceTag`, `LockTag`, `ConfirmDialog`, `Drawer`, `EmptyState`, `Skeleton`, `Alert`, `Timeline`, `KeyValue`, `Breadcrumbs`, `Toolbar`.

## @psp/sqlite (I/O)

```ts
openDatabase(path: string | ':memory:', opts?: { wal?: boolean }): DatabaseSync
migrate(db: DatabaseSync, migrations: Array<{ name: string; sql: string }>): { applied: string[] }   // tabla _migrations
loadMigrationsDir(dir: string): Array<{ name: string; sql: string }>   // NNNN_nombre.sql ordenados
transaction<T>(db, fn: () => T): T
jsonParse<T>(v: unknown): T | undefined
jsonStringify(v: unknown): string
nowIso(clock?: () => Date): string
paginate<T>(db, input: { sql: string; countSql: string; params: unknown[]; page: number; pageSize: number; map?: (row) => T }): { items: T[]; total: number; page; pageSize }
```

## @psp/fixtures

```ts
interface DemoDataset { organizations; franchises; territories; regions; locations; machines; hardwareProfiles; blueprints; users; roleAssignments; supportAccesses; products; productAvailabilities; priceRules; promotions; presets; presetVersions; templates; experiences; editingPresets; campaigns; assets; retentionPolicies; maintenanceChecklists; configLayers; featureOverrides; entitlementPlans; entitlements; releases; rollouts; internalDocuments; announcements; incidents; maintenanceLogs; consumables; sessionRecords }   // arrays tipados con los contratos
demoDataset(): DemoDataset                                // determinista, ids fijos, validado por sus pruebas contra los contratos
generateFleet(base: DemoDataset, count: number, seed: string): { machines: Machine[]; locations: Location[]; configLayers: ConfigLayer[] }
generateSessionHistory(base: DemoDataset, days: number, seed: string): SessionRecord[]   // historial realista para métricas
DEMO_USERS: Array<{ email: string; password: string; name: string; roleKey: RoleKey; scope: Scope }>
DEMO_IDS: { org: { lumina; fotorapida }; franchise: { norte; bajio }; machine: { doc; thermal; premium; cinema; hotel; demo; bajio1; bajio2; fr1; fr2 }; ... }
assetContent(assetId: Id): { mime: string; bytes: Uint8Array }  // SVG/PNG generados deterministas
```

## @psp/bundler

```ts
interface BundleSource { organizations: Organization[]; franchises: Franchise[]; regions: Region[]; locations: Location[]; machines: Machine[]; hardwareProfiles: HardwareProfile[]; blueprints: Blueprint[]; products: Product[]; productAvailabilities: ProductAvailability[]; priceRules: PriceRule[]; promotions: Promotion[]; presets: DocumentPreset[]; presetVersions: DocumentPresetVersion[]; templates: PrintTemplate[]; experiences: Experience[]; editingPresets: EditingPreset[]; campaigns: Campaign[]; assets: Asset[]; retentionPolicies: RetentionPolicy[]; maintenanceChecklists: MaintenanceChecklist[]; configLayers: ConfigLayer[]; featureOverrides: FeatureOverride[]; entitlementPlans: EntitlementPlan[]; entitlements: Entitlement[] }   // subconjunto de DemoDataset
materializeBundle(source: BundleSource, machineId: Id, opts: { now: Date; assetUrlBase: string; catalogRevision?: string; generatedAt?: string }): ConfigBundle
// Pasos: cadena de alcance → capas (platform, org, blueprint de la máquina como capa 'blueprint', franquicia, región, ubicación, máquina) → campañas cuyo target incluya la cadena o los tags → resolveEffectiveConfig → features (resolveFeatures) → productos de la organización filtrados por disponibilidad de alcance y estado → precios (resolvePrice por producto) → presets (versión actual) y plantillas referenciadas → experiencias y presets de edición referenciados → activos referenciados por todo lo anterior (manifiesto con url = assetUrlBase + '/' + hash) → buildBundle.
computeKioskAvailability(bundle: ConfigBundle, runtime: { machine: Machine; printers: PrinterRuntime[]; maintenance: boolean; now: Date }): ProductAvailabilityState[]   // envoltura de domain.computeAvailability con los datos del bundle
```

## @psp/bundler

```ts
type BundleSource = Pick<DemoDataset, /* las 24 colecciones que participan; ver src/materialize.ts */>
materializeBundle(source: BundleSource, machineId: Id, opts: { now: Date; assetUrlBase: string; catalogRevision?: string; generatedAt?: string }): ConfigBundle
// cadena de alcance → capas (+ blueprint) → campañas aplicables → config efectiva → features → productos → precios → presets/plantillas/experiencias/presets de edición → políticas y checklists → activos referenciados → buildBundle (version = hash)
computeKioskAvailability(bundle: ConfigBundle, runtime: { machine: Machine; printers: PrinterRuntime[]; maintenance: boolean; now: Date }): ProductAvailabilityState[]
bundleChain(source: BundleSource, machineId: Id): Scope[]
bundleTimezone(source: BundleSource, machineId: Id): string
```
