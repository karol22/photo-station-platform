/**
 * Acceso a la sesión activa desde las pantallas: producto, preset, plantilla y experiencia
 * resueltos contra el bundle, más las acciones de avance/cancelación que hablan con el agente.
 */
import { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { DocumentPresetVersion, Experience, PrintTemplate, Product, SessionStage, StationSession } from '@psp/contracts';
import { StationApiError, stationApi } from '../api/station';
import { useKioskStore } from '../store';
import { ROUTES, flowOptionsFor, nextStage, screenForStage, type FlowOptions } from './flow';

export interface SessionContext {
  session: StationSession | undefined;
  product: Product | undefined;
  preset: DocumentPresetVersion | undefined;
  template: PrintTemplate | undefined;
  experience: Experience | undefined;
  flow: FlowOptions | undefined;
  /** Avanza a la siguiente etapa del plan y navega a su pantalla. */
  advance: (reason?: string) => Promise<void>;
  /** Salta a una etapa concreta (p. ej. volver a capturar) y navega. */
  goToStage: (stage: SessionStage, reason?: string) => Promise<void>;
  cancel: (reason?: string) => Promise<void>;
  /** Registra el error en el store y navega a la pantalla de error. */
  fail: (error: unknown, fallbackCode?: string) => void;
}

export function useSession(): SessionContext {
  const navigate = useNavigate();
  const session = useKioskStore((s) => s.session);
  const bundle = useKioskStore((s) => s.bundle);
  const status = useKioskStore((s) => s.status);
  const setSession = useKioskStore((s) => s.setSession);
  const setError = useKioskStore((s) => s.setError);
  const resetSession = useKioskStore((s) => s.resetSession);

  const product = session?.product;
  const preset = useMemo(
    () => session?.presetVersion ?? (product?.presetId ? bundle?.presetVersions.find((v) => v.presetId === product.presetId) : undefined),
    [session?.presetVersion, product?.presetId, bundle?.presetVersions],
  );
  const template = useMemo(() => bundle?.templates.find((t) => t.id === (session?.templateId ?? product?.output.templateId)), [bundle?.templates, session?.templateId, product?.output.templateId]);
  const experience = useMemo(() => bundle?.experiences.find((e) => e.id === (session?.experienceId ?? product?.experienceId)), [bundle?.experiences, session?.experienceId, product?.experienceId]);
  const flow = useMemo(() => (product ? flowOptionsFor({ product, bundle, status, session }) : undefined), [product, bundle, status, session]);

  const fail = useCallback(
    (error: unknown, fallbackCode = 'generic') => {
      const code = error instanceof StationApiError ? error.code : fallbackCode;
      const message = error instanceof Error ? error.message : String(error);
      setError({ code, message, ...(error instanceof StationApiError && error.incidentCode ? { incidentCode: error.incidentCode } : {}) });
      navigate(ROUTES.error);
    },
    [navigate, setError],
  );

  const goToStage = useCallback(
    async (stage: SessionStage, reason?: string) => {
      if (!session) return;
      try {
        const updated = await stationApi.advanceStage(session.id, stage, reason);
        setSession(updated);
        navigate(screenForStage(updated.stage, updated.product));
      } catch (error) {
        fail(error, 'invalid_transition');
      }
    },
    [session, setSession, navigate, fail],
  );

  const advance = useCallback(
    async (reason?: string) => {
      if (!session || !product || !flow) return;
      const stage = nextStage(product, session.stage, flow);
      if (!stage) {
        navigate(ROUTES.finish);
        return;
      }
      await goToStage(stage, reason);
    },
    [session, product, flow, goToStage, navigate],
  );

  const cancel = useCallback(
    async (reason?: string) => {
      if (session) await stationApi.cancel(session.id, reason).catch(() => undefined);
      resetSession();
      navigate(ROUTES.attract);
    },
    [session, resetSession, navigate],
  );

  return { session, product, preset, template, experience, flow, advance, goToStage, cancel, fail };
}
