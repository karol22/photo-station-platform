import { describe, expect, it } from 'vitest';
import { parseInlines, parseMarkdown } from './markdown';

describe('parseMarkdown', () => {
  it('reconoce encabezados, párrafos, listas y código', () => {
    const blocks = parseMarkdown('# Título\n\nUn párrafo\ncontinúa.\n\n- uno\n- dos\n\n1. a\n2. b\n\n```\nx = 1\n```');
    expect(blocks).toEqual([
      { kind: 'heading', level: 1, inlines: [{ kind: 'text', text: 'Título' }] },
      { kind: 'paragraph', inlines: [{ kind: 'text', text: 'Un párrafo continúa.' }] },
      { kind: 'list', ordered: false, items: [[{ kind: 'text', text: 'uno' }], [{ kind: 'text', text: 'dos' }]] },
      { kind: 'list', ordered: true, items: [[{ kind: 'text', text: 'a' }], [{ kind: 'text', text: 'b' }]] },
      { kind: 'code', text: 'x = 1' },
    ]);
  });
  it('separa énfasis en línea', () => {
    expect(parseInlines('a **b** c `d` *e*')).toEqual([
      { kind: 'text', text: 'a ' },
      { kind: 'bold', text: 'b' },
      { kind: 'text', text: ' c ' },
      { kind: 'code', text: 'd' },
      { kind: 'text', text: ' ' },
      { kind: 'italic', text: 'e' },
    ]);
  });
});
