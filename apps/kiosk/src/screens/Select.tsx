/**
 * Selección: rejilla de miniaturas con selección ordenada, mover/quitar y comparar según
 * `experience.selection`. Guarda con `POST /sessions/:id/selection`.
 */
import { useMemo, useState } from 'react';
import { bestCaptures } from '@psp/domain';
import { BigButton, CompareView, Icon, ThumbGrid } from '@psp/ui';
import { stationApi } from '../api/station';
import { SessionFrame } from '../components/SessionFrame';
import { useT } from '../i18n';
import { useSession } from '../session/useSession';
import { useKioskStore } from '../store';

export function SelectScreen() {
  const { t } = useT();
  const { session, product, experience, template, advance, fail } = useSession();
  const setSession = useKioskStore((s) => s.setSession);
  const [saving, setSaving] = useState(false);
  const [compare, setCompare] = useState(false);

  const captures = useMemo(() => {
    if (!session) return [];
    const byIndex = new Map<number, (typeof session.captures)[number]>();
    for (const c of session.captures) byIndex.set(c.index, c);
    return [...byIndex.values()].sort((a, b) => a.index - b.index);
  }, [session]);

  const slots = template?.photoSlots ?? product?.captureCount ?? 0;
  const max = experience?.selection.max ?? slots;
  /**
   * La cabina llega con una propuesta hecha, no con una rejilla vacía: las mejores ya vienen
   * marcadas. Quien esté conforme toca continuar y se va; quien quiera cambiarlas, toca.
   */
  const initial = useMemo(
    () => (session?.selection.length ? session.selection : bestCaptures(captures, max)),
    [session?.selection, captures, max],
  );
  const [chosen, setChosen] = useState<string[] | undefined>();
  const selected = chosen ?? initial;
  const setSelected = setChosen;

  if (!session || !product) return null;
  const min = experience?.selection.min ?? Math.min(slots, captures.length);
  const allowReorder = experience?.selection.allowReorder ?? true;
  const allowCompare = experience?.selection.allowCompare ?? true;
  const valid = selected.length >= min && selected.length <= max;

  const move = (id: string, delta: number) => {
    const index = selected.indexOf(id);
    const target = index + delta;
    if (index < 0 || target < 0 || target >= selected.length) return;
    const next = [...selected];
    next.splice(index, 1);
    next.splice(target, 0, id);
    setSelected(next);
  };

  const confirm = async (ids: string[] = selected) => {
    setSaving(true);
    try {
      const updated = await stationApi.setSelection(session.id, ids);
      setSession(updated);
      await advance('selection_done');
    } catch (error) {
      setSaving(false);
      fail(error);
    }
  };

  /**
   * Si se acaba el tiempo, la cabina elige por su cuenta las mejores y continúa. Quedarse
   * congelada aquí sería lo peor: la persona ya pagó y sus fotos ya existen.
   */
  const autoSelect = () => {
    if (saving) return;
    const ids = selected.length >= min ? selected : bestCaptures(captures, max);
    void confirm(ids);
  };

  const first = captures.find((c) => c.id === selected[0]);
  const second = captures.find((c) => c.id === selected[1]);

  return (
    <SessionFrame title={t('kiosk.select.title')} onAutoAdvance={autoSelect}>
      <p className="kiosk-lead">{min === max ? t('kiosk.select.hint_exact', { n: max }) : t('kiosk.select.hint', { min, max })}</p>
      {compare && first && second ? (
        <CompareView left={{ src: first.editedUrl ?? first.url, label: '1' }} right={{ src: second.editedUrl ?? second.url, label: '2' }} />
      ) : (
        <ThumbGrid
          items={captures.map((c) => ({ id: c.id, src: c.editedUrl ?? c.url, label: t('kiosk.common.photo_n_of_m', { n: c.index + 1, m: captures.length }) }))}
          selected={selected}
          onChange={setSelected}
          max={max}
          showOrder={allowReorder}
          label={t('kiosk.select.title')}
          selectedLabel={t('kiosk.select.is_selected')}
          size="lg"
          data-testid="select-grid"
        />
      )}
      {allowReorder && selected.length > 1 ? (
        <div className="kiosk-chips" style={{ marginTop: 16 }}>
          {selected.map((id, i) => (
            <span key={id} className="kiosk-row">
              <button type="button" className="kiosk-chip" onClick={() => move(id, -1)} disabled={i === 0} aria-label={t('kiosk.select.move_left')}>
                ← {i + 1}
              </button>
              <button type="button" className="kiosk-chip" onClick={() => move(id, 1)} disabled={i === selected.length - 1} aria-label={t('kiosk.select.move_right')}>
                {i + 1} →
              </button>
            </span>
          ))}
        </div>
      ) : null}
      <p className="kiosk-small kiosk-muted">{selected.length < min ? t('kiosk.select.too_few', { n: min }) : selected.length > max ? t('kiosk.select.too_many', { n: max }) : t('kiosk.select.order')}</p>
      <div className="kiosk-actions">
        {allowCompare && selected.length >= 2 ? (
          <BigButton variant="secondary" onClick={() => setCompare((c) => !c)}>
            {t('kiosk.common.compare')}
          </BigButton>
        ) : null}
        <BigButton variant="primary" size="xl" icon={<Icon name="check" />} disabled={!valid} loading={saving} loadingLabel={t('kiosk.common.loading')} onClick={() => void confirm()} data-testid="select-confirm">
          {t('kiosk.common.continue')}
        </BigButton>
      </div>
    </SessionFrame>
  );
}
