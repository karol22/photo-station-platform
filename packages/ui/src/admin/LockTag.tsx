import type { ComponentProps } from 'react';
import { cx } from '../internal';
import { Icon, type IconName } from '../icons';

export type LockPolicy = 'mandatory' | 'editable' | 'range' | 'hidden';

export const LOCK_ICON: Record<LockPolicy, IconName> = {
  mandatory: 'lock',
  editable: 'edit',
  range: 'range',
  hidden: 'eyeOff',
};

export interface LockTagProps extends Omit<ComponentProps<'span'>, 'children'> {
  policy: LockPolicy;
  /** Texto visible ("Obligatorio", "Editable", "Dentro de rango", "Oculto"). */
  label: string;
  /** Detalle ("10–100", "es, en"). */
  detail?: string;
  /** Quién fijó el bloqueo ("Marca"). */
  setBy?: string;
  size?: 'sm' | 'md';
  'data-testid'?: string;
}

/** Política de bloqueo de una clave de configuración, con icono y texto. */
export function LockTag({ policy, label, detail, setBy, size = 'sm', className, ...rest }: LockTagProps) {
  return (
    <span className={cx('psp-locktag', className)} data-policy={policy} data-size={size} title={setBy} {...rest}>
      <span className="psp-locktag__icon" aria-hidden="true">
        <Icon name={LOCK_ICON[policy]} />
      </span>
      <span className="psp-locktag__label">{label}</span>
      {detail !== undefined ? <span className="psp-locktag__detail">{detail}</span> : null}
      {setBy !== undefined ? <span className="psp-locktag__setby">{setBy}</span> : null}
    </span>
  );
}
