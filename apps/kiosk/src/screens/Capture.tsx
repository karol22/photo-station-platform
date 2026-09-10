/**
 * Captura. Modo documental: vista en espejo, recorte del preset como superposición, criterios,
 * instrucción principal, anillo de auto-captura y botón manual. Modo experiencia: la cabina.
 *
 * El recorrido social no es un editor con lienzo e inspector: es un espejo a sangre que ocupa la
 * banda del cartel, dos ojos de tinta donde está el lente, y una tira de huecos que se va
 * llenando. La persona vino a verse, así que nada se pone encima de su cara salvo esos dos ojos,
 * no hay velo que le baje la luz y no hay «foto 3 de 6»: la tira ES el progreso. El documental
 * conserva su disposición y su sobriedad, porque una foto de trámite no se celebra.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import type { PoseStep } from '@psp/contracts';
import { BigButton, BlobFace, Countdown, CriteriaList, Icon, InstructionBanner, Marquee, Notice, StatusPill, type BlobVariant, type CriteriaItem } from '@psp/ui';
import { AutoCaptureController, VISION_CRITERIA, evaluateDocumentCompliance, evaluatePoseGuidance, mirrorInstruction, type ComplianceResult, type FrameAnalysis, type InstructionKey } from '@psp/vision';
import { stationApi } from '../api/station';
import { ANALYSIS_HEIGHT, ANALYSIS_WIDTH, useCamera, useFrameLoop } from '../camera/useCamera';
import { captureDocument, capturePhoto, summarize } from '../capture/capture';
import { CameraView } from '../components/CameraView';
import { LensEyes, LENS_WIDE_SEC, lensStateFor, type LensMoment } from '../components/LensEyes';
import { SessionFrame } from '../components/SessionFrame';
import { Shell } from '../components/Shell';
import { useT } from '../i18n';
import { retakesLeft } from '../session/flow';
import { useSession } from '../session/useSession';
import { useIdleHold, useSessionTimeout } from '../session/useSessionTimeout';
import { useSound } from '../sound/useSound';
import { useKioskStore } from '../store';
import { resolveAssetUrl } from '../theme/assets';

interface RetakeState {
  retakeOf?: string;
  index?: number;
}

/**
 * Fases de la pantalla. `beat` es el respiro después de cada disparo: la foto recién tomada se ve
 * un instante y se incorpora a la tira. Sin ese compás, la ráfaga se siente atropellada; es la
 * queja mejor documentada de las cabinas que disparan seguido.
 */
type Phase = 'live' | 'countdown' | 'shooting' | 'uploading' | 'beat';

/** Cuánto se queda en pantalla la foto recién tomada antes de seguir con la siguiente. */
const BEAT_MS = 1400;

/**
 * El destello: blanco al 90 % y caída al acento de la toma.
 *
 * Medio segundo de blanco es una eternidad y además cuenta como estímulo luminoso repetido; el
 * límite de accesibilidad es de tres destellos por segundo y aquí hay uno por toma. Estos son los
 * tiempos del plan, y se comparten con el CSS: si cambian aquí, cambian allá.
 */
const FLASH_MS = 110;
const FLASH_FALL_MS = 180;

/** Cuántos acentos tiene la paleta: la tanda los recorre, uno por toma. */
const ACCENTS = 6;

