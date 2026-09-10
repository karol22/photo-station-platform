import { describe, expect, it } from 'vitest';
import { FORBIDDEN_BUSINESS_TEXT } from './gates';

/** Lo que marcaría la compuerta en una línea de una UI. */
const hits = (line: string): string[] =>
  FORBIDDEN_BUSINESS_TEXT.flatMap((re) => {
    const m = line.match(re);
    return m?.[0] ? [m[0]] : [];
  });

describe('texto de negocio prohibido en las UIs', () => {
  it('marca la marca real puesta a mano', () => {
    const lines = [
      '<h1>Una de Todos</h1>',
      "const footer = 'Una de Todos · Fotos que nos juntan';",
      '<span className="logo">UNA DE TODOS</span>',
      "const support = 'soporte@unadetodos.demo';",
      "if (session.organizationId === 'org_una_de_todos') return brandTheme;",
    ];
    for (const line of lines) expect(hits(line), line).not.toEqual([]);
  });

  it('deja pasar el copy del producto que juega con la marca', () => {
    const lines = [
      "'kiosk.review.title_set': ['¡Qué buena una de todos!', 'What a great one of everyone!'],",
      "'kiosk.capture.prompt': ['Ahora una de todos', 'Now one of everyone'],",
      "'kiosk.select.hint': ['Una de todos y otra de cada quien', 'One of everyone and one each'],",
    ];
    for (const line of lines) expect(hits(line), line).toEqual([]);
  });

  it('marca la otra marca del dataset, las ciudades y los precios', () => {
    expect(hits("name: 'FotoRápida'")).toEqual(['FotoRápida']);
    expect(hits('<td>Monterrey</td>')).toEqual(['Monterrey']);
    expect(hits('<td>Querétaro</td>')).toEqual(['Querétaro']);
    expect(hits('<td>Bogotá</td>')).toEqual(['Bogotá']);
    expect(hits('<td>Ciudad de México</td>')).toEqual(['Ciudad de México']);
    expect(hits('<td>León</td>')).toEqual(['León']);
    expect(hits('<span>$80.00</span>')).toEqual(['$80.00']);
  });

  it('no marca palabras que sólo contienen una ciudad ni cantidades de un dígito', () => {
    expect(hits('const leon = 0; // Leonardo no es una ciudad')).toEqual([]);
    expect(hits('<span>$8</span>')).toEqual([]);
  });
});
