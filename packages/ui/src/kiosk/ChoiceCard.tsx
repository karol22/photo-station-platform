import type { ComponentProps, ReactNode } from 'react';
import { cx } from '../internal';
import { Icon, type IconName } from '../icons';

/** Estado de presentación de una opción del kiosco. */
export type ChoiceCardState = 'available' | 'locked' | 'comingSoon' | 'unavailable';

/** Icono por estado: la diferencia nunca depende sólo del color. */
export const CHOICE_STATE_ICON: Record<Exclude<ChoiceCardState, 'available'>, IconName> = {
  locked: 'lock',
  comingSoon: 'clock',
  unavailable: 'cross',
};

/**
 * Traduce `ProductAvailabilityState` (contratos) al estado de la tarjeta.
 * `hidden` devuelve `null`: la opción no se muestra.
 */
export function choiceStateFromAvailability(availability: {
  available: boolean;
  presentation: 'show' | 'hidden' | 'locked' | 'coming_soon';
}): ChoiceCardState | null {
  if (availability.presentation === 'hidden') return null;
  if (availability.available) return 'available';
  if (availability.presentation === 'locked') return 'locked';
  if (availability.presentation === 'coming_soon') return 'comingSoon';
  return 'unavailable';
}

export interface ChoiceCardProps extends Omit<ComponentProps<'button'>, 'title' | 'children' | 'onSelect'> {
  title: string;
  subtitle?: string;
  /** Precio ya formateado. */
  price?: string;
  /** Precio anterior tachado (promoción). */
  priceOriginal?: string;
  /** Etiqueta destacada sobre la imagen ("Nuevo", "Promoción"). */
  badge?: string;
  /** URL de imagen o nodo propio. */
  image?: string | ReactNode;
  imageAlt?: string;
  /** Icono de reserva cuando no hay imagen. */
  icon?: ReactNode;
  state?: ChoiceCardState;
  /** Texto corto del estado ("Bloqueado", "Próximamente", "No disponible"). */
  stateLabel?: string;
  /** Motivo en lenguaje simple. */
  reason?: string;
  /** Datos breves: número de fotos, impresiones, tiempo estimado... */
  meta?: ReactNode;
  footer?: ReactNode;
  selected?: boolean;
  /** Se dispara sólo cuando `state === 'available'`. */
  onSelect?: () => void;
  /** Se dispara al tocar una tarjeta no disponible (p. ej. para explicar el bloqueo). */
  onBlockedSelect?: (state: ChoiceCardState) => void;
  size?: 'md' | 'lg';
  'data-testid'?: string;
}

/**
 * Tarjeta de elección (producto, trámite, experiencia). Los estados no disponibles se presentan
 * con imagen atenuada, icono y texto de motivo; nunca sólo con color.
 */
export function ChoiceCard({
  title,
  subtitle,
  price,
  priceOriginal,
  badge,
  image,
  imageAlt = '',
  icon,
  state = 'available',
  stateLabel,
  reason,
  meta,
  footer,
  selected = false,
  onSelect,
  onBlockedSelect,
  size = 'md',
  disabled,
  className,
  onClick,
  ...rest
}: ChoiceCardProps) {
  const available = state === 'available';
  const interactive = available ? Boolean(onSelect) : Boolean(onBlockedSelect);
  const isDisabled = disabled || !interactive;
  return (
    <button
      type="button"
      className={cx('psp-choice', className)}
      data-state={state}
      data-selected={selected || undefined}
      data-size={size}
      aria-pressed={available ? selected : undefined}
      aria-disabled={!available || disabled ? true : undefined}
      disabled={isDisabled}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented) return;
        if (available) onSelect?.();
        else onBlockedSelect?.(state);
      }}
      {...rest}
    >
      <span className="psp-choice__media" aria-hidden={typeof image === 'string' ? undefined : true}>
        {typeof image === 'string' ? (
          <img className="psp-choice__image" src={image} alt={imageAlt} draggable={false} />
        ) : image !== undefined ? (
          image
        ) : (
          <span className="psp-choice__placeholder">{icon ?? <Icon name="image" />}</span>
        )}
        {badge !== undefined ? <span className="psp-choice__badge">{badge}</span> : null}
        {selected ? (
          <span className="psp-choice__check" aria-hidden="true">
            <Icon name="check" />
          </span>
        ) : null}
      </span>
      <span className="psp-choice__body">
        <span className="psp-choice__title">{title}</span>
        {subtitle !== undefined ? <span className="psp-choice__subtitle">{subtitle}</span> : null}
        {meta !== undefined ? <span className="psp-choice__meta">{meta}</span> : null}
      </span>
      {price !== undefined || footer !== undefined ? (
        <span className="psp-choice__footer">
          {price !== undefined ? (
            <span className="psp-choice__price">
              {priceOriginal !== undefined ? <s className="psp-choice__price-original">{priceOriginal}</s> : null}
              <span className="psp-choice__price-value">{price}</span>
            </span>
          ) : null}
          {footer}
        </span>
      ) : null}
      {available ? null : (
        <span className="psp-choice__state" role="note">
          <span className="psp-choice__state-icon" aria-hidden="true">
            <Icon name={CHOICE_STATE_ICON[state]} />
          </span>
          <span className="psp-choice__state-text">
            {stateLabel !== undefined ? <span className="psp-choice__state-label">{stateLabel}</span> : null}
            {reason !== undefined ? <span className="psp-choice__state-reason">{reason}</span> : null}
          </span>
        </span>
      )}
    </button>
  );
}
