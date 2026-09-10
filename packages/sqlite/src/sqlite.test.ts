import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  CATALOG,
  appliedMigrations,
  execute,
  jsonParse,
  jsonStringify,
  loadMigrationsDir,
  migrate,
  nowIso,
  openDatabase,
  paginate,
  selectAll,
  selectOne,
  toSqlInput,
  transaction,
  type Migration,
} from './index';

const MIGRATIONS: Migration[] = [
  {
    name: '0001_init',
    sql: 'CREATE TABLE items (id INTEGER PRIMARY KEY, name TEXT NOT NULL, meta TEXT);',
  },
  { name: '0002_index', sql: 'CREATE INDEX idx_items_name ON items (name);' },
];

const fixedClock = () => new Date('2026-09-09T12:00:00Z');

function tableExists(db: ReturnType<typeof openDatabase>, name: string): boolean {
  const row = db.prepare("SELECT count(*) AS n FROM sqlite_master WHERE type = 'table' AND name = ?").get(name);
  return Number(row?.['n']) === 1;
}

describe('migrate', () => {
  it('aplica una vez y es idempotente', () => {
    const db = openDatabase(':memory:');
    expect(migrate(db, MIGRATIONS).applied).toEqual(['0001_init', '0002_index']);
    expect(migrate(db, MIGRATIONS).applied).toEqual([]);
    expect(appliedMigrations(db).map((m) => m.name)).toEqual(['0001_init', '0002_index']);
    expect(tableExists(db, 'items')).toBe(true);
  });

  it('aplica sólo las migraciones nuevas y respeta el orden recibido', () => {
    const db = openDatabase(':memory:');
    migrate(db, MIGRATIONS);
    const next: Migration = { name: '0003_qty', sql: 'ALTER TABLE items ADD COLUMN qty INTEGER NOT NULL DEFAULT 0;' };
    expect(migrate(db, [...MIGRATIONS, next]).applied).toEqual(['0003_qty']);
    execute(db, 'INSERT INTO items (name, qty) VALUES (?, ?)', ['a', 2]);
    expect(selectOne(db, 'SELECT qty FROM items')?.['qty']).toBe(2);
  });

  it('una migración fallida no deja efectos parciales ni queda registrada', () => {
    const db = openDatabase(':memory:');
    const bad: Migration = {
      name: '0001_bad',
      sql: 'CREATE TABLE a (id INTEGER); CREATE TABLE a (id INTEGER);',
    };
    expect(() => migrate(db, [bad])).toThrow(/0001_bad/);
    expect(tableExists(db, 'a')).toBe(false);
    expect(appliedMigrations(db)).toEqual([]);
    expect(db.isTransaction).toBe(false);
    // La base sigue utilizable y las migraciones válidas se aplican después.
    expect(migrate(db, MIGRATIONS).applied).toEqual(['0001_init', '0002_index']);
  });

  it('rechaza nombres duplicados o inválidos sin tocar la base', () => {
    const db = openDatabase(':memory:');
    expect(() => migrate(db, [MIGRATIONS[0]!, MIGRATIONS[0]!])).toThrow(/Duplicate/);
    expect(() => migrate(db, [{ name: 'con espacios', sql: 'SELECT 1;' }])).toThrow(/Invalid/);
    expect(tableExists(db, 'items')).toBe(false);
  });

  it('registra applied_at con el reloj inyectado', () => {
    const db = openDatabase(':memory:');
    migrate(db, MIGRATIONS, { clock: fixedClock });
    expect(appliedMigrations(db)[0]).toEqual({ name: '0001_init', appliedAt: '2026-09-09T12:00:00.000Z' });
  });
});

