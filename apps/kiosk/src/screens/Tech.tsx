/**
 * Panel técnico (requisito 12): PIN por teclado numérico → estado, pruebas, mantenimiento,
 * configuración local, simulación de fallas/pago y cámara sintética con sus casos. Salir vuelve a
 * atracción y descarta el token.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { MaintenanceActionRequest, SimulateFaultRequest, TechStatus } from '@psp/contracts';
import { BigButton, Icon, NumericKeypad, Notice, StatusPill, Toggle, TouchSlider, type Tone } from '@psp/ui';
import { StationApiError, stationApi, type TechTestKind } from '../api/station';
import { SYNTHETIC_SCENARIOS, useSyntheticStore } from '../camera/source';
import { Shell } from '../components/Shell';
import { useT } from '../i18n';
import { ROUTES } from '../session/flow';
import { useKioskStore } from '../store';
import { configNumber } from '../theme/assets';

type Tab = 'status' | 'tests' | 'maintenance' | 'config' | 'simulation';
const TABS: Tab[] = ['status', 'tests', 'maintenance', 'config', 'simulation'];
const TESTS: TechTestKind[] = ['camera', 'preview', 'capture', 'print', 'lighting', 'touch', 'audio', 'storage', 'network', 'demo_session', 'composition'];
const FAULTS: Array<SimulateFaultRequest['fault']> = ['printer_no_paper', 'printer_jam', 'printer_ok', 'camera_off', 'camera_on', 'cloud_off', 'cloud_on', 'storage_low', 'storage_ok', 'payment_device_out', 'payment_device_ok'];

export function TechScreen() {
  const { t, tl } = useT();
  const navigate = useNavigate();
  const token = useKioskStore((s) => s.techToken);
  const tech = useKioskStore((s) => s.techStatus);
  const bundle = useKioskStore((s) => s.bundle);
  const session = useKioskStore((s) => s.session);
  const setTech = useKioskStore((s) => s.setTech);
  const setTechStatus = useKioskStore((s) => s.setTechStatus);
  const forceCamera = useKioskStore((s) => s.forceCamera);
  const cameraForced = useKioskStore((s) => s.cameraForced);
  const refreshStatus = useKioskStore((s) => s.refreshStatus);
  const scenario = useSyntheticStore((s) => s.scenario);
  const setScenario = useSyntheticStore((s) => s.setScenario);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState<string | undefined>();
  const [tab, setTab] = useState<Tab>('status');
  const [busy, setBusy] = useState<string | undefined>();
  const [message, setMessage] = useState<{ tone: Tone; text: string } | undefined>();
  const [oosMessage, setOosMessage] = useState('');
  const [paperQty, setPaperQty] = useState(100);
  const [config, setConfig] = useState<Record<string, number | string>>({});

  const exit = () => {
    setTech(undefined, undefined);
    navigate(ROUTES.attract);
  };

  const load = async () => {
    try {
      const status = await stationApi.techStatus();
      setTechStatus(status);
      setConfig({
        'kiosk.screenBrightness': numberOf(status, 'kiosk.screenBrightness', configNumber(bundle, 'kiosk.screenBrightness', 80)),
        'kiosk.volume': numberOf(status, 'kiosk.volume', configNumber(bundle, 'kiosk.volume', 50)),
        'timing.idleTimeoutSec': numberOf(status, 'timing.idleTimeoutSec', configNumber(bundle, 'timing.idleTimeoutSec', 60)),
        'timing.reviewTimeoutSec': numberOf(status, 'timing.reviewTimeoutSec', configNumber(bundle, 'timing.reviewTimeoutSec', 90)),
        'kiosk.defaultLocale': String(status.effectiveConfigSummary['kiosk.defaultLocale'] ?? bundle?.effective.values['kiosk.defaultLocale'] ?? 'es'),
      });
    } catch (error) {
      if (error instanceof StationApiError && error.code === 'unauthorized') {
        setTech(undefined, undefined);
        setPinError(t('kiosk.tech.expired'));
      } else {
        setMessage({ tone: 'danger', text: t('kiosk.errors.connection_lost.title') });
      }
    }
  };

  useEffect(() => {
    if (token) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const login = async (value: string) => {
    setBusy('login');
    try {
      const response = await stationApi.techLogin(value);
      setTech(response.token);
      setPin('');
      setPinError(undefined);
    } catch {
      setPinError(t('kiosk.tech.pin_error'));
      setPin('');
    } finally {
      setBusy(undefined);
    }
  };

  const run = async (key: string, action: () => Promise<unknown>, okText?: string) => {
    setBusy(key);
    setMessage(undefined);
    try {
      await action();
      if (okText) setMessage({ tone: 'ok', text: okText });
      await load();
      await refreshStatus().catch(() => undefined);
    } catch (error) {
      setMessage({ tone: 'danger', text: error instanceof Error ? error.message : String(error) });
    } finally {
      setBusy(undefined);
    }
  };

  const maintenance = (action: MaintenanceActionRequest) => run(action.action, () => stationApi.techMaintenance(action), t('kiosk.tech.maintenance.done'));

  if (!token) {
    return (
      <Shell hideLang headerEnd={<BigButton variant="ghost" icon={<Icon name="close" />} onClick={exit}>{t('kiosk.tech.exit')}</BigButton>}>
        <div className="kiosk-pin">
          <h1 className="kiosk-title" style={{ textAlign: 'center' }}>{t('kiosk.tech.pin_title')}</h1>
          <p className="kiosk-muted" style={{ textAlign: 'center' }}>{t('kiosk.tech.pin_hint')}</p>
          <div className="kiosk-keypad-value" aria-hidden="true">{'•'.repeat(pin.length)}</div>
          <NumericKeypad value={pin} length={8} onChange={setPin} onConfirm={(v) => void login(v)} confirmLabel={t('kiosk.tech.login')} deleteLabel={t('kiosk.keyboard.delete')} label={t('kiosk.tech.pin_title')} error={pinError} masked confirmDisabled={pin.length < 4 || busy === 'login'} data-testid="tech-keypad" />
        </div>
      </Shell>
    );
  }

  const status = tech?.status;
  const dash = t('kiosk.common.unknown');
  const cap = (key: string) => status?.capabilities.find((c) => c.key === key);
  const camera = cap('camera.primary');

  return (
    <Shell hideLang headerEnd={<BigButton variant="danger" icon={<Icon name="close" />} onClick={exit} data-testid="tech-exit">{t('kiosk.tech.exit')}</BigButton>}>
      <div className="kiosk-tech" data-testid="tech-panel">
        <h1 className="kiosk-title" style={{ margin: 0 }}>{t('kiosk.tech.title')}</h1>
        <div className="kiosk-tech__tabs">
          {TABS.map((item) => (
            <button key={item} type="button" className="kiosk-chip" aria-pressed={tab === item} onClick={() => setTab(item)}>
              {t(`kiosk.tech.tabs.${item}`)}
            </button>
          ))}
          <BigButton variant="ghost" icon={<Icon name="retry" />} onClick={() => void load()}>{t('kiosk.tech.refresh')}</BigButton>
        </div>
        {message ? <Notice tone={message.tone} position="static" onClose={() => setMessage(undefined)} closeLabel={t('kiosk.common.close')}>{message.text}</Notice> : null}

        {tab === 'status' ? (
          <div className="kiosk-tech__grid">
            <section className="kiosk-card">
              <h2>{t('kiosk.tech.status.identity')}</h2>
              <ul className="kiosk-list">
                <li><span>{t('kiosk.tech.status.machine_code')}</span><span>{status?.machineCode ?? dash}</span></li>
                <li><span>{t('kiosk.tech.status.machine_name')}</span><span>{status?.machineName ?? dash}</span></li>
                <li><span>{t('kiosk.tech.status.organization')}</span><span>{tech?.organizationName ?? dash}</span></li>
                <li><span>{t('kiosk.tech.status.location')}</span><span>{tech?.location?.name ?? dash}</span></li>
                <li><span>{t('kiosk.tech.status.state')}</span><span>{status?.status ?? dash}</span></li>
                <li><span>{t('kiosk.tech.status.demo_mode')}</span><span>{status?.demoMode ? t('kiosk.common.on') : t('kiosk.common.off')}</span></li>
                <li><span>{t('kiosk.tech.status.maintenance')}</span><span>{status?.maintenance.on ? t('kiosk.common.on') : t('kiosk.common.off')}</span></li>
              </ul>
            </section>
            <section className="kiosk-card">
              <h2>{t('kiosk.tech.status.hardware')}</h2>
              <ul className="kiosk-list">
                <li><span>{t('kiosk.tech.status.camera')}</span><span>{camera ? (camera.operational ? t('kiosk.tech.status.operational') : camera.present ? t('kiosk.tech.status.not_operational') : t('kiosk.tech.status.absent')) : dash}</span></li>
                <li><span>{t('kiosk.tech.status.camera_source')}</span><span>{cameraForced ?? t('kiosk.common.none')}</span></li>
                {(status?.printers ?? []).map((p) => (
                  <li key={p.id}><span>{t('kiosk.tech.status.printers')} · {p.name}</span><span>{p.status}{p.paperEstimate !== undefined ? ` · ${t('kiosk.tech.status.paper')} ${p.paperEstimate}` : ''}</span></li>
                ))}
                <li><span>{t('kiosk.tech.status.storage_free')}</span><span>{status ? `${status.storage.freeMb} MB · ${Math.round(status.storage.usedPct)}%` : dash}</span></li>
                <li><span>{t('kiosk.tech.status.payment_terminal')}</span><span>{status ? `${status.paymentTerminal.adapter} · ${status.paymentTerminal.status}` : dash}</span></li>
                {(tech?.consumables ?? []).map((c) => (
                  <li key={c.type}><span>{t('kiosk.tech.status.consumables')} · {c.type}</span><span>{c.estimatedRemaining} {c.unit}</span></li>
                ))}
              </ul>
            </section>
            <section className="kiosk-card">
              <h2>{t('kiosk.tech.status.connectivity')}</h2>
              <ul className="kiosk-list">
                <li><span>{t('kiosk.tech.status.connectivity')}</span><span>{status ? (status.cloudReachable ? t('kiosk.tech.status.cloud_ok') : t('kiosk.tech.status.cloud_down')) : dash}</span></li>
                <li><span>{t('kiosk.tech.status.last_sync')}</span><span>{status?.lastSyncAt ?? dash}</span></li>
                <li><span>{t('kiosk.tech.status.software')}</span><span>{status?.softwareVersion ?? dash}</span></li>
                <li><span>{t('kiosk.tech.status.bundle')}</span><span>{status?.bundleVersion ?? bundle?.version ?? dash}</span></li>
                <li><span>{t('kiosk.tech.status.local_time')}</span><span>{status ? `${status.time.localTime} (${status.time.timezone})` : dash}</span></li>
                <li><span>{t('kiosk.tech.status.outbox')}</span><span>{tech ? `${tech.outbox.pending}${tech.outbox.oldestAt ? ` · ${t('kiosk.tech.status.outbox_oldest')} ${tech.outbox.oldestAt}` : ''}` : dash}</span></li>
                <li><span>{t('kiosk.tech.status.active_session')}</span><span>{status?.activeSessionId ?? session?.id ?? t('kiosk.common.none')}</span></li>
                <li><span>{t('kiosk.tech.status.release')}</span><span>{status?.release ? JSON.stringify(status.release) : dash}</span></li>
              </ul>
            </section>
            <section className="kiosk-card">
              <h2>{t('kiosk.tech.status.recent_sessions')}</h2>
              <ul className="kiosk-list kiosk-tech__log">
                {(tech?.recentSessions ?? []).length === 0 ? <li>{t('kiosk.tech.status.empty')}</li> : null}
                {(tech?.recentSessions ?? []).map((s) => (
                  <li key={s.id}><span>{s.code} · {s.productName}</span><span>{t(`stages.${s.stage}`)} · {s.startedAt}</span></li>
                ))}
              </ul>
            </section>
            <section className="kiosk-card">
              <h2>{t('kiosk.tech.status.recent_errors')}</h2>
              <ul className="kiosk-list kiosk-tech__log">
                {(tech?.recentEvents ?? []).filter((e) => e.severity !== 'info').length === 0 ? <li>{t('kiosk.tech.status.empty')}</li> : null}
                {(tech?.recentEvents ?? []).filter((e) => e.severity !== 'info').map((e) => (
                  <li key={e.id}><span>{e.at}</span><span>{e.type} · {e.message}</span></li>
                ))}
              </ul>
            </section>
            <section className="kiosk-card">
              <h2>{t('kiosk.tech.status.notices')}</h2>
              <div className="kiosk-chips">
                {(status?.notices ?? []).length === 0 ? <span className="kiosk-muted">{t('kiosk.tech.status.empty')}</span> : null}
                {(status?.notices ?? []).map((n) => <StatusPill key={n.code} tone={n.kind === 'error' ? 'danger' : n.kind === 'warning' ? 'warn' : 'info'}>{tl(n.message)}</StatusPill>)}
              </div>
            </section>
          </div>
        ) : null}

        {tab === 'tests' ? (
          <div className="kiosk-stack">
            <div className="kiosk-chips">
              {TESTS.map((kind) => (
                <BigButton key={kind} variant="secondary" loading={busy === `test:${kind}`} loadingLabel={t('kiosk.tech.tests.running')} onClick={() => void run(`test:${kind}`, () => stationApi.techTest(kind))}>
                  {t(`kiosk.tech.tests.kind.${kind}`)}
                </BigButton>
              ))}
            </div>
            <section className="kiosk-card">
              <h2>{t('kiosk.tech.tests.recent')}</h2>
              <ul className="kiosk-list kiosk-tech__log">
                {(tech?.recentTests ?? []).length === 0 ? <li>{t('kiosk.tech.status.empty')}</li> : null}
                {(tech?.recentTests ?? []).map((r, i) => (
                  <li key={`${r.kind}-${i}`}><span>{r.at} · {t(`kiosk.tech.tests.kind.${r.kind}`)}</span><span>{r.ok ? t('kiosk.tech.tests.ok') : t('kiosk.tech.tests.fail')} · {r.message}</span></li>
                ))}
              </ul>
            </section>
          </div>
        ) : null}

        {tab === 'maintenance' ? (
          <div className="kiosk-tech__grid">
            <section className="kiosk-card kiosk-stack">
              <h2 style={{ margin: 0 }}>{t('kiosk.tech.maintenance.title')}</h2>
              <textarea className="kiosk-textarea" value={oosMessage} onChange={(e) => setOosMessage(e.target.value)} placeholder={t('kiosk.tech.maintenance.message')} aria-label={t('kiosk.tech.maintenance.message')} />
              <div className="kiosk-chips">
                {status?.status === 'out_of_service' ? (
                  <BigButton variant="primary" onClick={() => void maintenance({ action: 'back_in_service' })}>{t('kiosk.tech.maintenance.back_in_service')}</BigButton>
                ) : (
                  <BigButton variant="danger" onClick={() => void maintenance({ action: 'out_of_service', ...(oosMessage ? { message: oosMessage } : {}) })}>{t('kiosk.tech.maintenance.out_of_service')}</BigButton>
                )}
                {status?.maintenance.on ? (
                  <BigButton variant="primary" onClick={() => void maintenance({ action: 'maintenance_off' })}>{t('kiosk.tech.maintenance.maintenance_off')}</BigButton>
                ) : (
                  <BigButton variant="secondary" onClick={() => void maintenance({ action: 'maintenance_on', ...(oosMessage ? { message: oosMessage } : {}) })}>{t('kiosk.tech.maintenance.maintenance_on')}</BigButton>
                )}
                <BigButton variant="secondary" onClick={() => void maintenance({ action: 'clear_temp_sessions' })}>{t('kiosk.tech.maintenance.clear_temp')}</BigButton>
                <BigButton variant="secondary" onClick={() => void maintenance({ action: 'set_demo_mode', on: !status?.demoMode })}>{status?.demoMode ? t('kiosk.tech.maintenance.demo_off') : t('kiosk.tech.maintenance.demo_on')}</BigButton>
                <BigButton variant="secondary" onClick={() => void maintenance({ action: 'sync_now' })}>{t('kiosk.tech.maintenance.sync_now')}</BigButton>
              </div>
            </section>
            <section className="kiosk-card kiosk-stack">
              <h2 style={{ margin: 0 }}>{t('kiosk.tech.maintenance.paper_changed')}</h2>
              <TouchSlider label={t('kiosk.tech.maintenance.paper_qty')} min={10} max={500} step={10} value={paperQty} onChange={setPaperQty} />
              <div className="kiosk-chips">
                {(status?.printers ?? []).map((p) => (
                  <BigButton key={p.id} variant="secondary" onClick={() => void maintenance({ action: 'paper_changed', printerId: p.id, qty: paperQty })}>{t('kiosk.tech.maintenance.printer')}: {p.name}</BigButton>
                ))}
              </div>
              <BigButton variant="secondary" onClick={() => void maintenance({ action: 'log_maintenance', type: 'inspection', results: [], ...(oosMessage ? { notes: oosMessage } : {}) })}>{t('kiosk.tech.maintenance.log')} · {t('kiosk.tech.maintenance.type.inspection')}</BigButton>
              <BigButton variant="danger" onClick={() => void maintenance({ action: 'open_incident', severity: 'medium', category: 'technician', title: oosMessage || t('kiosk.tech.maintenance.incident_title'), ...(oosMessage ? { description: oosMessage } : {}) })}>{t('kiosk.tech.maintenance.incident_open')}</BigButton>
            </section>
          </div>
        ) : null}

        {tab === 'config' ? (
          <section className="kiosk-card kiosk-stack">
            <p className="kiosk-muted">{t('kiosk.tech.config.hint')}</p>
            <TouchSlider label={t('kiosk.common.language') + ': ' + String(config['kiosk.defaultLocale'] ?? 'es')} min={0} max={1} step={1} value={config['kiosk.defaultLocale'] === 'en' ? 1 : 0} onChange={(v) => setConfig({ ...config, 'kiosk.defaultLocale': v === 1 ? 'en' : 'es' })} formatValue={(v) => (v === 1 ? 'EN' : 'ES')} />
            {(['kiosk.screenBrightness', 'kiosk.volume', 'timing.idleTimeoutSec', 'timing.reviewTimeoutSec'] as const).map((key) => (
              <TouchSlider key={key} label={key} min={key.startsWith('timing') ? 15 : 0} max={key.startsWith('timing') ? 600 : 100} step={key.startsWith('timing') ? 5 : 5} value={Number(config[key] ?? 0)} onChange={(v) => setConfig({ ...config, [key]: v })} hint={tech?.localOverrides[key] !== undefined ? t('kiosk.tech.config.provenance', { level: t('kiosk.tech.config.level.machine') }) : undefined} />
            ))}
            <BigButton variant="primary" size="xl" loading={busy === 'config'} onClick={() => void run('config', () => stationApi.techConfig(config, 'tech_panel'), t('kiosk.tech.config.saved'))} data-testid="tech-config-save">
              {t('kiosk.tech.config.save')}
            </BigButton>
          </section>
        ) : null}

        {tab === 'simulation' ? (
          <div className="kiosk-tech__grid">
            <section className="kiosk-card kiosk-stack">
              <h2 style={{ margin: 0 }}>{t('kiosk.tech.simulation.faults')}</h2>
              <p className="kiosk-muted">{t('kiosk.tech.simulation.hint')}</p>
              <div className="kiosk-chips">
                {FAULTS.map((fault) => {
                  const printerId = status?.printers[0]?.id ?? 'printer';
                  const request = (fault === 'printer_no_paper' || fault === 'printer_jam' || fault === 'printer_ok' ? { fault, printerId } : { fault }) as SimulateFaultRequest;
                  return (
                    <BigButton key={fault} variant="secondary" loading={busy === `fault:${fault}`} onClick={() => void run(`fault:${fault}`, () => stationApi.techSimulate(request), t('kiosk.tech.simulation.applied'))}>
                      {t(`kiosk.tech.simulation.fault.${fault}`)}
                    </BigButton>
                  );
                })}
              </div>
            </section>
            <section className="kiosk-card kiosk-stack">
              <h2 style={{ margin: 0 }}>{t('kiosk.tech.simulation.payments')}</h2>
              {session?.payment ? (
                <div className="kiosk-chips">
                  {(['approve', 'decline', 'cancel', 'expire', 'review', 'device_out', 'recover'] as const).map((outcome) => (
                    <BigButton key={outcome} variant="secondary" onClick={() => void run(`pay:${outcome}`, () => stationApi.simulatePayment(session.payment?.id ?? '', outcome), t('kiosk.tech.simulation.applied'))}>
                      {outcome}
                    </BigButton>
                  ))}
                </div>
              ) : (
                <p className="kiosk-muted">{t('kiosk.tech.simulation.no_intent')}</p>
              )}
            </section>
            <section className="kiosk-card kiosk-stack">
              <h2 style={{ margin: 0 }}>{t('kiosk.tech.simulation.kiosk_camera')}</h2>
              <Toggle checked={cameraForced === 'synthetic'} onChange={(on) => forceCamera(on ? 'synthetic' : 'webcam')} label={t('kiosk.tech.simulation.use_synthetic')} description={t('kiosk.tech.simulation.use_webcam')} />
              <div className="kiosk-chips">
                {SYNTHETIC_SCENARIOS.map((item) => (
                  <button key={item} type="button" className="kiosk-chip" aria-pressed={scenario === item} onClick={() => setScenario(item)} data-testid={`synthetic-${item}`}>
                    {t(`kiosk.tech.simulation.scenario.${item}`)}
                  </button>
                ))}
              </div>
              <BigButton variant="ghost" onClick={() => forceCamera(undefined)}>{t('kiosk.common.reset_auto')}</BigButton>
            </section>
          </div>
        ) : null}
      </div>
    </Shell>
  );
}

function numberOf(status: TechStatus, key: string, fallback: number): number {
  const local = status.localOverrides[key];
  if (typeof local === 'number') return local;
  const effective = status.effectiveConfigSummary[key];
  return typeof effective === 'number' ? effective : fallback;
}
