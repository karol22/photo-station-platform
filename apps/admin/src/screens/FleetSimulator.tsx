/** Formulario `POST /fleet/simulate` para poblar máquinas virtuales de prueba. */
import { useState } from 'react';
import { Alert, Button, Field, Input, NumberInput, PageHeader, Switch } from '@psp/ui';
import { errorMessage } from '../api/client';
import { fleet } from '../api/special';
import { createTranslator } from '../i18n/extra';
import { usePrefsStore } from '../store/prefs';

export function FleetSimulator() {
  const locale = usePrefsStore((s) => s.locale);
  const tr = createTranslator(locale);
  const [count, setCount] = useState<number | null>(10);
  const [organizationId, setOrganizationId] = useState('');
  const [heartbeats, setHeartbeats] = useState(true);
  const [result, setResult] = useState<string>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);

  async function handleSimulate() {
    setLoading(true);
    setError(undefined);
    try {
      const res = await fleet.simulate({ count: count ?? 10, organizationId: organizationId || undefined, heartbeats });
      setResult(JSON.stringify(res, null, 2));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <PageHeader title={tr.t('admin.fleetSimulator.title')} />
      {error !== undefined ? <Alert tone="danger">{error}</Alert> : null}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 360 }}>
        <Field label={tr.t('admin.fleetSimulator.count')}>
          <NumberInput value={count} min={1} max={2000} onChange={setCount} />
        </Field>
        <Field label={tr.t('admin.field.organizationId')}>
          <Input value={organizationId} onChange={(e) => setOrganizationId(e.target.value)} />
        </Field>
        <Switch checked={heartbeats} onChange={setHeartbeats} label={tr.t('admin.fleetSimulator.heartbeats')} />
        <Button variant="primary" loading={loading} onClick={() => void handleSimulate()}>
          {tr.t('admin.action.simulate')}
        </Button>
      </div>
      {result !== undefined ? (
        <>
          <h3>{tr.t('admin.fleetSimulator.result')}</h3>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>{result}</pre>
        </>
      ) : null}
    </>
  );
}