describe('transaction', () => {
  it('confirma y devuelve el valor de la función', () => {
    const db = openDatabase(':memory:');
    migrate(db, MIGRATIONS);
    const id = transaction(db, () => execute(db, "INSERT INTO items (name) VALUES ('a')").lastInsertRowid);
    expect(Number(id)).toBe(1);
    expect(db.isTransaction).toBe(false);
    expect(selectAll(db, 'SELECT name FROM items')).toEqual([{ name: 'a' }]);
  });

  it('revierte todo si la función lanza y deja la base utilizable', () => {
    const db = openDatabase(':memory:');
    migrate(db, MIGRATIONS);
    expect(() =>
      transaction(db, () => {
        execute(db, "INSERT INTO items (name) VALUES ('a')");
        execute(db, "INSERT INTO items (name) VALUES ('b')");
        throw new Error('boom');
      }),
    ).toThrow('boom');
    expect(db.isTransaction).toBe(false);
    expect(selectAll(db, 'SELECT name FROM items')).toEqual([]);
    transaction(db, () => execute(db, "INSERT INTO items (name) VALUES ('c')"));
    expect(selectAll(db, 'SELECT name FROM items')).toEqual([{ name: 'c' }]);
  });

  it('anida con savepoints: el interior revierte sólo su parte', () => {
    const db = openDatabase(':memory:');
    migrate(db, MIGRATIONS);
    transaction(db, () => {
      execute(db, "INSERT INTO items (name) VALUES ('outer')");
      expect(() =>
        transaction(db, () => {
          execute(db, "INSERT INTO items (name) VALUES ('inner')");
          throw new Error('inner fails');
        }),
      ).toThrow('inner fails');
      expect(db.isTransaction).toBe(true);
      const kept = transaction(db, () => {
        execute(db, "INSERT INTO items (name) VALUES ('inner-ok')");
        return 'kept';
      });
      expect(kept).toBe('kept');
    });
    expect(selectAll(db, 'SELECT name FROM items ORDER BY id').map((r) => r['name'])).toEqual(['outer', 'inner-ok']);
  });
});

describe('paginate', () => {
  function seeded(count: number) {
    const db = openDatabase(':memory:');
    migrate(db, MIGRATIONS);
    transaction(db, () => {
      for (let i = 1; i <= count; i += 1) {
        execute(db, 'INSERT INTO items (name, meta) VALUES (?, ?)', [`item-${String(i).padStart(2, '0')}`, { i }]);
      }
    });
    return db;
  }

  it('devuelve items, total y páginas', () => {
    const db = seeded(23);
    const base = {
      sql: 'SELECT id, name FROM items ORDER BY id',
      countSql: 'SELECT count(*) FROM items',
      params: [],
      pageSize: 10,
    };
    const first = paginate(db, { ...base, page: 1 });
    expect(first.items).toHaveLength(10);
    expect(first).toMatchObject({ total: 23, page: 1, pageSize: 10, pages: 3 });
    expect(first.items[0]).toEqual({ id: 1, name: 'item-01' });
    const last = paginate(db, { ...base, page: 3 });
    expect(last.items.map((r) => r['id'])).toEqual([21, 22, 23]);
    expect(paginate(db, { ...base, page: 4 }).items).toEqual([]);
  });

  it('acepta parámetros, mapea filas y normaliza páginas fuera de rango', () => {
    const db = seeded(5);
    const result = paginate(db, {
      sql: 'SELECT name, meta FROM items WHERE name > ? ORDER BY name;',
      countSql: 'SELECT count(*) AS total FROM items WHERE name > ?',
      params: ['item-02'],
      page: 0,
      pageSize: 2,
      map: (row) => ({ name: String(row['name']), i: jsonParse<{ i: number }>(row['meta'])?.i }),
    });
    expect(result).toEqual({
      items: [
        { name: 'item-03', i: 3 },
        { name: 'item-04', i: 4 },
      ],
      total: 3,
      page: 1,
      pageSize: 2,
      pages: 2,
    });
  });

  it('sin filas devuelve total y páginas en cero', () => {
    const db = seeded(0);
    const empty = paginate(db, { sql: 'SELECT * FROM items', countSql: 'SELECT count(*) FROM items', params: [], page: 1, pageSize: 10 });
    expect(empty).toEqual({ items: [], total: 0, page: 1, pageSize: 10, pages: 0 });
  });
});

describe('loadMigrationsDir', () => {
  let dir = '';
  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
    dir = '';
  });

  it('lee sólo los *.sql del directorio ordenados por nombre', () => {
    dir = mkdtempSync(join(tmpdir(), 'psp-sqlite-'));
    writeFileSync(join(dir, '0002_index.sql'), MIGRATIONS[1]!.sql);
    writeFileSync(join(dir, '0001_init.sql'), MIGRATIONS[0]!.sql);
    writeFileSync(join(dir, '0010_late.sql'), 'CREATE TABLE late (id INTEGER PRIMARY KEY);');
    writeFileSync(join(dir, 'README.md'), '# no es migración');
    writeFileSync(join(dir, 'notes.txt'), 'CREATE TABLE nope (id INTEGER);');
    mkdirSync(join(dir, 'sub'));
    writeFileSync(join(dir, 'sub', '0000_nested.sql'), 'CREATE TABLE nested (id INTEGER);');

    const loaded = loadMigrationsDir(dir);
    expect(loaded.map((m) => m.name)).toEqual(['0001_init', '0002_index', '0010_late']);
    expect(loaded[0]?.sql).toBe(MIGRATIONS[0]!.sql);

    const db = openDatabase(':memory:');
    expect(migrate(db, loaded).applied).toEqual(['0001_init', '0002_index', '0010_late']);
    expect(tableExists(db, 'late')).toBe(true);
    expect(tableExists(db, 'nested')).toBe(false);
  });

  it('un directorio inexistente lanza', () => {
    expect(() => loadMigrationsDir(join(tmpdir(), 'psp-sqlite-no-existe-' + process.pid))).toThrow();
  });
});

