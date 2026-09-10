/**
 * @psp/ui · design system compartido por el kiosco táctil y la consola de administración.
 * Importar `@psp/ui/styles.css` una vez por app y aplicar la clase raíz `psp-kiosk` o `psp-admin`.
 */

// Tema y tokens
export {
  BRANDING_PALETTE_KEYS,
  DEFAULT_PALETTE,
  applyBrandingTheme,
  buildThemeVariables,
  contrastColor,
  contrastRatio,
  mixColors,
  parseHexColor,
  readBrandingPalette,
  relativeLuminance,
  resolvePalette,
  toHex,
} from './theme';
export type { BrandingPalette, BrandingPaletteKey, ContrastOptions, Rgb, ThemeRoot } from './theme';
export { readBrandingAccents, DEFAULT_ACCENTS } from './theme';
export { ThemeProvider, useTheme } from './ThemeProvider';
export type { ThemeContextValue, ThemeMode, ThemeProviderProps } from './ThemeProvider';

// Tipos comunes y utilidades
export type { BaseProps, LinkRenderer, Tone } from './types';
export { cx, snapToStep } from './internal';
export { Icon, ICON_NAMES } from './icons';
export type { IconName, IconProps } from './icons';
export { CATALOG } from './catalog';
export type { UiCatalogEntry } from './catalog';

// Compartidos
export { VisuallyHidden } from './shared/VisuallyHidden';
export type { VisuallyHiddenProps } from './shared/VisuallyHidden';
export { Card } from './shared/Card';
export type { CardProps } from './shared/Card';

// Kiosco
export { KioskShell } from './kiosk/KioskShell';
export type { KioskShellProps } from './kiosk/KioskShell';
export { BlobFace, BLOB_VARIANTS } from './kiosk/BlobFace';
export type { BlobExpression, BlobFaceProps, BlobVariant } from './kiosk/BlobFace';
export { BigButton } from './kiosk/BigButton';
export type { BigButtonProps, BigButtonSize, BigButtonVariant } from './kiosk/BigButton';
export { ChoiceCard, CHOICE_STATE_ICON, choiceStateFromAvailability } from './kiosk/ChoiceCard';
export type { ChoiceCardProps, ChoiceCardState } from './kiosk/ChoiceCard';
export { Countdown } from './kiosk/Countdown';
export type { CountdownProps } from './kiosk/Countdown';
export { SoundBoard, SOUND_SCORES, buzz, cueDuration, volumeToGain } from './kiosk/sound';
export { Marquee, MARQUEE_BULBS } from './kiosk/Marquee';
export type { MarqueeCadence, MarqueeProps } from './kiosk/Marquee';
export { assignAccentRoles, hueOf } from './theme';
export type { AccentRoles } from './theme';
export type { AudioContextLike, SoundBoardOptions, SoundCue, SoundTone } from './kiosk/sound';
export { ProgressDots } from './kiosk/ProgressDots';
export type { ProgressDotsProps } from './kiosk/ProgressDots';
export { TimeoutBar, formatClock } from './kiosk/TimeoutBar';
export type { TimeoutBarProps } from './kiosk/TimeoutBar';
export { CriteriaList, CRITERION_ICON } from './kiosk/CriteriaList';
export type { CriteriaItem, CriteriaListProps, CriterionStatus } from './kiosk/CriteriaList';
export { InstructionBanner } from './kiosk/InstructionBanner';
export type { InstructionBannerProps, InstructionTone } from './kiosk/InstructionBanner';
export { PriceTag } from './kiosk/PriceTag';
export type { PriceTagProps } from './kiosk/PriceTag';
export { StatusPill, TONE_ICON } from './kiosk/StatusPill';
export type { StatusPillProps } from './kiosk/StatusPill';
export { Sheet } from './kiosk/Sheet';
export type { SheetProps } from './kiosk/Sheet';
export { Notice } from './kiosk/Notice';
export type { NoticePosition, NoticeProps } from './kiosk/Notice';
export { ErrorPanel } from './kiosk/ErrorPanel';
export type { ErrorPanelProps, ErrorPanelTone } from './kiosk/ErrorPanel';
export { NumericKeypad, applyKeypadKey } from './kiosk/NumericKeypad';
export type { KeypadKey, NumericKeypadProps } from './kiosk/NumericKeypad';
export { TouchSlider } from './kiosk/TouchSlider';
export type { TouchSliderProps } from './kiosk/TouchSlider';
export { Toggle } from './kiosk/Toggle';
export type { ToggleProps } from './kiosk/Toggle';
export { ThumbGrid, toggleSelection } from './kiosk/ThumbGrid';
export type { ThumbGridProps, ThumbItem } from './kiosk/ThumbGrid';
export { CompareView } from './kiosk/CompareView';
export type { CompareSide, CompareViewProps } from './kiosk/CompareView';
export { LangSwitch } from './kiosk/LangSwitch';
export type { LangOption, LangSwitchProps } from './kiosk/LangSwitch';
export { Spinner } from './kiosk/Spinner';
export type { SpinnerProps, SpinnerSize } from './kiosk/Spinner';
export { IconButton } from './kiosk/IconButton';
export type { IconButtonProps, IconButtonSize, IconButtonVariant } from './kiosk/IconButton';

