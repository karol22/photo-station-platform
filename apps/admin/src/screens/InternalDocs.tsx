/** Documentación interna: lista y editor con vista previa Markdown (`lib/markdown.ts`). */
import { createElement as h, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Alert, Button, DataTable, Drawer, Field, Input, PageHeader, Textarea } from '@psp/ui';
import type { InternalDocument } from '@psp/contracts';
import { errorMessage } from '../api/client';
import { api } from '../api/resources';
import { createTranslator } from '../i18n/extra';
import { hasAnyPermission } from '../lib/navFilter';
import { type InlineNode, type MarkdownBlock, parseMarkdown } from '../lib/markdown';
import { usePrefsStore } from '../store/prefs';
import { useSessionStore } from '../store/session';

function renderInline(nodes: InlineNode[]): ReactNode[] {
  return nodes.map((node, i) => {
    if (node.kind === 'bold') return h('strong', { key: i }, node.text);
    if (node.kind === 'italic') return h('em', { key: i }, node.text);
    if (node.kind === 'code') return h('code', { key: i }, node.text);
    return node.text;
  });
}

function renderMarkdown(blocks: MarkdownBlock[]): ReactNode {
  return blocks.map((block, i) => {
    if (block.kind === 'heading') return h(`h${block.level + 2}`, { key: i }, renderInline(block.inlines));
    if (block.kind === 'paragraph') return h('p', { key: i }, renderInline(block.inlines));
    if (block.kind === 'code') return h('pre', { key: i }, h('code', null, block.text));
    return h(
      block.ordered ? 'ol' : 'ul',
      { key: i },
      block.items.map((item, j) => h('li', { key: j }, renderInline(item))),
    );
  });
}

export function InternalDocs() {
  const principal = useSessionStore((s) => s.principal);
  const locale = usePrefsStore((s) => s.locale);
  const tr = useMemo(() => createTranslator(locale), [locale]);
  const canEdit = hasAnyPermission(principal, ['docs.manage']);
  const [rows, setRows] = useState<InternalDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [editing, setEditing] = useState<InternalDocument | 'new' | undefined>();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    api.internalDocuments
      .list({ page: 1, pageSize: 100 })
      .then((res) => {
        setRows(res.items);
        setLoading(false);
      })
      .catch((err: unknown) => {
        setError(errorMessage(err));
        setLoading(false);
      });
  }, [reload]);

  useEffect(() => {
    if (editing && editing !== 'new') {
      setTitle(editing.title.es);
      setBody(editing.body);
    } else {
      setTitle('');
      setBody('');
    }
  }, [editing]);

  async function handleSave() {
    try {
      if (editing === 'new') {
        await api.internalDocuments.create({ title: { es: title }, body, attachedTo: { type: 'general' } });
      } else if (editing) {
        await api.internalDocuments.update(editing.id, { title: { es: title }, body });
      }
      setEditing(undefined);
      setReload((n) => n + 1);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <>
      <PageHeader title={tr.t('admin.nav.docs')} actions={canEdit ? <Button variant="primary" onClick={() => setEditing('new')}>{tr.t('admin.action.create')}</Button> : undefined} />
      {error !== undefined ? <Alert tone="danger">{error}</Alert> : null}
      <DataTable
        columns={[
          { key: 'title', header: tr.t('admin.field.title'), render: (r) => tr.tl(r.title) },
          { key: 'attachedTo', header: tr.t('admin.field.attachedType'), render: (r) => r.attachedTo.type },
        ]}
        rows={rows}
        rowKey="id"
        loading={loading}
        empty={{ title: tr.t('admin.common.vacio') }}
        onRowClick={canEdit ? setEditing : undefined}
      />
      {editing !== undefined ? (
        <Drawer
          open
          title={tr.t(editing === 'new' ? 'admin.action.create' : 'admin.action.edit')}
          onClose={() => setEditing(undefined)}
          actions={
            <>
              <Button variant="secondary" onClick={() => setEditing(undefined)}>
                {tr.t('admin.action.cancel')}
              </Button>
              <Button variant="primary" onClick={() => void handleSave()}>
                {tr.t('admin.action.save')}
              </Button>
            </>
          }
        >
          <Field label={tr.t('admin.field.title')}>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} block />
          </Field>
          <Field label={tr.t('admin.field.body')}>
            <Textarea rows={10} value={body} onChange={(e) => setBody(e.target.value)} />
          </Field>
          <h4>{tr.t('admin.action.preview')}</h4>
          <div>{renderMarkdown(parseMarkdown(body))}</div>
        </Drawer>
      ) : null}
    </>
  );
}
