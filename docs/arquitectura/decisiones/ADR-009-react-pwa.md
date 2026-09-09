# ADR-009 · React + Vite como PWA, migrable a WebView Android

## Contexto
Hoy se desarrolla en una MacBook con webcam; el hardware objetivo puede ser un PC industrial o Android.

## Decisión
Kiosco y admin son apps React con Vite. El kiosco es una PWA táctil sin dependencias de teclado o mouse. El design system (`packages/ui`) usa CSS con tokens; sin frameworks CSS externos.

## Consecuencias
- Corre hoy en Chrome en la MacBook con la webcam real.
- En Android, se empaqueta en un WebView con el agente embebido; `getUserMedia` y canvas siguen disponibles.
- Playwright es la vía prevista para pruebas end-to-end del kiosco.
