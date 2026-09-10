/**
 * El token de aprovisionamiento demo debe seguir apuntando a la marca del dataset demo.
 * `fleet.ts` guarda ese id como literal para no arrastrar `@psp/fixtures` al grafo de imports del
 * servidor (ver el comentario de `DEMO_ORGANIZATION`); esta prueba es lo que impide que el literal
 * se quede atrás cuando la marca cambie, como ya pasó al renombrar `org_lumina` a
 * `org_una_de_todos`. `@psp/fixtures` sólo se importa aquí, en la prueba, nunca en el servidor.
 */
import { describe, expect, it } from 'vitest';
import { DEMO_IDS } from '@psp/fixtures';
import { DEMO_ORGANIZATION } from './fleet';

describe('token de aprovisionamiento demo', () => {
  it('enrola en la organización del dataset demo', () => {
    // La anotación falla en `typecheck`, no sólo al correr la prueba, si los dos valores divergen.
    const pinned: typeof DEMO_IDS.org.unaDeTodos = DEMO_ORGANIZATION;
    expect(pinned).toBe(DEMO_IDS.org.unaDeTodos);
  });
});
