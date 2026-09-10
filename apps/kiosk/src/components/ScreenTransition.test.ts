import { describe, expect, it } from 'vitest';
import { direction, stepIndex } from './ScreenTransition';

describe('dirección de la transición', () => {
  it('avanzar en el recorrido entra por la derecha', () => {
    expect(direction('/session/capture', '/session/review')).toBe('forward');
    expect(direction('/', '/home')).toBe('forward');
  });

  it('retroceder entra por la izquierda', () => {
    expect(direction('/session/review', '/session/capture')).toBe('back');
    expect(direction('/home', '/')).toBe('back');
  });

  it('la primera pantalla de la carga no tiene dirección', () => {
    expect(direction(undefined, '/session/capture')).toBe('none');
  });

  it('quedarse en la misma ruta no anima', () => {
    expect(direction('/session/edit', '/session/edit')).toBe('none');
  });

  it('las rutas fuera del recorrido entran sin dirección', () => {
    expect(direction('/session/capture', '/error')).toBe('none');
    expect(direction('/tech', '/session/edit')).toBe('none');
  });

  it('la ruta de producto cuenta como un paso del recorrido', () => {
    expect(stepIndex('/product/prd_tira_amigos')).toBeGreaterThan(stepIndex('/home'));
    expect(direction('/home', '/product/prd_tira_amigos')).toBe('forward');
  });

  it('la atracción sólo coincide con la raíz exacta, no con todo lo que empieza por barra', () => {
    expect(stepIndex('/session/edit')).not.toBe(stepIndex('/'));
  });
});
