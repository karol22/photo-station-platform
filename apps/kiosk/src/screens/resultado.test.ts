/**
 * Las decisiones puras de las pantallas donde la persona ve su resultado.
 *
 * Se prueban aquí y no en el navegador porque son las que deciden qué se lleva: qué fotos y en qué
 * orden. Lo visual se ejerce con la pantalla corriendo; esto es lo que no puede fallar en silencio.
 */
import { describe, expect, it } from 'vitest';
import { keptShots, toggleShot } from './Review';
import { filterOptions } from '../components/FilterStrip';

const shots = [
  { id: 'c0', index: 0 },
  { id: 'c1', index: 1 },
  { id: 'c2', index: 2 },
  { id: 'c3', index: 3 },
  { id: 'c4', index: 4 },
  { id: 'c5', index: 5 },
];

describe('revisión: descartar dos de seis', () => {
  it('lo que se lleva va en el orden en que se tomó, no en el de los toques', () => {
    // La persona enciende primero la última: la tira sigue contando la historia en orden.
    const selected = ['c5', 'c0', 'c3'];
    expect(keptShots(shots, selected).map((s) => s.id)).toEqual(['c0', 'c3', 'c5']);
  });

  it('tocar una encendida la apaga, y volver a tocarla la enciende', () => {
    const selected = ['c0', 'c1', 'c2', 'c3'];
    const apagada = toggleShot(selected, 'c1', 4);
    expect(apagada).toEqual(['c0', 'c2', 'c3']);
    expect(toggleShot(apagada, 'c1', 4)).toContain('c1');
  });

  it('con la tira llena no se enciende una más: primero hay que apagar', () => {
    const selected = ['c0', 'c1', 'c2', 'c3'];
    expect(toggleShot(selected, 'c4', 4)).toEqual(selected);
    expect(toggleShot(toggleShot(selected, 'c0', 4), 'c4', 4)).toEqual(['c1', 'c2', 'c3', 'c4']);
  });

  it('nunca se lleva más de lo que cabe, se toque lo que se toque', () => {
    let selected: string[] = [];
    for (const shot of [...shots, ...shots]) selected = toggleShot(selected, shot.id, 4);
    expect(selected.length).toBeLessThanOrEqual(4);
  });

  it('una toma que no está en la lista de tomas no aparece en el resultado', () => {
    expect(keptShots(shots, ['c1', 'fantasma']).map((s) => s.id)).toEqual(['c1']);
  });
});

describe('edición: el riel de estilos', () => {
  it('siempre hay forma de volver al original, y va primero', () => {
    const options = filterOptions(['saturation', 'contrast', 'sharpen']);
    expect(options[0]?.key).toBe('none');
    expect(options[0]?.ops).toEqual([]);
  });

  it('sólo se ofrece el estilo cuyas operaciones el producto permite aplicar', () => {
    const options = filterOptions(['saturation', 'contrast', 'sharpen']).map((o) => o.key);
    expect(options).toContain('vivid');
    // Sin la herramienta de blanco y negro ni la de viñeta, ese estilo no se ofrece.
    expect(options).not.toContain('bw_contrast');
  });

  it('un producto sin herramientas de color no muestra riel', () => {
    expect(filterOptions([])).toEqual([]);
  });

  it('el riel del recorrido social cabe entero en la banda: nunca pide desplazarse', () => {
    const creative = filterOptions(['saturation', 'contrast', 'sharpen', 'temperature', 'brightness', 'grayscale', 'vignette', 'filterIntensity']);
    // Seis estilos más el original: con seis columnas de 1080 px cada ficha pasa de 64 px de lado.
    expect(creative.length).toBeLessThanOrEqual(7);
    expect(creative.length).toBeGreaterThan(1);
  });
});
