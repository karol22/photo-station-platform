# @psp/sqlite

## Propósito
Base de datos embebida para control-plane y station-agent (ADR-002): envoltura mínima de `node:sqlite` (`DatabaseSync`, sin dependencias nativas ni ORM). Abre bases con WAL y claves foráneas, aplica migraciones SQL numeradas de forma transaccional e idempotente, envuelve transacciones con savepoints anidados y ofrece utilidades de repositorio: JSON en columnas de texto, reloj inyectable y paginación con total. El SQL es explícito y legible.

## Cómo se usa

```ts
import { loadMigrationsDir, migrate, openDatabase, paginate, transaction } from '@psp/sqlite';

const db = openDatabase('var/control-plane/data.sqlite'); // crea el directorio, WAL, foreign_keys=ON
migrate(db, loadMigrationsDir(new URL('../migrations', import.meta.url).pathname)); // 0001_init.sql, 0002_x.sql, …

transaction(db, () => {
  db.prepare('INSERT INTO machines (id, name) VALUES (?, ?)').run('mch_1', 'Kiosco 1');
  // si algo lanza aquí, se revierte todo
});

const page = paginate(db, {
  sql: 'SELECT id, name FROM machines WHERE organization_id = ? ORDER BY name',
  countSql: 'SELECT count(*) FROM machines WHERE organization_id = ?',
  params: ['org_1'],
  page: 1,
  pageSize: 50,
  map: (row) => ({ id: String(row.id), name: String(row.name) }),
}); // { items, total, page, pageSize, pages }
```

Reglas:
- `openDatabase(path, { wal?, readOnly?, timeoutMs? })`: `:memory:` no usa WAL ni crea directorios. `busy_timeout` es 5 s por defecto.
- `migrate(db, migrations, { clock? })` crea `_migrations(name PRIMARY KEY, applied_at)` y aplica cada migración pendiente en su propia transacción: una migración fallida no deja efectos parciales ni se registra, y la llamada lanza con el nombre de la migración. Repetir la llamada no aplica nada. Los nombres deben ser únicos y sin espacios; el SQL no debe abrir transacciones propias. `appliedMigrations(db)` lista lo aplicado.
- `loadMigrationsDir(dir)` lee sólo `*.sql` del directorio (sin subdirectorios), ordenados por nombre con comparación por unidades de código; el nombre de la migración es el archivo sin extensión. Convención: `NNNN_nombre.sql` con número de cuatro dígitos para que el orden lexicográfico sea el cronológico.
- `transaction(db, fn)` usa `BEGIN IMMEDIATE`; anidada, usa `SAVEPOINT`, así una transacción interior que falla revierte sólo su parte. `fn` es síncrona.
- `jsonParse` devuelve `undefined` ante nulos o JSON inválido; `jsonStringify(undefined)` guarda `null`.
- `nowIso(clock?)` produce ISO 8601 en UTC; el reloj se inyecta para que el dominio sea determinista.
- `paginate` agrega `LIMIT ? OFFSET ?` a `sql` (no debe traerlos) y ejecuta `countSql` con los mismos parámetros; `page` menor que 1 se normaliza a 1.
- `selectAll`, `selectOne` y `execute` aceptan parámetros de JS y los convierten con `toSqlInput`: booleanos a 0/1, `Date` a ISO, objetos y arreglos a JSON, `undefined` a `NULL`.
- `CATALOG` registra el paquete para `pnpm catalog` con la misma forma que `CatalogEntry` (el paquete no depende de `@psp/contracts`).

## Cómo se prueba

```bash
pnpm --filter @psp/sqlite typecheck
pnpm --filter @psp/sqlite test
```

`src/sqlite.test.ts` usa bases en memoria salvo donde el comportamiento es de disco: migración idempotente y fallida sin efectos parciales, transacción con rollback y savepoints anidados, paginación con total y páginas, lectura de un directorio temporal de migraciones (`node:fs`, `node:os`) ignorando archivos que no son `.sql`, creación del directorio padre con WAL y claves foráneas activas, y las utilidades de JSON, reloj y conversión de parámetros.
