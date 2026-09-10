/** Control de formulario genérico por `FieldType`. Lee/escribe el borrador con `lib/paths.ts`. */
import { ColorInput, Field, Input, NumberInput, Select, Switch, Textarea } from '@psp/ui';
import { getPath, setPath } from '../lib/paths';
import type { Translator } from '../i18n/extra';
import type { ResourceFieldDef } from './types';

export interface ResourceFieldControlProps {
  field: ResourceFieldDef;
  draft: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
  tr: Translator;
  disabled?: boolean;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export function ResourceFieldControl({ field, draft, onChange, tr, disabled = false }: ResourceFieldControlProps) {
  const label = tr.t(field.labelKey);
  const hint = field.hintKey ? tr.t(field.hintKey) : undefined;
  const value = getPath(draft, field.key);
  const set = (v: unknown) => onChange(setPath(draft, field.key, v));

  switch (field.type) {
    case 'text':
      return (
        <Field label={label} hint={hint} required={field.required}>
          <Input value={typeof value === 'string' ? value : ''} placeholder={field.placeholder} disabled={disabled} onChange={(e) => set(e.target.value)} block />
        </Field>
      );
    case 'number':
      return (
        <Field label={label} hint={hint} required={field.required}>
          <NumberInput value={typeof value === 'number' ? value : null} disabled={disabled} onChange={(n) => set(n)} block />
        </Field>
      );
    case 'select':
      return (
        <Field label={label} hint={hint} required={field.required}>
          <Select
            options={field.options ?? []}
            placeholder={field.required ? undefined : '—'}
            value={typeof value === 'string' ? value : ''}
            disabled={disabled}
            onChange={(e) => set(e.target.value === '' ? undefined : e.target.value)}
            block
          />
        </Field>
      );
    case 'switch':
      return <Switch checked={Boolean(value)} disabled={disabled} onChange={(checked) => set(checked)} label={label} description={hint} />;
    case 'color':
      return (
        <Field label={label} hint={hint}>
          <ColorInput value={typeof value === 'string' && value ? value : '#1E5EFF'} disabled={disabled} onChange={(hex) => set(hex)} />
        </Field>
      );
    case 'localized': {
      const obj = asRecord(value);
      const es = obj['es'];
      const en = obj['en'];
      return (
        <Field label={label} hint={hint} required={field.required}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Input value={typeof es === 'string' ? es : ''} placeholder="es" disabled={disabled} onChange={(e) => onChange(setPath(draft, `${field.key}.es`, e.target.value))} block />
            <Input value={typeof en === 'string' ? en : ''} placeholder="en" disabled={disabled} onChange={(e) => onChange(setPath(draft, `${field.key}.en`, e.target.value))} block />
          </div>
        </Field>
      );
    }
    case 'money': {
      const obj = asRecord(value);
      const amount = obj['amount'];
      const currency = obj['currency'];
      const major = typeof amount === 'number' ? amount / 100 : null;
      return (
        <Field label={label} hint={hint} required={field.required}>
          <div style={{ display: 'flex', gap: 8 }}>
            <NumberInput
              value={major}
              step={0.01}
              disabled={disabled}
              onChange={(n) => onChange(setPath(draft, `${field.key}.amount`, n === null ? null : Math.round(n * 100)))}
            />
            <Input
              value={typeof currency === 'string' ? currency : 'MXN'}
              disabled={disabled}
              maxLength={3}
              style={{ width: 72 }}
              onChange={(e) => onChange(setPath(draft, `${field.key}.currency`, e.target.value.toUpperCase()))}
            />
          </div>
        </Field>
      );
    }
    case 'tags': {
      const arr = Array.isArray(value) ? (value as unknown[]).filter((v): v is string => typeof v === 'string') : [];
      return (
        <Field label={label} hint={hint}>
          <Input
            value={arr.join(', ')}
            disabled={disabled}
            onChange={(e) =>
              set(
                e.target.value
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean),
              )
            }
            block
          />
        </Field>
      );
    }
    case 'json':
    default: {
      const text = value === undefined ? '' : JSON.stringify(value, null, 2);
      return (
        <Field label={label} hint={hint}>
          <Textarea
            key={field.key}
            defaultValue={text}
            rows={6}
            disabled={disabled}
            onBlur={(e) => {
              const raw = e.target.value.trim();
              if (raw === '') {
                set(undefined);
                return;
              }
              try {
                set(JSON.parse(raw));
              } catch {
                // JSON inválido: se conserva el texto escrito; el usuario lo corrige antes de guardar.
              }
            }}
          />
        </Field>
      );
    }
  }
}