describe('openDatabase', () => {
  let dir = '';
  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
    dir = '';
  });

  it('crea el directorio padre y activa WAL y claves foráneas en disco', () => {
    dir = mkdtempSync(join(tmpdir(), 'psp-sqlite-'));
    const path = join(dir, 'nested', 'deep', 'station.sqlite');
    expect(existsSync(dirname(path))).toBe(false);
    const db = openDatabase(path);
    expect(existsSync(path)).toBe(true);
    expect(db.prepare('PRAGMA journal_mode').get()?.['journal_mode']).toBe('wal');
    expect(db.prepare('PRAGMA foreign_keys').get()?.['foreign_keys']).toBe(1);
    db.close();

    const noWal = openDatabase(join(dir, 'plain.sqlite'), { wal: false });
    expect(noWal.prepare('PRAGMA journal_mode').get()?.['journal_mode']).toBe('delete');
    noWal.close();
  });

  it('en memoria no usa WAL pero sí claves foráneas', () => {
    const db = openDatabase(':memory:');
    expect(db.prepare('PRAGMA journal_mode').get()?.['journal_mode']).toBe('memory');
    expect(db.prepare('PRAGMA foreign_keys').get()?.['foreign_keys']).toBe(1);
    db.exec('CREATE TABLE parent (id INTEGER PRIMARY KEY); CREATE TABLE child (id INTEGER PRIMARY KEY, parent_id INTEGER NOT NULL REFERENCES parent(id));');
    expect(() => execute(db, 'INSERT INTO child (parent_id) VALUES (?)', [99])).toThrow(/FOREIGN KEY/);
  });
});

describe('utilidades', () => {
  it('jsonParse y jsonStringify hacen ida y vuelta y toleran valores nulos o inválidos', () => {
    const value = { a: 1, b: ['x', null], c: { d: true } };
    expect(jsonParse(jsonStringify(value))).toEqual(value);
    expect(jsonParse(null)).toBeUndefined();
    expect(jsonParse(undefined)).toBeUndefined();
    expect(jsonParse(42)).toBeUndefined();
    expect(jsonParse('{no es json')).toBeUndefined();
    expect(jsonStringify(undefined)).toBe('null');
  });

  it('nowIso usa el reloj inyectado o el actual', () => {
    expect(nowIso(fixedClock)).toBe('2026-09-09T12:00:00.000Z');
    expect(nowIso()).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it('toSqlInput convierte los tipos de JS a valores de SQLite', () => {
    expect(toSqlInput(true)).toBe(1);
    expect(toSqlInput(false)).toBe(0);
    expect(toSqlInput(undefined)).toBeNull();
    expect(toSqlInput(null)).toBeNull();
    expect(toSqlInput(fixedClock())).toBe('2026-09-09T12:00:00.000Z');
    expect(toSqlInput({ a: 1 })).toBe('{"a":1}');
    expect(toSqlInput([1, 2])).toBe('[1,2]');
    expect(toSqlInput('s')).toBe('s');
    expect(toSqlInput(7)).toBe(7);
    const bytes = new Uint8Array([1, 2, 3]);
    expect(toSqlInput(bytes)).toBe(bytes);
    expect(() => toSqlInput(() => 1)).toThrow(TypeError);
  });

  it('selectAll y selectOne mapean filas y aceptan parámetros de JS', () => {
    const db = openDatabase(':memory:');
    migrate(db, MIGRATIONS);
    execute(db, 'INSERT INTO items (name, meta) VALUES (?, ?)', ['a', { active: true }]);
    execute(db, 'INSERT INTO items (name, meta) VALUES (?, ?)', ['b', null]);
    const names = selectAll(db, 'SELECT name FROM items ORDER BY name', [], (r) => String(r['name']));
    expect(names).toEqual(['a', 'b']);
    expect(selectOne(db, 'SELECT meta FROM items WHERE name = ?', ['a'])?.['meta']).toBe('{"active":true}');
    expect(selectOne(db, 'SELECT meta FROM items WHERE name = ?', ['zzz'])).toBeUndefined();
  });
});

describe('CATALOG', () => {
  it('registra el paquete', () => {
    expect(CATALOG).toHaveLength(1);
    expect(CATALOG[0]).toMatchObject({ kind: 'package', key: '@psp/sqlite', package: '@psp/sqlite' });
  });
});
