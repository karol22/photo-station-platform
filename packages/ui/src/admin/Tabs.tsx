import { useId } from 'react';
import type { ComponentProps, KeyboardEvent, ReactNode } from 'react';
import { cx } from '../internal';

export interface TabItem {
  key: string;
  label: ReactNode;
  icon?: ReactNode;
  badge?: string | number;
  disabled?: boolean;
}

export interface TabsProps extends Omit<ComponentProps<'div'>, 'onChange' | 'children'> {
  items: TabItem[];
  value: string;
  onChange: (key: string) => void;
  /** Texto accesible de la lista de pestañas. */
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'line' | 'pill';
  /** Contenido de la pestaña activa (se renderiza en `role="tabpanel"`). */
  children?: ReactNode;
  'data-testid'?: string;
}

/** Pestañas accesibles (`tablist` / `tab` / `tabpanel`) con navegación por flechas. */
export function Tabs({ items, value, onChange, label, size = 'md', variant = 'line', className, children, ...rest }: TabsProps) {
  const id = useId();
  const enabled = items.filter((item) => !item.disabled);
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (enabled.length === 0) return;
    const index = enabled.findIndex((item) => item.key === value);
    let next: TabItem | undefined;
    if (event.key === 'ArrowRight') next = enabled[(index + 1) % enabled.length];
    else if (event.key === 'ArrowLeft') next = enabled[(index - 1 + enabled.length) % enabled.length];
    else if (event.key === 'Home') next = enabled[0];
    else if (event.key === 'End') next = enabled[enabled.length - 1];
    if (!next) return;
    event.preventDefault();
    onChange(next.key);
    const button = event.currentTarget.querySelector<HTMLButtonElement>(`[data-key="${next.key}"]`);
    button?.focus();
  };
  const activeId = `${id}-tab-${value}`;
  return (
    <div className={cx('psp-tabs', className)} data-size={size} data-variant={variant} {...rest}>
      <div className="psp-tabs__list" role="tablist" aria-label={label} onKeyDown={onKeyDown}>
        {items.map((item) => {
          const active = item.key === value;
          return (
            <button
              key={item.key}
              type="button"
              role="tab"
              id={`${id}-tab-${item.key}`}
              className="psp-tabs__tab"
              data-key={item.key}
              data-active={active || undefined}
              aria-selected={active}
              aria-controls={`${id}-panel`}
              tabIndex={active ? 0 : -1}
              disabled={item.disabled}
              onClick={() => onChange(item.key)}
            >
              {item.icon !== undefined ? (
                <span className="psp-tabs__icon" aria-hidden="true">
                  {item.icon}
                </span>
              ) : null}
              <span className="psp-tabs__label">{item.label}</span>
              {item.badge !== undefined ? <span className="psp-tabs__badge">{item.badge}</span> : null}
            </button>
          );
        })}
      </div>
      {children !== undefined ? (
        <div className="psp-tabs__panel" role="tabpanel" id={`${id}-panel`} aria-labelledby={activeId} tabIndex={0}>
          {children}
        </div>
      ) : null}
    </div>
  );
}
