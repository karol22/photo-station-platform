/**
 * Capa de pegatinas sobre la foto.
 *
 * Antes sólo cabía una pegatina, siempre en el mismo punto, elegida desde una fila de botones.
 * Eso no es pegar algo en tu foto: es rellenar un formulario. Aquí se arrastra con el dedo, se
 * escala y se gira con dos dedos, caben varias, y se quita sacándola de la foto.
 *
 * Las coordenadas viven en el espacio de la imagen original, que es el que entiende `applyEditOps`,
 * y se convierten a píxeles de pantalla al pintar. Así lo que se ve arrastrando es exactamente lo
 * que se compone después, sin una segunda verdad que se pueda desincronizar.
 *
 * Sólo se usan eventos de puntero, que cubren dedo y ratón con el mismo código, y `setPointerCapture`
 * para que sacar el dedo del elemento no interrumpa el arrastre.
 */
import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

export interface PlacedSticker {
  /** Identificador de la instancia, no del activo: la misma pegatina puede estar dos veces. */
  key: string;
  assetId: string;
  url: string;
  /** Centro, en píxeles de la imagen original. */
  x: number;
  y: number;
  /** Lado, en píxeles de la imagen original. */
  size: number;
  /** Giro en grados. */
  angle: number;
}

export interface StickerLayerProps {
  stickers: PlacedSticker[];
  /**
   * `transient` marca los cambios de un arrastre en curso. Quien lo reciba debe reemplazar el
   * último estado en vez de apilar uno nuevo: si no, deshacer una vez retrocede un píxel y hacen
   * falta cincuenta toques para volver a donde estaba la pegatina.
   */
  onChange: (stickers: PlacedSticker[], options?: { transient?: boolean }) => void;
  /** Tamaño de la imagen original, para convertir entre su espacio y el de la pantalla. */
  imageWidth: number;
  imageHeight: number;
  /** Etiqueta accesible de la acción de quitar. */
  removeLabel: string;
}

/** Distancia y ángulo entre dos punteros: la base del pellizco. */
function spread(a: { x: number; y: number }, b: { x: number; y: number }): { distance: number; angle: number } {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return { distance: Math.hypot(dx, dy), angle: (Math.atan2(dy, dx) * 180) / Math.PI };
}

const MIN_SIZE = 48;

export function StickerLayer({ stickers, onChange, imageWidth, imageHeight, removeLabel }: StickerLayerProps) {
  const host = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<string | undefined>();
  /** Punteros activos por pegatina, en coordenadas de la imagen. */
  const pointers = useRef<Map<string, Map<number, { x: number; y: number }>>>(new Map());
  const start = useRef<Map<string, { size: number; angle: number; distance: number; rotation: number }>>(new Map());

  /** Convierte un punto de pantalla al espacio de la imagen original. */
  const toImage = (clientX: number, clientY: number): { x: number; y: number } | undefined => {
    const box = host.current?.getBoundingClientRect();
    if (!box || box.width === 0) return undefined;
    return { x: ((clientX - box.left) / box.width) * imageWidth, y: ((clientY - box.top) / box.height) * imageHeight };
  };

  const update = (key: string, patch: Partial<PlacedSticker>) => {
    onChange(
      stickers.map((s) => (s.key === key ? { ...s, ...patch } : s)),
      { transient: true },
    );
  };

  const down = (event: ReactPointerEvent<HTMLDivElement>, sticker: PlacedSticker) => {
    const point = toImage(event.clientX, event.clientY);
    if (!point) return;
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Sin captura el arrastre sigue funcionando mientras el dedo no salga del elemento; no es
      // motivo para abandonar el gesto.
    }
    const map = pointers.current.get(sticker.key) ?? new Map();
    map.set(event.pointerId, point);
    pointers.current.set(sticker.key, map);
    if (map.size === 2) {
      const [a, b] = [...map.values()];
      const s = spread(a!, b!);
      start.current.set(sticker.key, { size: sticker.size, angle: s.angle, distance: s.distance, rotation: sticker.angle });
    }
    setDragging(sticker.key);
  };

  const move = (event: ReactPointerEvent<HTMLDivElement>, sticker: PlacedSticker) => {
    const map = pointers.current.get(sticker.key);
    if (!map?.has(event.pointerId)) return;
    const point = toImage(event.clientX, event.clientY);
    if (!point) return;
    const previous = map.get(event.pointerId)!;
    map.set(event.pointerId, point);

    if (map.size >= 2) {
      // Dos dedos: escala y giro. La posición la deja quieta el pellizco para que no se escape.
      const [a, b] = [...map.values()];
      const now = spread(a!, b!);
      const from = start.current.get(sticker.key);
      if (!from || from.distance === 0) return;
      update(sticker.key, {
        size: Math.max(MIN_SIZE, from.size * (now.distance / from.distance)),
        angle: from.rotation + (now.angle - from.angle),
      });
      return;
    }
    update(sticker.key, { x: sticker.x + (point.x - previous.x), y: sticker.y + (point.y - previous.y) });
  };

  const up = (event: ReactPointerEvent<HTMLDivElement>, sticker: PlacedSticker) => {
    const map = pointers.current.get(sticker.key);
    map?.delete(event.pointerId);
    if (map && map.size < 2) start.current.delete(sticker.key);
    if (!map || map.size === 0) {
      setDragging(undefined);
      // Al soltar, el estado final sí se apila: es un paso que deshacer debe poder revertir.
      onChange(stickers);
      // Sacarla de la foto es quitarla: el gesto que ya espera cualquiera que haya movido algo.
      const outside = sticker.x < 0 || sticker.y < 0 || sticker.x > imageWidth || sticker.y > imageHeight;
      if (outside) onChange(stickers.filter((s) => s.key !== sticker.key));
    }
  };

  return (
    <div className="kiosk-stickers" ref={host} data-dragging={dragging ? 'true' : undefined}>
      {stickers.map((sticker) => {
        const left = `${(sticker.x / imageWidth) * 100}%`;
        const top = `${(sticker.y / imageHeight) * 100}%`;
        const size = `${(sticker.size / imageWidth) * 100}%`;
        return (
          <div
            key={sticker.key}
            className="kiosk-sticker"
            data-active={dragging === sticker.key ? 'true' : undefined}
            style={{ left, top, width: size, transform: `translate(-50%, -50%) rotate(${sticker.angle}deg)` }}
            onPointerDown={(event) => down(event, sticker)}
            onPointerMove={(event) => move(event, sticker)}
            onPointerUp={(event) => up(event, sticker)}
            onPointerCancel={(event) => up(event, sticker)}
          >
            <img src={sticker.url} alt="" draggable={false} />
            <button
              type="button"
              className="kiosk-sticker__remove"
              aria-label={removeLabel}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => onChange(stickers.filter((s) => s.key !== sticker.key))}
            >
              <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        );
      })}
    </div>
  );
}
