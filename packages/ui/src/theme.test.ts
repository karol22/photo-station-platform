import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ACCENTS,
  applyBrandingTheme,
  assignAccentRoles,
  buildThemeVariables,
  contrastRatio,
  hueOf,
  parseHexColor,
} from './theme';

const UNA_DE_TODOS = ['#FF6FA5', '#FF7A3C', '#FFC24A', '#5FCB92', '#4C86E8', '#A87BE8'];

describe('hueOf', () => {
  it('reconoce los matices primarios', () => {
    expect(Math.round(hueOf('#FF0000'))).toBe(0);
    expect(Math.round(hueOf('#00FF00'))).toBe(120);
    expect(Math.round(hueOf('#0000FF'))).toBe(240);
  });

  it('un gris no tiene matiz y no rompe', () => {
    expect(hueOf('#808080')).toBe(0);
    expect(hueOf('no es un color')).toBe(0);
  });
});

describe('assignAccentRoles', () => {
  it('la luz es el acento más luminoso', () => {
    expect(assignAccentRoles(UNA_DE_TODOS).luz).toBe('#FFC24A');
  });

  it('confirma con el verde y avisa con el naranja, sin mirar posiciones', () => {
    const roles = assignAccentRoles(UNA_DE_TODOS);
    expect(roles.confirma).toBe('#5FCB92');
    expect(roles.avisa).toBe('#FFC24A');
  });

  it('reparte igual aunque la marca declare los colores en otro orden', () => {
    const revuelta = [...UNA_DE_TODOS].reverse();
    expect(assignAccentRoles(revuelta)).toEqual(assignAccentRoles(UNA_DE_TODOS));
  });

  it('sin verde ni ámbar, cae a la luminancia en vez de quedarse sin papeles', () => {
    const frios = ['#1B3A8F', '#2E63D8', '#7FA8FF'];
    const roles = assignAccentRoles(frios);
    expect(roles.luz).toBe('#7FA8FF');
    expect(roles.confirma).toBeTruthy();
    expect(roles.avisa).toBeTruthy();
  });

  it('las etapas van ordenadas por matiz, que es el orden en que cambia la habitación', () => {
    const etapas = assignAccentRoles(UNA_DE_TODOS).etapas;
    const matices = etapas.map(hueOf);
    expect([...matices].sort((a, b) => a - b)).toEqual(matices);
  });

  it('una paleta vacía no lanza y devuelve algo pintable', () => {
    const roles = assignAccentRoles([]);
    expect(parseHexColor(roles.luz)).not.toBeNull();
  });

  it('ignora los valores que no son colores', () => {
    expect(assignAccentRoles(['#5FCB92', 'rosa mexicano', '']).confirma).toBe('#5FCB92');
  });
});

describe('la superficie ya no se fuerza a blanco puro', () => {
  it('sobre un fondo crema la superficie conserva el tono de la marca', () => {
    const vars = buildThemeVariables({ background: '#F3EEE4', text: '#111111' });
    expect(vars['--psp-color-surface']).not.toBe('#ffffff');
    expect(vars['--psp-color-surface']).not.toBe('#FFFFFF');
  });

  it('la superficie sigue siendo más clara que el fondo, para que se distinga', () => {
    const vars = buildThemeVariables({ background: '#F3EEE4', text: '#111111' });
    const surface = parseHexColor(vars['--psp-color-surface']!)!;
    const bg = parseHexColor('#F3EEE4')!;
    expect(surface.r + surface.g + surface.b).toBeGreaterThan(bg.r + bg.g + bg.b);
  });

  it('el texto de la marca sigue legible sobre la superficie derivada', () => {
    const vars = buildThemeVariables({ background: '#F3EEE4', text: '#111111' });
    const ratio = contrastRatio(parseHexColor(vars['--psp-color-surface']!)!, parseHexColor('#111111')!);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });
});

describe('tokens de luz', () => {
  const applied = () => applyBrandingTheme({ 'branding.palette.accents': UNA_DE_TODOS, 'branding.palette.background': '#F3EEE4', 'branding.palette.text': '#111111' }, null);

  it('el aro es más claro que el campo y el rincón más oscuro', () => {
    const vars = applied();
    const luma = (hex: string) => {
      const c = parseHexColor(hex)!;
      return c.r + c.g + c.b;
    };
    expect(luma(vars['--psp-aro']!)).toBeGreaterThan(luma(vars['--psp-field']!));
    expect(luma(vars['--psp-rincon']!)).toBeLessThan(luma(vars['--psp-field']!));
  });

  it('el relieve es un desplazamiento duro, sin difuminado', () => {
    expect(applied()['--psp-lift']).toMatch(/^10px 10px 0 #/);
  });

  it('los papeles llegan como variables y no como índices', () => {
    const vars = applied();
    expect(vars['--psp-role-luz']).toBe('#FFC24A');
    expect(vars['--psp-role-confirma']).toBe('#5FCB92');
  });

  it('sin acentos declarados usa los de reserva y sigue dando los tres tokens', () => {
    const vars = applyBrandingTheme({}, null);
    expect(vars['--psp-field']).toBe(DEFAULT_ACCENTS[0]);
    expect(vars['--psp-aro']).toBeTruthy();
    expect(vars['--psp-rincon']).toBeTruthy();
  });
});
