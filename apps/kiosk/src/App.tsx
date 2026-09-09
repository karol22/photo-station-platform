/**
 * Raíz del kiosco: rutas, arranque (`/status`, `/bundle`, `/sessions/active`), eventos SSE, tema
 * del bundle, bloqueo de gestos y recuperación de la sesión activa tras una recarga.
 */
import { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { Spinner } from '@psp/ui';
import { useStationEvents } from './api/events';
import { useT } from './i18n';
import { ROUTES, screenForStage } from './session/flow';
import { useKioskStore } from './store';
import { applyBundleTheme, configBool } from './theme/assets';
import { AttractScreen } from './screens/Attract';
import { HomeScreen } from './screens/Home';
import { ProductDetailScreen } from './screens/ProductDetail';
import { ConsentScreen } from './screens/Consent';
import { PaymentScreen } from './screens/Payment';
import { CaptureScreen } from './screens/Capture';
import { ReviewScreen } from './screens/Review';
import { EditScreen } from './screens/Edit';
import { SelectScreen } from './screens/Select';
import { ComposeScreen } from './screens/Compose';
import { ConfirmScreen } from './screens/Confirm';
import { PrintScreen } from './screens/Print';
import { FinishScreen } from './screens/Finish';
import { ErrorScreen } from './screens/Error';
import { TechScreen } from './screens/Tech';

function useGestureLock(): void {
  useEffect(() => {
    const prevent = (event: Event) => event.preventDefault();
    const preventZoom = (event: TouchEvent) => {
      if (event.touches.length > 1) event.preventDefault();
    };
    const preventKeyZoom = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && ['+', '-', '=', '0'].includes(event.key)) event.preventDefault();
    };
    document.addEventListener('contextmenu', prevent);
    document.addEventListener('selectstart', prevent);
    document.addEventListener('dragstart', prevent);
    document.addEventListener('touchmove', preventZoom, { passive: false });
    document.addEventListener('gesturestart', prevent);
    document.addEventListener('keydown', preventKeyZoom);
    return () => {
      document.removeEventListener('contextmenu', prevent);
      document.removeEventListener('selectstart', prevent);
      document.removeEventListener('dragstart', prevent);
      document.removeEventListener('touchmove', preventZoom);
      document.removeEventListener('gesturestart', prevent);
      document.removeEventListener('keydown', preventKeyZoom);
    };
  }, []);
}

function Bootstrap({ children }: { children: React.ReactNode }) {
  const { t } = useT();
  const navigate = useNavigate();
  const bootstrap = useKioskStore((s) => s.bootstrap);
  const bundle = useKioskStore((s) => s.bundle);
  const setConnection = useKioskStore((s) => s.setConnection);
  const [ready, setReady] = useState(false);
  useStationEvents();
  useGestureLock();

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        await bootstrap();
        if (cancelled) return;
        const session = useKioskStore.getState().session;
        if (session && !['done', 'cancelled', 'failed', 'expired', 'abandoned'].includes(session.stage)) {
          navigate(screenForStage(session.stage, session.product), { replace: true });
        }
        setReady(true);
      } catch {
        if (cancelled) return;
        setConnection('lost');
        setReady(true);
        setTimeout(run, 4000);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
    // Sólo al montar: la recuperación de sesión ocurre una vez por carga.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    applyBundleTheme(bundle);
    document.documentElement.classList.toggle('kiosk--simplified', configBool(bundle, 'kiosk.simplifiedMode'));
    const orientation = bundle?.effective.values['kiosk.orientation'];
    document.documentElement.dataset['orientation'] = orientation === 'landscape' ? 'landscape' : 'portrait';
  }, [bundle]);

  if (!ready) {
    return (
      <div className="psp-kiosk kiosk-boot" data-testid="kiosk-boot">
        <Spinner size="xl" label={t('kiosk.attract.loading')} />
        <p>{t('kiosk.attract.loading')}</p>
      </div>
    );
  }
  return <>{children}</>;
}

export function App() {
  return (
    <BrowserRouter>
      <Bootstrap>
        <Routes>
          <Route path={ROUTES.attract} element={<AttractScreen />} />
          <Route path={ROUTES.home} element={<HomeScreen />} />
          <Route path={ROUTES.product} element={<ProductDetailScreen />} />
          <Route path={ROUTES.consent} element={<ConsentScreen />} />
          <Route path={ROUTES.payment} element={<PaymentScreen />} />
          <Route path={ROUTES.capture} element={<CaptureScreen />} />
          <Route path={ROUTES.review} element={<ReviewScreen />} />
          <Route path={ROUTES.edit} element={<EditScreen />} />
          <Route path={ROUTES.select} element={<SelectScreen />} />
          <Route path={ROUTES.compose} element={<ComposeScreen />} />
          <Route path={ROUTES.confirm} element={<ConfirmScreen />} />
          <Route path={ROUTES.print} element={<PrintScreen />} />
          <Route path={ROUTES.finish} element={<FinishScreen />} />
          <Route path={ROUTES.error} element={<ErrorScreen />} />
          <Route path={ROUTES.tech} element={<TechScreen />} />
          <Route path="*" element={<Navigate to={ROUTES.attract} replace />} />
        </Routes>
      </Bootstrap>
    </BrowserRouter>
  );
}
