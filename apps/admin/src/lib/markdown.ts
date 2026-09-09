/**
 * Markdown mínimo para documentación interna: encabezados (#..###), listas con `-`/`*`/`1.`,
 * párrafos, bloques de código con ``` y énfasis `**negrita**`/`*cursiva*`/`` `código` ``.
 * Devuelve un modelo de bloques; el render a React vive en `components/Markdown.tsx`.
 */
export type InlineNode = { kind: 'text' | 'bold' | 'italic' | 'code'; text: string };

export type MarkdownBlock =
  | { kind: 'heading'; level: 1 | 2 | 3; inlines: InlineNode[] }
  | { kind: 'paragraph'; inlines: InlineNode[] }
  | { kind: 'list'; ordered: boolean; items: InlineNode[][] }
  | { kind: 'code'; text: string };

export function parseInlines(text: string): InlineNode[] {
  const out: InlineNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g;
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > last) out.push({ kind: 'text', text: text.slice(last, index) });
    const token = match[0];
    if (token.startsWith('**')) out.push({ kind: 'bold', text: token.slice(2, -2) });
    else if (token.startsWith('`')) out.push({ kind: 'code', text: token.slice(1, -1) });
    else out.push({ kind: 'italic', text: token.slice(1, -1) });
    last = index + token.length;
  }
  if (last < text.length) out.push({ kind: 'text', text: text.slice(last) });
  return out;
}

export function parseMarkdown(source: string): MarkdownBlock[] {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const blocks: MarkdownBlock[] = [];
  let paragraph: string[] = [];
  let list: { ordered: boolean; items: InlineNode[][] } | undefined;
  let code: string[] | undefined;

  const flushParagraph = () => {
    if (paragraph.length > 0) {
      blocks.push({ kind: 'paragraph', inlines: parseInlines(paragraph.join(' ')) });
      paragraph = [];
    }
  };
  const flushList = () => {
    if (list) {
      blocks.push({ kind: 'list', ordered: list.ordered, items: list.items });
      list = undefined;
    }
  };

  for (const raw of lines) {
    if (code !== undefined) {
      if (raw.trim().startsWith('```')) {
        blocks.push({ kind: 'code', text: code.join('\n') });
        code = undefined;
      } else code.push(raw);
      continue;
    }
    const line = raw.trimEnd();
    if (line.trim().startsWith('```')) {
      flushParagraph();
      flushList();
      code = [];
      continue;
    }
    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    if (heading) {
      flushParagraph();
      flushList();
      blocks.push({ kind: 'heading', level: heading[1]!.length as 1 | 2 | 3, inlines: parseInlines(heading[2] ?? '') });
      continue;
    }
    const bullet = /^\s*[-*]\s+(.*)$/.exec(line);
    const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (bullet || numbered) {
      flushParagraph();
      const ordered = Boolean(numbered);
      if (!list || list.ordered !== ordered) {
        flushList();
        list = { ordered, items: [] };
      }
      list.items.push(parseInlines((bullet ?? numbered)![1] ?? ''));
      continue;
    }
    if (line.trim() === '') {
      flushParagraph();
      flushList();
      continue;
    }
    flushList();
    paragraph.push(line.trim());
  }
  if (code !== undefined) blocks.push({ kind: 'code', text: code.join('\n') });
  flushParagraph();
  flushList();
  return blocks;
}