// Admin
export { AppShell } from './admin/AppShell';
export type { AppShellNavItem, AppShellProps } from './admin/AppShell';
export { PageHeader } from './admin/PageHeader';
export type { PageHeaderProps } from './admin/PageHeader';
export { DataTable } from './admin/DataTable';
export type { DataTableColumn, DataTableEmpty, DataTablePagination, DataTableProps, DataTableSort } from './admin/DataTable';
export { FilterBar } from './admin/FilterBar';
export type { FilterBarProps, FilterChip } from './admin/FilterBar';
export { StatCard } from './admin/StatCard';
export type { StatCardProps, StatDelta } from './admin/StatCard';
export { Badge } from './admin/Badge';
export type { BadgeProps } from './admin/Badge';
export { Tabs } from './admin/Tabs';
export type { TabItem, TabsProps } from './admin/Tabs';
export { Field, useFieldContext } from './admin/Field';
export type { FieldContextValue, FieldProps } from './admin/Field';
export { Input } from './admin/Input';
export type { InputProps } from './admin/Input';
export { Select } from './admin/Select';
export type { SelectOption, SelectProps } from './admin/Select';
export { Textarea } from './admin/Textarea';
export type { TextareaProps } from './admin/Textarea';
export { Switch } from './admin/Switch';
export type { SwitchProps } from './admin/Switch';
export { NumberInput } from './admin/NumberInput';
export type { NumberInputProps } from './admin/NumberInput';
export { ColorInput, normalizeHex } from './admin/ColorInput';
export type { ColorInputProps } from './admin/ColorInput';
export { ProvenanceTag, PROVENANCE_GLYPH } from './admin/ProvenanceTag';
export type { ProvenanceLevel, ProvenanceTagProps } from './admin/ProvenanceTag';
export { LockTag, LOCK_ICON } from './admin/LockTag';
export type { LockPolicy, LockTagProps } from './admin/LockTag';
export { ConfirmDialog } from './admin/ConfirmDialog';
export type { ConfirmDialogProps } from './admin/ConfirmDialog';
export { Drawer } from './admin/Drawer';
export type { DrawerProps } from './admin/Drawer';
export { EmptyState } from './admin/EmptyState';
export type { EmptyStateProps } from './admin/EmptyState';
export { Skeleton } from './admin/Skeleton';
export type { SkeletonProps } from './admin/Skeleton';
export { Alert } from './admin/Alert';
export type { AlertProps } from './admin/Alert';
export { Timeline } from './admin/Timeline';
export type { TimelineItem, TimelineProps } from './admin/Timeline';
export { KeyValue } from './admin/KeyValue';
export type { KeyValueItem, KeyValueProps } from './admin/KeyValue';
export { Breadcrumbs } from './admin/Breadcrumbs';
export type { BreadcrumbItem, BreadcrumbsProps } from './admin/Breadcrumbs';
export { Toolbar } from './admin/Toolbar';
export type { ToolbarProps } from './admin/Toolbar';
export { Button } from './admin/Button';
export type { ButtonProps, ButtonSize, ButtonVariant } from './admin/Button';
