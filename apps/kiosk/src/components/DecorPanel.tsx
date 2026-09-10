/**
 * Decoración de la foto: accesorios que se colocan solos sobre el rostro y un texto corto.
 *
 * ## Por qué los accesorios no se arrastran
 * Un sombrero puesto a mano queda torcido, chico y encima de la frente; la malla facial ya sabe
 * dónde va la cabeza, cuánto mide y cuánto está inclinada, así que ponerlo es un toque y no un
 * gesto de precisión con el dedo a metro y medio. Si hay dos personas, el toque pone uno a cada
 * una: es la misma ancla evaluada por rostro. Después se puede seguir arrastrando con la capa de
 * pegatinas, porque la colocación automática es un punto de partida bueno, no una cárcel.
 *
 * Cuando la cámara no ve ningún rostro en la foto, esta mitad no aparece. Ofrecer un botón de
 * "sombrero" que deja el dibujo en medio de la nada es peor que no ofrecerlo.
 *
 * ## Por qué sí hay teclado, y por qué es este teclado
 * El presupuesto del recorrido son seis toques de la foto al resultado, y un nombre no cabe ahí.
 * Pero un nombre es justo lo único que ninguna frase enlatada puede dar, y es lo que se pidió. La
 * salida no es elegir entre frases o teclado: es que el camino de un toque sea el primero y el
 * teclado viva detrás de una tecla, para que quien no quiera escribir ni lo vea.
 *
 * El teclado que sí cabe de pie, a metro y medio y con fila detrás:
 * - **Sólo mayúsculas.** Sin mayúsculas ni minúsculas no hay tecla de cambio, no hay estado y no
 *   hay una decisión de estilo que nadie quiere tomar. Un nombre en una foto se ve en mayúsculas.
 * - **Sin números ni puntuación.** Cada fila de más aleja las teclas del pulgar y alarga la
 *   búsqueda. Lo que lleva número (una edad, un año) es una frase del bundle, no algo que se teclee.
 * - **Alfabeto en orden, no QWERTY.** Quien usa la cabina no está buscando velocidad de mecanógrafo:
 *   está buscando una letra. En orden se encuentra sin haber aprendido nada.
 * - **Doce caracteres.** Un nombre cabe; un mensaje no. El límite es también el que hace que el
 *   texto siga siendo legible al tamaño con el que se compone.
 *
 * Con eso, "SOFÍA" son cinco toques más el de aceptar. La frase del bundle o la fecha siguen siendo
 * uno solo, y son lo primero que se ve.
 *
 * ## Cómo se monta
 * ```tsx
 * <DecorPanel image={original} ops={ops} onChange={push} allowedTools={allowed} />
 * ```
 * `push` es el mismo que ya apila el historial de la pantalla de edición. El panel no guarda estado
 * de la foto: lee las ops que recibe y devuelve la lista completa, así que deshacer y rehacer lo
 * mueven igual que a todo lo demás.
 */
import { useEffect, useMemo, useState } from 'react';
import type { EditOp, EditingTool } from '@psp/contracts';
import { anchorToStickerOp, captionLayout, captionOp } from '@psp/imaging';
import type { Raster } from '@psp/imaging';
import { anchorsFor } from '@psp/vision';
import type { FaceLandmarks, PropKind } from '@psp/vision';
import { Icon, contrastColor, readBrandingAccents } from '@psp/ui';
import { useT } from '../i18n';
import { useKioskStore } from '../store';
import { configString, resolveAssetUrl } from '../theme/assets';
import { createAnalyzer } from '../vision/analyzer';

/** Un botón de accesorio y las piezas que coloca. Los aretes son dos piezas con un solo dibujo. */
interface PropButton {
  id: 'hat' | 'glasses' | 'moustache' | 'earrings';
  kinds: PropKind[];
  configKey: string;
}

const PROP_BUTTONS: PropButton[] = [
  { id: 'hat', kinds: ['hat'], configKey: 'kiosk.faceProps.hatAssetId' },
  { id: 'glasses', kinds: ['glasses'], configKey: 'kiosk.faceProps.glassesAssetId' },
  { id: 'moustache', kinds: ['moustache'], configKey: 'kiosk.faceProps.moustacheAssetId' },
  { id: 'earrings', kinds: ['earringLeft', 'earringRight'], configKey: 'kiosk.faceProps.earringAssetId' },
];

/** Un nombre cabe en doce caracteres; un mensaje no, y a partir de ahí deja de leerse en la foto. */
export const CAPTION_MAX_LENGTH = 12;

/** Alfabeto en orden, sin cambio de caja, sin números y sin puntuación. */
export const LETTER_ROWS: string[][] = [
  ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'],
  ['J', 'K', 'L', 'M', 'N', 'Ñ', 'O', 'P', 'Q'],
  ['R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'],
  ['Á', 'É', 'Í', 'Ó', 'Ú', ' '],
];

