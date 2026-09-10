/**
 * Envoltura de toda pantalla: `KioskShell` con logotipo del bundle, selector de idioma, aviso de
 * conexión perdida y la zona oculta (5 toques en la esquina superior izquierda) hacia `/tech`.
 */
import { useRef, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { KioskShell, LangSwitch, Notice } from '@psp/ui';
import { useT } from '../i18n';
import { ROUTES } from '../session/flow';
import { useKioskStore } from '../store';
import { availableLocales } from '../store/reducers';
import { configString, resolveAssetUrl } from '../theme/assets';

export interface ShellProps {
  children: ReactNode;
  headerStart?: ReactNode;
  headerEnd?: ReactNode;
  footer?: ReactNode;
  background?: ReactNode;
  hideHeader?: boolean;
  contentAlign?: 'start' | 'center';
  hideLang?: boolean;
}

const HIDDEN_TAPS = 5;
const HIDDEN_WINDOW_MS = 2500;

export function Shell({ children, headerStart, headerEnd, footer, background, hideHeader, contentAlign, hideLang }: ShellProps) {
  const { t } = useT();
  const navigate = useNavigate();
  const bundle = useKioskStore((s) => s.bundle);
  const locale = useKioskStore((s) => s.locale);
  const setLocale = useKioskStore((s) => s.setLocale);
  const connection = useKioskStore((s) => s.connection);
  const taps = useRef<number[]>([]);

  const logo = resolveAssetUrl(bundle, configString(bundle, 'branding.logoAssetId'));
  const publicName = configString(bundle, 'branding.publicName') ?? bundle?.organization.name ?? '';
  const locales = availableLocales(bundle);

  const onHiddenTap = () => {
    const now = Date.now();
    taps.current = [...taps.current.filter((at) => now - at < HIDDEN_WINDOW_MS), now];
    if (taps.current.length >= HIDDEN_TAPS) {
      taps.current = [];
      navigate(ROUTES.tech);
    }
  };

  return (
    <KioskShell
      className="kiosk-shell"
      brand={
        <button type="button" className="kiosk-brand" onClick={onHiddenTap} aria-label={publicName} data-testid="hidden-tech-zone">
          {logo ? <img src={logo} alt="" className="kiosk-brand__logo" /> : null}
          <span className="kiosk-brand__name">{publicName}</span>
        </button>
      }
      langSwitch={
        !hideLang && locales.length > 1 ? (
          <LangSwitch
            options={locales.map((code) => ({ code, label: t(`kiosk.lang.${code}`), shortLabel: code.toUpperCase() }))}
            value={locale}
            onChange={(code) => setLocale(code === 'en' ? 'en' : 'es')}
            label={t('kiosk.common.language')}
            size="lg"
          />
        ) : undefined
      }
      headerStart={headerStart}
      headerEnd={headerEnd}
      footer={footer}
      background={background}
      hideHeader={hideHeader}
      contentAlign={contentAlign}
    >
      {children}
      <Notice open={connection === 'lost'} tone="warn" position="top-center" title={t('kiosk.connection.lost')}>
        {t('kiosk.connection.retrying')}
      </Notice>
    </KioskShell>
  );
}