export function CaptureScreen() {
  const { t, tl } = useT();
  const location = useLocation();
  const { session, product, preset, experience, advance, fail } = useSession();
  const bundle = useKioskStore((s) => s.bundle);
  const visionLimited = useKioskStore((s) => s.visionLimited);
  const cameraKind = useKioskStore((s) => s.cameraKind);
  const setSession = useKioskStore((s) => s.setSession);
  const camera = useCamera(true);
  const sound = useSound();
  const [retake, setRetake] = useState<RetakeState>((location.state as RetakeState | null) ?? {});

  const [phase, setPhase] = useState<Phase>('live');
  const [countdown, setCountdown] = useState(0);
  const [flash, setFlash] = useState(false);
  const [analysis, setAnalysis] = useState<FrameAnalysis | undefined>();
  const [compliance, setCompliance] = useState<ComplianceResult | undefined>();
  const [autoProgress, setAutoProgress] = useState(0);
  const [poseIndex, setPoseIndex] = useState(0);
  const [hints, setHints] = useState<InstructionKey[]>([]);
  const [lastShot, setLastShot] = useState<{ url: string; id: string; index: number } | undefined>();
  /**
   * En el recorrido social un solo toque arranca toda la tanda y la máquina lleva el ritmo: nadie
   * toca la pantalla entre foto y foto, porque está posando. El botón manual queda como escape.
   */
  const [burst, setBurst] = useState(false);
  const burstRef = useRef(false);
  burstRef.current = burst;
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  /** El cuadro pendiente de la cuenta regresiva, para poder cancelarlo al salir. */
  const frame = useRef(0);
  const latest = useRef<{ analysis?: FrameAnalysis; compliance?: ComplianceResult }>({});
  const phaseRef = useRef<Phase>('live');
  phaseRef.current = phase;

  // Posar no es estar inactivo: mientras corre la cuenta regresiva, el disparo o la subida, el
  // temporizador de inactividad queda retenido y la sesión pagada no se cancela sola.
  useIdleHold(phase !== 'live' || burst);

  const isDocument = product?.kind === 'document' && !!preset;
  const poses: PoseStep[] = useMemo(() => {
    if (isDocument || !product) return [];
    if (experience && experience.poses.length > 0) return experience.poses;
    return Array.from({ length: product.captureCount }, (_, i) => ({ key: `shot_${i}`, name: { es: '' }, instruction: { es: '' }, countdownSec: session?.timers.captureCountdownSec ?? 3 }));
  }, [isDocument, product, experience, session?.timers.captureCountdownSec]);
  const total = isDocument ? 1 : poses.length;
  const currentIndex = retake.index ?? (isDocument ? 0 : poseIndex);
  const pose = poses[currentIndex];
  const captureCountdown = session?.timers.captureCountdownSec ?? 3;
  const stabilityMs = preset?.spec.autoCapture.stabilityMs ?? session?.timers.autoCaptureStabilityMs ?? 1200;
  const autoEnabled = isDocument && (product?.autoCapture ?? false) && preset.spec.autoCapture.enabled && !visionLimited;
  const controller = useMemo(() => new AutoCaptureController({ stabilityMs, cooldownMs: 4000 }), [stabilityMs]);

  /** La última foto de cada hueco. La tira se dibuja de la sesión, que es la única verdad. */
  const shots = useMemo(() => {
    const byIndex = new Map<number, string>();
    for (const capture of session?.captures ?? []) byIndex.set(capture.index, capture.url);
    return byIndex;
  }, [session?.captures]);

  const shoot = useCallback(async () => {
    if (!session || !product || !camera.source) return;
    setPhase('shooting');
    setFlash(true);
    sound.play('shutter');
    timers.current.push(setTimeout(() => setFlash(false), FLASH_MS + FLASH_FALL_MS));
    try {
      const snap = latest.current;
      const image = isDocument
        ? captureDocument(camera.source, snap.compliance?.crop, { width: ANALYSIS_WIDTH, height: ANALYSIS_HEIGHT }, preset.spec)
        : capturePhoto(camera.source);
      setPhase('uploading');
      const updated = await stationApi.uploadCapture(session.id, {
        index: currentIndex,
        imageBase64: image.dataUrl,
        width: image.width,
        height: image.height,
        analysis: summarize(snap.analysis, snap.compliance),
        ...(retake.retakeOf ? { retakeOf: retake.retakeOf } : {}),
        auto: phaseRef.current === 'countdown' ? false : autoEnabled,
      });
      setSession(updated);
      if (isDocument || (retake.retakeOf && retake.index === undefined)) {
        await advance('captured');
        return;
      }
      if (retake.retakeOf) setRetake({});
      const created = updated.captures.filter((c) => c.index === currentIndex).at(-1);
      // El compás: la foto recién tomada se ve un momento y después sigue la tanda sola.
      // Aquí no se pregunta nada. Se dispara de más a propósito y elegir se hace al final, de
      // una sola vez, que es donde la decisión tiene sentido y no interrumpe la pose.
      if (created) setLastShot({ url: created.url, id: created.id, index: currentIndex });
      const isLast = currentIndex + 1 >= total;
      if (isLast) {
        sound.play('complete');
        setPhase('beat');
        timers.current.push(
          setTimeout(() => {
            setBurst(false);
            void advance('captured');
          }, BEAT_MS),
        );
        return;
      }
      setPhase('beat');
      timers.current.push(
        setTimeout(() => {
          setLastShot(undefined);
          setPoseIndex(currentIndex + 1);
          setPhase('live');
          controller.reset();
        }, BEAT_MS),
      );
    } catch (error) {
      fail(error, 'capture_failed');
    }
  }, [session, product, camera.source, isDocument, preset, currentIndex, retake.retakeOf, autoEnabled, setSession, advance, total, controller, fail, sound]);

  const startCountdown = useCallback(
    (seconds: number) => {
      if (phaseRef.current !== 'live') return;
      setPhase('countdown');
      setCountdown(seconds);
      sound.play(seconds <= 1 ? 'tick_last' : 'tick');
      // Reloj real contra una fecha límite, no un intervalo de mil milisegundos: el hilo principal
      // está analizando cuadros de cámara y un intervalo se desfasa, así que el numeral saltaba a
      // tirones y el obturador llegaba tarde. El estado sólo cambia cuando cambia el número, para
      // no repintar la pantalla sesenta veces por segundo mientras la visión trabaja.
      const endsAt = performance.now() + seconds * 1000;
      let shown = seconds;
      let done = false;
      let safety: ReturnType<typeof setTimeout> | undefined;
      const finish = () => {
        if (done) return;
        done = true;
        clearTimeout(safety);
        if (frame.current) cancelAnimationFrame(frame.current);
        frame.current = 0;
        setCountdown(0);
        void shoot();
      };
      const step = () => {
        if (performance.now() >= endsAt) {
          finish();
          return;
        }
        const whole = Math.ceil((endsAt - performance.now()) / 1000);
        if (whole < shown) {
          shown = whole;
          setCountdown(whole);
          sound.play(whole === 1 ? 'tick_last' : 'tick');
        }
        frame.current = requestAnimationFrame(step);
      };
      // Red de seguridad: con la pestaña oculta el navegador deja de entregar cuadros, y una
      // cuenta congelada dejaría la tanda colgada para siempre con el temporizador retenido.
      safety = setTimeout(finish, seconds * 1000 + 250);
      timers.current.push(safety);
      frame.current = requestAnimationFrame(step);
    },
    [shoot, sound],
  );

  useFrameLoop(
    camera.source,
    camera.analyzer,
    (frameAnalysis) => {
      setAnalysis(frameAnalysis);
      if (isDocument) {
        const result = evaluateDocumentCompliance(frameAnalysis, preset.spec);
        latest.current = { analysis: frameAnalysis, compliance: result };
        setCompliance(result);
        if (autoEnabled && phaseRef.current === 'live' && !lastShot) {
          const update = controller.update(result, frameAnalysis.atMs);
          setAutoProgress(update.progress);
          if (update.shouldCapture) startCountdown(Math.min(captureCountdown, 2));
        }
      } else {
        latest.current = { analysis: frameAnalysis };
        if (experience?.guidanceEnabled !== false) setHints(evaluatePoseGuidance(frameAnalysis, pose?.guidance).hints);
      }
    },
    camera.phase === 'ready',
  );

  useEffect(() => {
    if (camera.phase !== 'failed') return;
    // La tanda se detiene antes de avisar: seguir disparando sin cámara subiría cuadros muertos.
    setBurst(false);
    for (const timer of timers.current) clearTimeout(timer);
    timers.current = [];
    if (frame.current) cancelAnimationFrame(frame.current);
    frame.current = 0;
    fail(new Error('camera'), 'camera_unavailable');
  }, [camera.phase, fail]);

  // La tanda se encadena sola: cuando la pantalla vuelve a estar viva y la ráfaga sigue en curso,
  // arranca la cuenta de la siguiente pose tras un respiro para leer la instrucción.
  useEffect(() => {
    if (!burst || phase !== 'live' || camera.phase !== 'ready') return;
    const prepare = Math.max(1, session?.timers.prepareBeforeCaptureSec ?? 2);
    const timer = setTimeout(() => startCountdown(pose?.countdownSec ?? captureCountdown), prepare * 1000);
    timers.current.push(timer);
    return () => clearTimeout(timer);
  }, [burst, phase, camera.phase, currentIndex, pose?.countdownSec, captureCountdown, startCountdown, session?.timers.prepareBeforeCaptureSec]);

  // Los temporizadores pendientes mueren con la pantalla: salir a media tanda no debe disparar.
  useEffect(
    () => () => {
      for (const timer of timers.current) clearTimeout(timer);
      timers.current = [];
      if (frame.current) cancelAnimationFrame(frame.current);
      frame.current = 0;
    },
    [],
  );

  if (!session || !product) return null;

  const startBurst = () => {
    setBurst(true);
  };

  const criteria: CriteriaItem[] = isDocument
    ? (compliance?.criteria ?? VISION_CRITERIA.map((c) => ({ key: c.key, status: 'na' as const, instruction: 'ok' as const })))
        .filter((c) => c.status !== 'na')
        .map((c) => ({ key: c.key, label: t(`criteria.${c.key}`), status: c.status, hint: c.status === 'ok' ? undefined : t(`instructions.${mirrorInstruction(c.instruction)}`) }))
    : [];
  const primary = isDocument ? mirrorInstruction(compliance?.primaryInstruction ?? 'no_face') : hints[0] ? mirrorInstruction(hints[0]) : 'ok';
  const primaryTone = isDocument ? (compliance?.canAutoCapture ? 'ok' : compliance?.criteria.some((c) => c.status === 'block') ? 'block' : 'warn') : hints.length > 0 ? 'warn' : 'ok';
  const cropRect = compliance?.crop;
  const silhouette = resolveAssetUrl(bundle, pose?.silhouetteAssetId);
  const retakesForPhoto = retakesLeft(product, session, currentIndex);
  const title = isDocument ? t('kiosk.capture.title_document') : t('kiosk.capture.title_experience');

  if (!isDocument) {
    /**
     * El momento que viven los ojos. La subida y el compás siguen siendo «acaba de disparar»:
     * entre el obturador y la foto en su hueco no pasa nada que la persona deba mirar.
     */
    const moment: LensMoment = phase === 'countdown' ? 'countdown' : phase === 'shooting' ? 'shot' : burst ? 'work' : 'rest';
    // El aro de luz es la única fuente de relleno que este producto controla: entra a dos
    // segundos del disparo y se queda hasta que la foto está guardada.
    const halo = phase === 'countdown' ? countdown <= LENS_WIDE_SEC : phase === 'shooting' || phase === 'uploading';
    // Cada toma tiene su acento, y durante la cuenta el campo corta a otro en cada segundo: el
    // color ES la señal del tiempo, y de paso ninguna composición se queda fija en el panel.
    const accent = ((phase === 'countdown' ? currentIndex + countdown : currentIndex) % ACCENTS) + 1;
    const cadence = phase === 'countdown' ? 'count' : burst ? 'work' : 'call';
    const machineCode = bundle?.machine.code;

    return (
      <Shell bleed marquee={<Marquee cadence={cadence} />} hideHeader hideLang>
        {/* El reloj de la sesión sigue corriendo aunque no se vea: esta pantalla va a sangre y no
            lleva `SessionFrame`, que es donde vive. Sin él, una sesión abandonada antes del
            primer toque dejaría la máquina ocupada para siempre. */}
        <IdleGuard onAutoAdvance={() => void advance('idle_auto_advance')} />
        <div className="kiosk-captura" data-phase={phase} data-accent={accent} data-aro={halo ? 'true' : 'false'} data-testid="capture-screen">
          {/* CARTEL: el espejo a sangre. Aquí no hay nada táctil, y encima de la cara sólo van
              los dos ojos del lente. */}
          <div className="kiosk-captura__cartel">
            <CameraView source={camera.source} loadingLabel={camera.phase === 'starting' ? t('kiosk.capture.preparing_camera') : t('kiosk.capture.loading_vision')} />
            <div className="kiosk-captura__aro" aria-hidden="true">
              <span />
              <span />
              <span />
              <span />
            </div>
            <LensEyes bundle={bundle} state={lensStateFor(moment, countdown)} />
            {phase === 'countdown' && countdown > 0 ? (
              /* El numeral va sobre la cara, sin velo detrás: bajarle la luz a la persona en el
                 único momento en que se está mirando pelea contra el motivo por el que vino. */
              <span key={countdown} className="kiosk-captura__numeral" aria-hidden="true">
                {countdown}
              </span>
            ) : null}
            {flash ? (
              <>
                <div className="kiosk-capture__flash" />
                <div className="kiosk-captura__caida" aria-hidden="true" />
              </>
            ) : null}
          </div>

          {/* REPISA: la tira ES el progreso. Huecos vacíos desde el primer segundo, punteados,
              llenándose con cada toma. Ni un número. */}
          <div className="kiosk-captura__repisa">
            <ol className="kiosk-captura__tira" style={{ ['--psp-slots' as string]: total }} aria-label={t('kiosk.capture.strip')}>
              {Array.from({ length: total }, (_unused, i) => {
                const url = shots.get(i);
                const flying = lastShot?.index === i;
                return (
                  <li
                    key={i}
                    className="kiosk-captura__hueco"
                    data-filled={url ? 'true' : 'false'}
                    style={{ ['--psp-slot' as string]: i, ['--psp-hueco' as string]: `var(--psp-color-accent-${(i % ACCENTS) + 1})` }}
                  >
                    <span className="psp-sr-only">{t(url ? 'kiosk.capture.slot_taken' : 'kiosk.capture.slot_pending', { n: i + 1 })}</span>
                    {url ? <img className={`kiosk-captura__foto${flying ? ' kiosk-captura__foto--vuelo' : ''}`} key={flying ? lastShot.id : 'quieta'} src={url} alt="" /> : null}
                  </li>
                );
              })}
            </ol>
          </div>

          {/* ALCANCE: exactamente una cosa. Antes de empezar, el único botón; mientras la máquina
              trabaja, la pose que toca, actuada por una forma de la familia. */}
          <div className="kiosk-captura__alcance">
            {burst ? (
              <div className="kiosk-captura__pose" data-testid="capture-burst">
                <BlobFace variant={((currentIndex % ACCENTS) + 1) as BlobVariant} size={220} expression={phase === 'countdown' && countdown <= 1 ? 'grin' : 'happy'} animated />
                <span className="kiosk-captura__instruccion">{tl(pose?.instruction) || t('kiosk.capture.smile')}</span>
              </div>
            ) : (
              <BigButton size="xl" variant="primary" block icon={<Icon name="camera" />} disabled={camera.phase !== 'ready'} onClick={startBurst} data-testid="capture-manual">
                {t('kiosk.capture.start_sequence')}
              </BigButton>
            )}
          </div>

          <div className="kiosk-captura__zocalo">
            {machineCode ? <span>{machineCode}</span> : null}
            {visionLimited ? <span>{t('kiosk.capture.vision_unavailable')}</span> : null}
            {cameraKind === 'synthetic' ? <span>{t('kiosk.capture.synthetic_notice')}</span> : null}
          </div>

          {/* Los últimos segundos, para quien navega con lector de pantalla: el `Countdown` del
              sistema declara `aria-live="off"` y nunca anuncia nada. */}
          <p className="psp-sr-only" role="status" aria-live="polite">
            {phase === 'countdown' && countdown > 0 && countdown <= 3 ? t('kiosk.capture.countdown_live', { n: countdown }) : ''}
          </p>
        </div>
      </Shell>
    );
  }

  return (
    <SessionFrame title={title}>
      <div className="kiosk-capture">
        <div style={{ position: 'relative' }}>
          <CameraView
            source={camera.source}
            loadingLabel={camera.phase === 'starting' ? t('kiosk.capture.preparing_camera') : t('kiosk.capture.loading_vision')}
            overlay={
              <>
                {cropRect ? (
                  <>
                    <rect x={cropRect.x} y={cropRect.y} width={cropRect.w} height={cropRect.h} fill="none" stroke={compliance?.canAutoCapture ? '#2ecc71' : '#ffb020'} strokeWidth={4} rx={8} />
                    <line x1={cropRect.x} x2={cropRect.x + cropRect.w} y1={cropRect.y + cropRect.h * ((preset.spec.face.eyeLineFromTop.min + preset.spec.face.eyeLineFromTop.max) / 2)} y2={cropRect.y + cropRect.h * ((preset.spec.face.eyeLineFromTop.min + preset.spec.face.eyeLineFromTop.max) / 2)} stroke="#ffffff" strokeDasharray="8 8" strokeWidth={2} />
                  </>
                ) : null}
                <ellipse cx={ANALYSIS_WIDTH / 2} cy={ANALYSIS_HEIGHT * 0.44} rx={ANALYSIS_HEIGHT * 0.22} ry={ANALYSIS_HEIGHT * 0.3} fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth={2} strokeDasharray="10 10" />
                {silhouette ? <image href={silhouette} x={0} y={0} width={ANALYSIS_WIDTH} height={ANALYSIS_HEIGHT} opacity={0.45} preserveAspectRatio="xMidYMid meet" /> : null}
                {(analysis?.faces ?? []).map((f, i) => (
                  <rect key={i} x={f.box.x * ANALYSIS_WIDTH} y={f.box.y * ANALYSIS_HEIGHT} width={f.box.w * ANALYSIS_WIDTH} height={f.box.h * ANALYSIS_HEIGHT} fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth={1.5} />
                ))}
              </>
            }
          />
          {phase === 'countdown' ? (
            <div className="kiosk-capture__countdown">
              <div className="kiosk-capture__countdown-figure">
                <Countdown seconds={countdown} total={captureCountdown} label={t('kiosk.capture.countdown')} size={200} tone="accent" caption={t('kiosk.capture.stability')} />
              </div>
            </div>
          ) : null}
          {flash ? <div className="kiosk-capture__flash" /> : null}
          {autoEnabled && phase === 'live' ? (
            <div style={{ position: 'absolute', right: 16, bottom: 16 }}>
              <Countdown seconds={Math.round(autoProgress * 100)} total={100} size={96} tone="primary" label={t('kiosk.capture.auto_hint')} format={() => ''} />
            </div>
          ) : null}
        </div>
        <div className="kiosk-capture__side">
          <InstructionBanner tone={primaryTone} size="lg" animate={primaryTone !== 'ok'}>
            {t(`instructions.${primary}`)}
          </InstructionBanner>
          <CriteriaList items={criteria} compact label={t('kiosk.capture.criteria')} statusLabels={{ ok: t('kiosk.capture.status_ok'), warn: t('kiosk.capture.status_warn'), block: t('kiosk.capture.status_block'), na: t('kiosk.capture.status_na') }} />
          {visionLimited ? <Notice tone="warn" position="static">{t('kiosk.capture.vision_unavailable')}</Notice> : null}
          {cameraKind === 'synthetic' ? <StatusPill tone="info">{t('kiosk.capture.synthetic_notice')}</StatusPill> : null}
          {autoEnabled ? <p className="kiosk-small kiosk-muted">{t('kiosk.capture.auto_hint')}</p> : null}
          {product.manualCapture || !autoEnabled ? (
            <BigButton size="xl" variant="primary" block icon={<Icon name="camera" />} disabled={phase !== 'live' || camera.phase !== 'ready'} loading={phase === 'uploading'} loadingLabel={t('kiosk.capture.uploading')} onClick={() => startCountdown(pose?.countdownSec ?? captureCountdown)} data-testid="capture-manual">
              {t('kiosk.capture.manual')}
            </BigButton>
          ) : null}
        </div>
      </div>
    </SessionFrame>
  );
}

/**
 * El temporizador de inactividad sin nada que mirar.
 *
 * Vive en su propio componente porque el recorrido social no monta `SessionFrame` —el plan
 * prohíbe un reloj de sesión en esta pantalla— y un hook no se puede llamar a medias. Mientras la
 * máquina dispara, `useIdleHold` lo tiene retenido; lo que vigila es la espera antes del primer
 * toque, que es la única en la que de verdad puede no haber nadie delante.
 */
function IdleGuard({ onAutoAdvance }: { onAutoAdvance: () => void }) {
  useSessionTimeout(true, undefined, { onAutoAdvance });
  return null;
}
