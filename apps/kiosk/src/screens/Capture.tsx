/**
 * Captura. Modo documental: vista en espejo, recorte del preset como superposición, criterios,
 * instrucción principal, anillo de auto-captura y botón manual. Modo experiencia: secuencia de
 * poses con instrucción, silueta, cuenta regresiva, n/N, pistas no bloqueantes y repetición por foto.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import type { PoseStep } from '@psp/contracts';
import { BigButton, BlobFace, Countdown, CriteriaList, Icon, InstructionBanner, Notice, ProgressDots, Sheet, StatusPill, type BlobVariant, type CriteriaItem } from '@psp/ui';
import { AutoCaptureController, VISION_CRITERIA, evaluateDocumentCompliance, evaluatePoseGuidance, mirrorInstruction, type ComplianceResult, type FrameAnalysis, type InstructionKey } from '@psp/vision';
import { stationApi } from '../api/station';
import { ANALYSIS_HEIGHT, ANALYSIS_WIDTH, useCamera, useFrameLoop } from '../camera/useCamera';
import { captureDocument, capturePhoto, summarize } from '../capture/capture';
import { CameraView } from '../components/CameraView';
import { SessionFrame } from '../components/SessionFrame';
import { useT } from '../i18n';
import { retakesLeft } from '../session/flow';
import { useSession } from '../session/useSession';
import { useKioskStore } from '../store';
import { resolveAssetUrl } from '../theme/assets';

interface RetakeState {
  retakeOf?: string;
  index?: number;
}

type Phase = 'live' | 'countdown' | 'shooting' | 'uploading';

export function CaptureScreen() {
  const { t, tl } = useT();
  const location = useLocation();
  const { session, product, preset, experience, advance, fail } = useSession();
  const bundle = useKioskStore((s) => s.bundle);
  const visionLimited = useKioskStore((s) => s.visionLimited);
  const cameraKind = useKioskStore((s) => s.cameraKind);
  const setSession = useKioskStore((s) => s.setSession);
  const camera = useCamera(true);
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
  const latest = useRef<{ analysis?: FrameAnalysis; compliance?: ComplianceResult }>({});
  const phaseRef = useRef<Phase>('live');
  phaseRef.current = phase;

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

  const shoot = useCallback(async () => {
    if (!session || !product || !camera.source) return;
    setPhase('shooting');
    setFlash(true);
    setTimeout(() => setFlash(false), 500);
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
      if (created && retakesLeft(product, updated, currentIndex) > 0 && (product.retakes.perPhoto || product.retakes.wholeSession)) {
        setLastShot({ url: created.url, id: created.id, index: currentIndex });
        setPhase('live');
        return;
      }
      if (currentIndex + 1 < total) {
        setPoseIndex(currentIndex + 1);
        setPhase('live');
        controller.reset();
      } else {
        await advance('captured');
      }
    } catch (error) {
      fail(error, 'capture_failed');
    }
  }, [session, product, camera.source, isDocument, preset, currentIndex, retake.retakeOf, autoEnabled, setSession, advance, total, controller, fail]);

  const startCountdown = useCallback(
    (seconds: number) => {
      if (phaseRef.current !== 'live') return;
      setPhase('countdown');
      setCountdown(seconds);
      let left = seconds;
      const tick = setInterval(() => {
        left -= 1;
        setCountdown(left);
        if (left <= 0) {
          clearInterval(tick);
          void shoot();
        }
      }, 1000);
    },
    [shoot],
  );

  useFrameLoop(
    camera.source,
    camera.analyzer,
    (frame) => {
      setAnalysis(frame);
      if (isDocument) {
        const result = evaluateDocumentCompliance(frame, preset.spec);
        latest.current = { analysis: frame, compliance: result };
        setCompliance(result);
        if (autoEnabled && phaseRef.current === 'live' && !lastShot) {
          const update = controller.update(result, frame.atMs);
          setAutoProgress(update.progress);
          if (update.shouldCapture) startCountdown(Math.min(captureCountdown, 2));
        }
      } else {
        latest.current = { analysis: frame };
        if (experience?.guidanceEnabled !== false) setHints(evaluatePoseGuidance(frame, pose?.guidance).hints);
      }
    },
    camera.phase === 'ready',
  );

  useEffect(() => {
    if (camera.phase === 'failed') fail(new Error('camera'), 'camera_unavailable');
  }, [camera.phase, fail]);

  if (!session || !product) return null;

  const keepShot = () => {
    setLastShot(undefined);
    if (currentIndex + 1 < total) {
      setPoseIndex(currentIndex + 1);
      controller.reset();
    } else {
      void advance('captured');
    }
  };

  const retakeShot = () => {
    if (!lastShot) return;
    // Repetir: la siguiente toma sustituye a la anterior en el mismo índice.
    setRetake({ retakeOf: lastShot.id, index: lastShot.index });
    setLastShot(undefined);
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

  return (
    <SessionFrame title={title}>
      <div className="kiosk-capture">
        <div style={{ position: 'relative' }}>
          <CameraView
            source={camera.source}
            loadingLabel={camera.phase === 'starting' ? t('kiosk.capture.preparing_camera') : t('kiosk.capture.loading_vision')}
            overlay={
              <>
                {isDocument && cropRect ? (
                  <>
                    <rect x={cropRect.x} y={cropRect.y} width={cropRect.w} height={cropRect.h} fill="none" stroke={compliance?.canAutoCapture ? '#2ecc71' : '#ffb020'} strokeWidth={4} rx={8} />
                    <line x1={cropRect.x} x2={cropRect.x + cropRect.w} y1={cropRect.y + cropRect.h * ((preset.spec.face.eyeLineFromTop.min + preset.spec.face.eyeLineFromTop.max) / 2)} y2={cropRect.y + cropRect.h * ((preset.spec.face.eyeLineFromTop.min + preset.spec.face.eyeLineFromTop.max) / 2)} stroke="#ffffff" strokeDasharray="8 8" strokeWidth={2} />
                  </>
                ) : null}
                {isDocument ? <ellipse cx={ANALYSIS_WIDTH / 2} cy={ANALYSIS_HEIGHT * 0.44} rx={ANALYSIS_HEIGHT * 0.22} ry={ANALYSIS_HEIGHT * 0.3} fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth={2} strokeDasharray="10 10" /> : null}
                {pose?.guidance?.zone ? <rect x={pose.guidance.zone.x * ANALYSIS_WIDTH} y={pose.guidance.zone.y * ANALYSIS_HEIGHT} width={pose.guidance.zone.w * ANALYSIS_WIDTH} height={pose.guidance.zone.h * ANALYSIS_HEIGHT} fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth={3} strokeDasharray="12 8" rx={12} /> : null}
                {silhouette ? <image href={silhouette} x={0} y={0} width={ANALYSIS_WIDTH} height={ANALYSIS_HEIGHT} opacity={0.45} preserveAspectRatio="xMidYMid meet" /> : null}
                {(analysis?.faces ?? []).map((f, i) => (
                  <rect key={i} x={f.box.x * ANALYSIS_WIDTH} y={f.box.y * ANALYSIS_HEIGHT} width={f.box.w * ANALYSIS_WIDTH} height={f.box.h * ANALYSIS_HEIGHT} fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth={1.5} />
                ))}
              </>
            }
          />
          {phase === 'countdown' ? (
            <div className="kiosk-capture__countdown">
              {/* Cuenta regresiva con personalidad: en el recorrido social acompaña una forma
                  distinta en cada segundo; en el documental el número va solo, sin distraer. */}
              <div className="kiosk-capture__countdown-figure">
                {!isDocument ? (
                  <BlobFace variant={((countdown % 6) + 1) as BlobVariant} size={132} expression={countdown <= 1 ? 'grin' : 'happy'} />
                ) : null}
                <Countdown seconds={countdown} total={captureCountdown} label={t('kiosk.capture.countdown')} size={isDocument ? 200 : 168} tone="accent" caption={pose && !isDocument ? t('kiosk.capture.smile') : t('kiosk.capture.stability')} />
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
          {!isDocument && total > 1 ? <ProgressDots steps={total} current={currentIndex} label={t('kiosk.common.photo_n_of_m', { n: currentIndex + 1, m: total })} showNumbers size="lg" /> : null}
          {pose && !isDocument ? (
            <div className="kiosk-card">
              <h2 style={{ margin: 0 }}>{tl(pose.name) || t('kiosk.common.photo_n_of_m', { n: currentIndex + 1, m: total })}</h2>
              <p className="kiosk-lead" style={{ marginBottom: 0 }}>{tl(pose.instruction) || t('kiosk.capture.pose_intro', { n: currentIndex + 1, m: total })}</p>
              {pose.guidance?.expectedPeople ? <p className="kiosk-small kiosk-muted">{t('kiosk.capture.expected_people', { n: pose.guidance.expectedPeople })}</p> : null}
            </div>
          ) : null}
          <InstructionBanner tone={primaryTone} size="lg" animate={primaryTone !== 'ok'}>
            {t(`instructions.${primary}`)}
          </InstructionBanner>
          {isDocument ? <CriteriaList items={criteria} compact label={t('kiosk.capture.criteria')} statusLabels={{ ok: t('kiosk.capture.status_ok'), warn: t('kiosk.capture.status_warn'), block: t('kiosk.capture.status_block'), na: t('kiosk.capture.status_na') }} /> : null}
          {visionLimited ? <Notice tone="warn" position="static">{t('kiosk.capture.vision_unavailable')}</Notice> : null}
          {cameraKind === 'synthetic' ? <StatusPill tone="info">{t('kiosk.capture.synthetic_notice')}</StatusPill> : null}
          {autoEnabled ? <p className="kiosk-small kiosk-muted">{t('kiosk.capture.auto_hint')}</p> : null}
          {product.manualCapture || !autoEnabled ? (
            <BigButton size="xl" variant="primary" block icon={<Icon name="camera" />} disabled={phase !== 'live' || camera.phase !== 'ready'} loading={phase === 'uploading'} loadingLabel={t('kiosk.capture.uploading')} onClick={() => startCountdown(pose?.countdownSec ?? captureCountdown)} data-testid="capture-manual">
              {isDocument ? t('kiosk.capture.manual') : t('kiosk.capture.start_sequence')}
            </BigButton>
          ) : null}
          {!isDocument ? <p className="kiosk-small kiosk-muted">{retakesForPhoto === 0 ? t('kiosk.capture.no_retakes') : retakesForPhoto === 1 ? t('kiosk.capture.retake_one_left') : t('kiosk.capture.retakes_left', { n: retakesForPhoto })}</p> : null}
        </div>
      </div>
      <Sheet
        open={!!lastShot}
        title={t('kiosk.common.photo_n_of_m', { n: (lastShot?.index ?? 0) + 1, m: total })}
        dismissible={false}
        hideHandle
        size="half"
        actions={
          <>
            <BigButton variant="secondary" icon={<Icon name="retry" />} onClick={retakeShot} disabled={retakesForPhoto === 0}>
              {t('kiosk.capture.retake')}
            </BigButton>
            <BigButton variant="primary" size="xl" icon={<Icon name="check" />} onClick={keepShot} data-testid="capture-keep">
              {t('kiosk.capture.keep')}
            </BigButton>
          </>
        }
      >
        {lastShot ? (
          <div className="kiosk-preview">
            <img src={lastShot.url} alt="" style={{ transform: 'scaleX(-1)' }} />
          </div>
        ) : null}
      </Sheet>
    </SessionFrame>
  );
}
