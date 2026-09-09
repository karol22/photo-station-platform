# @psp/ui

## Propósito
Design system compartido por el kiosco táctil y la consola de administración: tokens CSS (`--psp-*`), tema derivado del branding del bundle, componentes grandes y de alto contraste para kiosco y componentes densos para administración. Los componentes son agnósticos de idioma y de negocio: todo texto visible llega por props.

## Cómo se usa
```tsx
import '@psp/ui/styles.css';
import { ThemeProvider, applyBrandingTheme, KioskShell, BigButton, ChoiceCard, DataTable } from '@psp/ui';

// Kiosco: clase raíz psp-kiosk; el tema se calcula desde branding.palette.* del bundle.
<div className="psp-kiosk">
  <ThemeProvider values={bundle.effective.values}>
    <KioskShell header={...} footer={...}>
      <ChoiceCard title={tl(locale, product.displayName)} price={formatMoney(price.final, locale)} state="available" onSelect={...} />
      <BigButton variant="primary" size="xl" onClick={...}>{t(locale, 'common.continuar')}</BigButton>
    </KioskShell>
  </ThemeProvider>
</div>

// Admin: clase raíz psp-admin.
<DataTable columns={columns} rows={rows} rowKey="id" loading={loading} empty={{ title: t('common.sinResultados') }} page={page} pageSize={50} total={total} onPageChange={setPage} />
```

Componentes:

| Grupo | Componentes |
|---|---|
| Tema | `ThemeProvider`, `useTheme`, `applyBrandingTheme`, tokens en `src/styles.css` |
| Kiosco | `KioskShell`, `BigButton`, `ChoiceCard` (`choiceStateFromAvailability`), `Countdown`, `ProgressDots`, `TimeoutBar`, `CriteriaList`, `InstructionBanner`, `PriceTag`, `StatusPill`, `Sheet`, `Notice`, `ErrorPanel`, `NumericKeypad`, `TouchSlider`, `Toggle`, `ThumbGrid`, `CompareView`, `LangSwitch`, `Spinner`, `IconButton` |
| Admin | `AppShell`, `PageHeader`, `DataTable`, `FilterBar`, `StatCard`, `Badge`, `Tabs`, `Field`, `Input`, `Select`, `Textarea`, `Switch`, `NumberInput`, `ColorInput`, `ProvenanceTag`, `LockTag`, `ConfirmDialog`, `Drawer`, `EmptyState`, `Skeleton`, `Alert`, `Timeline`, `KeyValue`, `Breadcrumbs`, `Toolbar` |
| Compartidos | `Card`, `Icon` (`ICON_NAMES`), `VisuallyHidden`, `cx` |

Criterios de accesibilidad aplicados: controles táctiles de al menos 64 px en modo kiosco, contraste calculado por luminancia para cada color de marca, estados que combinan icono y texto (nunca sólo color), una acción principal por pantalla, confirmaciones para acciones irreversibles.

## Cómo se prueba
```bash
pnpm --filter @psp/ui typecheck
pnpm --filter @psp/ui test
```
Las pruebas renderizan cada componente con `react-dom/server` y verifican el cálculo de contraste del tema.