/** Lógica pura del teclado: agrega una letra hasta el tope, borra la última, o no cambia nada. */
export function applyLetterKey(value: string, key: string, max: number): string {
  if (key === 'delete') return value.slice(0, -1);
  if (key.length !== 1) return value;
  if (value.length >= max) return value;
  // Un espacio al principio no es un nombre, es un desplazamiento invisible.
  if (key === ' ' && value.length === 0) return value;
  return value + key;
}

export interface DecorPanelProps {
  /** Foto original en píxeles: es el espacio en el que viven las ops. */
  image: Raster | undefined;
  /** Ops actuales de esta foto. */
  ops: EditOp[];
  /** El mismo `push` de la pantalla: apila un paso que deshacer puede revertir. */
  onChange: (next: EditOp[]) => void;
  /** Herramientas que el producto permite (`product.editing.allowedTools`). */
  allowedTools: EditingTool[];
}

export function DecorPanel({ image, ops, onChange, allowedTools }: DecorPanelProps) {
  const { t, locale } = useT();
  const bundle = useKioskStore((s) => s.bundle);
  const [faces, setFaces] = useState<FaceLandmarks[]>([]);
  const [typing, setTyping] = useState(false);

  const values = bundle?.effective.values;
  const accents = useMemo(() => readBrandingAccents(values ?? {}), [values]);
  const phrases = useMemo(() => {
    const raw = values?.['kiosk.captionPhrases'];
    return Array.isArray(raw) ? raw.filter((p): p is string => typeof p === 'string' && p.trim().length > 0) : [];
  }, [values]);
  const font = configString(bundle, 'kiosk.captionFont');

  // La fecha la arma la app, no la lógica de dominio: aquí sí hay reloj y sí hay idioma.
  const today = useMemo(() => new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date()), [locale]);

  /**
   * Los rostros se sacan de la foto ya tomada, no de la vista previa: la persona se movió entre el
   * disparo y esta pantalla, y lo que hay que decorar es la imagen que se va a llevar.
   */
  useEffect(() => {
    if (!image) {
      setFaces([]);
      return;
    }
    let active = true;
    setFaces([]);
    createAnalyzer()
      .then(({ analyzer }) => analyzer.analyze(image, 0))
      .then((analysis) => {
        if (active) setFaces(analysis.faces);
      })
      .catch(() => {
        // Sin malla no hay colocación automática: la mitad de accesorios simplemente no aparece.
        if (active) setFaces([]);
      });
    return () => {
      active = false;
    };
  }, [image]);

  const allowStickers = allowedTools.includes('stickers');
  const allowText = allowedTools.includes('text');

  const buttons = useMemo(
    () =>
      PROP_BUTTONS.map((button) => ({ ...button, assetId: configString(bundle, button.configKey) })).filter(
        (button): button is PropButton & { assetId: string } => button.assetId !== undefined && resolveAssetUrl(bundle, button.assetId) !== undefined,
      ),
    [bundle],
  );

  const caption = useMemo(() => {
    const op = ops.find((o) => o.op === 'text');
    return typeof op?.params['text'] === 'string' ? op.params['text'] : '';
  }, [ops]);
  // Blanco sólo como red de seguridad: `readBrandingAccents` siempre trae los seis de la marca.
  const captionColor = useMemo(() => {
    const op = ops.find((o) => o.op === 'text');
    const chosen = op?.params['color'];
    return typeof chosen === 'string' ? chosen : accents[0] ?? '#FFFFFF';
  }, [ops, accents]);

  const [draft, setDraft] = useState('');
  useEffect(() => {
    if (typing) setDraft(caption);
  }, [typing, caption]);

  const usesAsset = (assetId: string): boolean => ops.some((o) => o.op === 'sticker' && o.params['assetId'] === assetId);

  /**
   * Un toque pone la pieza sobre cada rostro que la sostiene; el mismo toque la quita. Las anclas
   * que no llegan a confianza no se colocan, así que un perfil marcado se queda sin arete y no con
   * un arete flotando en la mejilla.
   */
  const toggleProp = (button: PropButton & { assetId: string }) => {
    if (!image) return;
    const others = ops.filter((o) => !(o.op === 'sticker' && o.params['assetId'] === button.assetId));
    if (usesAsset(button.assetId)) {
      onChange(others);
      return;
    }
    const frameAspect = image.width / image.height;
    const placed: EditOp[] = [];
    for (const kind of button.kinds) {
      for (const anchor of anchorsFor(kind, faces, { frameAspect })) {
        placed.push(anchorToStickerOp(button.assetId, anchor, image));
      }
    }
    if (placed.length === 0) return;
    onChange([...others, ...placed]);
  };

  const setCaption = (text: string, color: string) => {
    if (!image) return;
    const others = ops.filter((o) => o.op !== 'text');
    const op = captionOp(text, captionLayout(image), { color, outlineColor: contrastColor(color), ...(font ? { font } : {}) });
    onChange(op ? [...others, op] : others);
  };

  if (!image) return null;
  const showProps = allowStickers && buttons.length > 0 && faces.length > 0;
  if (!showProps && !allowText) return null;

  return (
    <div className="kiosk-edicion-decor">
      {showProps ? (
        <section className="kiosk-edicion-decor__block" aria-label={t('kiosk.edit.props.title')}>
          <p className="kiosk-small">{faces.length > 1 ? t('kiosk.edit.props.hint_many', { n: faces.length }) : t('kiosk.edit.props.hint')}</p>
          <div className="kiosk-edicion-decor__props">
            {buttons.map((button) => (
              <button
                key={button.id}
                type="button"
                className="kiosk-edicion-decor__prop"
                aria-pressed={usesAsset(button.assetId)}
                onClick={() => toggleProp(button)}
                data-testid={`prop-${button.id}`}
              >
                <img src={resolveAssetUrl(bundle, button.assetId)} alt="" draggable={false} />
                <span>{t(`kiosk.edit.props.${button.id}`)}</span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {allowText ? (
        <section className="kiosk-edicion-decor__block" aria-label={t('kiosk.edit.caption.title')}>
          <div className="kiosk-edicion-decor__phrases">
            {caption.length > 0 ? (
              <button type="button" className="kiosk-edicion-decor__phrase" aria-pressed onClick={() => setCaption('', captionColor)} data-testid="caption-clear">
                <Icon name="close" /> {caption}
              </button>
            ) : null}
            <button type="button" className="kiosk-edicion-decor__phrase" onClick={() => setCaption(today, captionColor)} data-testid="caption-date">
              {today}
            </button>
            {phrases.map((phrase) => (
              <button key={phrase} type="button" className="kiosk-edicion-decor__phrase" aria-pressed={caption === phrase} onClick={() => setCaption(phrase, captionColor)}>
                {phrase}
              </button>
            ))}
            <button type="button" className="kiosk-edicion-decor__phrase kiosk-edicion-decor__phrase--write" onClick={() => setTyping(true)} data-testid="caption-write">
              <Icon name="edit" /> {t('kiosk.edit.caption.write')}
            </button>
          </div>

          <div className="kiosk-edicion-decor__colors" role="group" aria-label={t('kiosk.edit.caption.color')}>
            {accents.map((color, index) => (
              <button
                key={color}
                type="button"
                className="kiosk-edicion-decor__color"
                style={{ background: color }}
                aria-label={t('kiosk.edit.caption.color_n', { n: index + 1 })}
                aria-pressed={captionColor === color}
                onClick={() => setCaption(caption, color)}
              >
                {captionColor === color ? <Icon name="check" /> : null}
              </button>
            ))}
          </div>

          {typing ? (
            <div className="kiosk-edicion-decor__keyboard">
              <p className="kiosk-edicion-decor__draft" role="status">
                {draft.length > 0 ? draft : t('kiosk.edit.caption.placeholder')}
              </p>
              {LETTER_ROWS.map((row, index) => (
                <div key={index} className="kiosk-edicion-decor__row">
                  {row.map((key) => (
                    <button
                      key={key}
                      type="button"
                      className="kiosk-edicion-decor__key"
                      data-wide={key === ' ' ? 'true' : undefined}
                      aria-label={key === ' ' ? t('kiosk.edit.caption.space') : key}
                      disabled={draft.length >= CAPTION_MAX_LENGTH && key !== ' '}
                      onClick={() => setDraft(applyLetterKey(draft, key, CAPTION_MAX_LENGTH))}
                    >
                      {key === ' ' ? '␣' : key}
                    </button>
                  ))}
                  {index === LETTER_ROWS.length - 1 ? (
                    <>
                      <button
                        type="button"
                        className="kiosk-edicion-decor__key kiosk-edicion-decor__key--delete"
                        aria-label={t('kiosk.edit.caption.delete')}
                        disabled={draft.length === 0}
                        onClick={() => setDraft(applyLetterKey(draft, 'delete', CAPTION_MAX_LENGTH))}
                      >
                        <Icon name="back" />
                      </button>
                      <button
                        type="button"
                        className="kiosk-edicion-decor__key kiosk-edicion-decor__key--done"
                        aria-label={t('kiosk.edit.caption.done')}
                        onClick={() => {
                          setTyping(false);
                          setCaption(draft, captionColor);
                        }}
                        data-testid="caption-done"
                      >
                        <Icon name="check" />
                      </button>
                    </>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
