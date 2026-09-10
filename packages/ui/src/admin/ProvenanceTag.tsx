import type { ComponentProps } from 'react';
import { cx } from '../internal';
import { Icon } from '../icons';

/** Nivel del que proviene un valor de configuración (jerarquía + blueprint, campaña y default). */
export type ProvenanceLevel =
  | 'platform'
  | 'organization'
  | 'blueprint'
  | 'franchise'
  | 'region'
  | 'location'
  | 'machine'
  | 'campaign'
  | 'default';

/** Glifo por nivel: además del color, la letra distingue la procedencia. */
export const PROVENANCE_GLYPH: Record<ProvenanceLevel, string> = {
  platform: 'P',
  organization: 'O',
  blueprint: 'B',
  franchise: 'F',
  region: 'R',
  location: 'L',
  machine: 'M',
  campaign: 'C',
  default: 'D',
};

export interface ProvenanceTagProps extends Omit<ComponentProps<'span'>, 'children'> {
  level: ProvenanceLevel;
  /** Texto visible ("de Marca", "de Franquicia", "valor por defecto"). */
  label: string;
  /** Nombre de la entidad de origen. */
  entityName?: string;
  /** El valor sobrescribe al heredado en este nivel. */
  overridden?: boolean;
  /** Texto del marcador de sobrescritura ("sobrescrito"). */
  overriddenLabel?: string;
  /** Acción para volver al valor heredado; muestra un botón con `revertLabel`. */
  onRevert?: () => void;
  revertLabel?: string;
  size?: 'sm' | 'md';
  'data-testid'?: string;
}

/** Procedencia visible de un valor de configuración (requisito 36). */
export function ProvenanceTag({
  level,
  label,
  entityName,
  overridden = false,
  overriddenLabel,
  onRevert,
  revertLabel,
  size = 'sm',
  className,
  ...rest
}: ProvenanceTagProps) {
  return (
    <span className={cx('psp-provenance', className)} data-level={level} data-size={size} data-overridden={overridden || undefined} {...rest}>
      <span className="psp-provenance__glyph" aria-hidden="true">
        {PROVENANCE_GLYPH[level]}
      </span>
      <span className="psp-provenance__label">
        {label}
        {entityName !== undefined ? <span className="psp-provenance__entity">{entityName}</span> : null}
      </span>
      {overridden ? (
        <span className="psp-provenance__override">
          <span aria-hidden="true">
            <Icon name="edit" />
          </span>
          {overriddenLabel !== undefined ? <span>{overriddenLabel}</span> : null}
        </span>
      ) : null}
      {onRevert && revertLabel !== undefined ? (
        <button type="button" className="psp-provenance__revert" onClick={onRevert}>
          <Icon name="retry" />
          <span>{revertLabel}</span>
        </button>
      ) : null}
    </span>
  );
}
