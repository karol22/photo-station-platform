/**
 * Almacén local sobre `@psp/sqlite`. Cada entidad se guarda como JSON con columnas de consulta;
 * las fotografías viven en disco y aquí sólo hay rutas y URLs locales.
 */
import { fileURLToPath } from 'node:url';
import type {
  FleetEvent,
  MachineEvent,
  PaymentIntent,
  PrintJob,
  SessionStage,
  StationSession,
} from '@psp/contracts';
import { TERMINAL_STAGES, TestResult as TestResultSchema } from '@psp/contracts';
import type { z } from 'zod';
import {
  execute,
  jsonParse,
  jsonStringify,
  loadMigrationsDir,
  migrate,
  openDatabase,
  selectAll,
  selectOne,
  transaction,
  type DatabaseSync,
  type Row,
} from '@psp/sqlite';

export type TestResult = z.infer<typeof TestResultSchema>;

export interface OutboxRow {
  id: string;
  type: string;
  sequence: number;
  event: FleetEvent;
  createdAt: string;
  deliveredAt?: string;
}

export interface InboxRow {
  id: string;
  receivedAt: string;
  executedAt?: string;
  result?: string;
}

export const MIGRATIONS_DIR = fileURLToPath(new URL('../../migrations', import.meta.url));

const json = <T>(row: Row | undefined): T | undefined =>
  row ? jsonParse<T>(row['json']) : undefined;

export class Store {
  readonly db: DatabaseSync;

  constructor(path: string) {
    this.db = openDatabase(path);
    migrate(this.db, loadMigrationsDir(MIGRATIONS_DIR));
  }

  close(): void {
    this.db.close();
  }

  transaction<T>(fn: () => T): T {
    return transaction(this.db, fn);
  }

  /* ---------- kv ---------- */

  getKv<T>(key: string): T | undefined {
    const row = selectOne(this.db, 'SELECT value FROM kv WHERE key = ?', [key]);
    return row ? jsonParse<T>(row['value']) : undefined;
  }

  setKv(key: string, value: unknown, now: string): void {
    execute(
      this.db,
      'INSERT INTO kv (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at',
      [key, jsonStringify(value), now],
    );
  }

  deleteKv(key: string): void {
    execute(this.db, 'DELETE FROM kv WHERE key = ?', [key]);
  }

  /* ---------- sessions ---------- */

  saveSession(session: StationSession): void {
    execute(
      this.db,
      `INSERT INTO sessions (id, json, stage, started_at, updated_at, ended_at, delete_at, deleted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET json = excluded.json, stage = excluded.stage, updated_at = excluded.updated_at,
         ended_at = excluded.ended_at, delete_at = excluded.delete_at, deleted_at = excluded.deleted_at`,
      [
        session.id,
        jsonStringify(session),
        session.stage,
        session.startedAt,
        session.updatedAt,
        session.endedAt ?? null,
        session.retention.deleteAt ?? null,
        session.retention.deletedAt ?? null,
      ],
    );
  }

  getSession(id: string): StationSession | undefined {
    return json<StationSession>(selectOne(this.db, 'SELECT json FROM sessions WHERE id = ?', [id]));
  }

  /** Sesiones en etapas no terminales (a lo sumo una en operación normal). */
  openSessions(): StationSession[] {
    const placeholders = TERMINAL_STAGES.map(() => '?').join(', ');
    return selectAll(
      this.db,
      `SELECT json FROM sessions WHERE stage NOT IN (${placeholders}) ORDER BY started_at`,
      TERMINAL_STAGES,
      (row) => jsonParse<StationSession>(row['json']),
    ).filter((session): session is StationSession => session !== undefined);
  }

  recentSessions(limit: number): StationSession[] {
    return selectAll(
      this.db,
      'SELECT json FROM sessions ORDER BY started_at DESC LIMIT ?',
      [limit],
      (row) => jsonParse<StationSession>(row['json']),
    ).filter((session): session is StationSession => session !== undefined);
  }

  /** Sesiones cuyo plazo de retención venció y aún tienen archivos. */
  sessionsDueForDeletion(now: string): StationSession[] {
    return selectAll(
      this.db,
      'SELECT json FROM sessions WHERE deleted_at IS NULL AND delete_at IS NOT NULL AND delete_at <= ? ORDER BY delete_at',
      [now],
      (row) => jsonParse<StationSession>(row['json']),
    ).filter((session): session is StationSession => session !== undefined);
  }

  sessionsByStage(stages: SessionStage[]): StationSession[] {
    if (stages.length === 0) return [];
    const placeholders = stages.map(() => '?').join(', ');
    return selectAll(
      this.db,
      `SELECT json FROM sessions WHERE stage IN (${placeholders})`,
      stages,
      (row) => jsonParse<StationSession>(row['json']),
    ).filter((session): session is StationSession => session !== undefined);
  }

  /* ---------- print jobs ---------- */

  savePrintJob(job: PrintJob): void {
    execute(
      this.db,
      `INSERT INTO print_jobs (id, session_id, idempotency_key, status, json, created_at) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET status = excluded.status, json = excluded.json`,
      [
        job.id,
        job.sessionId ?? null,
        job.idempotencyKey,
        job.status,
        jsonStringify(job),
        job.createdAt,
      ],
    );
  }

  getPrintJob(id: string): PrintJob | undefined {
    return json<PrintJob>(selectOne(this.db, 'SELECT json FROM print_jobs WHERE id = ?', [id]));
  }

  printJobByKey(sessionId: string | undefined, key: string): PrintJob | undefined {
    return json<PrintJob>(
      selectOne(
        this.db,
        'SELECT json FROM print_jobs WHERE session_id IS ? AND idempotency_key = ?',
        [sessionId ?? null, key],
      ),
    );
  }

  /* ---------- payment intents ---------- */

  savePaymentIntent(intent: PaymentIntent): void {
    execute(
      this.db,
      `INSERT INTO payment_intents (id, session_id, state, json, updated_at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET state = excluded.state, json = excluded.json, updated_at = excluded.updated_at`,
      [intent.id, intent.sessionId, intent.state, jsonStringify(intent), intent.updatedAt],
    );
  }

  getPaymentIntent(id: string): PaymentIntent | undefined {
    return json<PaymentIntent>(
      selectOne(this.db, 'SELECT json FROM payment_intents WHERE id = ?', [id]),
    );
  }

  /* ---------- outbox ---------- */

  nextSequence(): number {
    const row = selectOne(this.db, 'SELECT COALESCE(MAX(sequence), 0) AS seq FROM outbox');
    return Number(row?.['seq'] ?? 0) + 1;
  }

  enqueue(event: FleetEvent, createdAt: string): void {
    execute(
      this.db,
      'INSERT INTO outbox (id, type, sequence, json, created_at) VALUES (?, ?, ?, ?, ?)',
      [event.id, event.type, event.sequence, jsonStringify(event), createdAt],
    );
  }

  pendingOutbox(limit: number): OutboxRow[] {
    return selectAll(
      this.db,
      'SELECT * FROM outbox WHERE delivered_at IS NULL ORDER BY sequence LIMIT ?',
      [limit],
      (row) => ({
        id: String(row['id']),
        type: String(row['type']),
        sequence: Number(row['sequence']),
        event: jsonParse<FleetEvent>(row['json']) as FleetEvent,
        createdAt: String(row['created_at']),
      }),
    );
  }

  outboxSummary(): { pending: number; oldestAt?: string } {
    const row = selectOne(
      this.db,
      'SELECT COUNT(*) AS n, MIN(created_at) AS oldest FROM outbox WHERE delivered_at IS NULL',
    );
    const oldest = row?.['oldest'];
    return {
      pending: Number(row?.['n'] ?? 0),
      ...(typeof oldest === 'string' ? { oldestAt: oldest } : {}),
    };
  }

  markDelivered(ids: string[], at: string): void {
    if (ids.length === 0) return;
    const placeholders = ids.map(() => '?').join(', ');
    execute(this.db, `UPDATE outbox SET delivered_at = ? WHERE id IN (${placeholders})`, [
      at,
      ...ids,
    ]);
  }

  outboxByType(type: string): FleetEvent[] {
    return selectAll(
      this.db,
      'SELECT json FROM outbox WHERE type = ? ORDER BY sequence',
      [type],
      (row) => jsonParse<FleetEvent>(row['json']),
    ).filter((event): event is FleetEvent => event !== undefined);
  }

  /* ---------- machine events ---------- */

  saveEvent(event: MachineEvent): void {
    execute(this.db, 'INSERT OR REPLACE INTO events (id, type, at, json) VALUES (?, ?, ?, ?)', [
      event.id,
      event.type,
      event.at,
      jsonStringify(event),
    ]);
  }

  recentEvents(limit: number): MachineEvent[] {
    return selectAll(this.db, 'SELECT json FROM events ORDER BY at DESC LIMIT ?', [limit], (row) =>
      jsonParse<MachineEvent>(row['json']),
    ).filter((event): event is MachineEvent => event !== undefined);
  }

  /* ---------- tests ---------- */

  saveTest(result: TestResult): void {
    execute(this.db, 'INSERT INTO tests (kind, at, json) VALUES (?, ?, ?)', [
      result.kind,
      result.at,
      jsonStringify(result),
    ]);
  }

  recentTests(limit: number): TestResult[] {
    return selectAll(this.db, 'SELECT json FROM tests ORDER BY seq DESC LIMIT ?', [limit], (row) =>
      jsonParse<TestResult>(row['json']),
    ).filter((result): result is TestResult => result !== undefined);
  }

  /* ---------- inbox de comandos ---------- */

  inboxHas(id: string): boolean {
    return selectOne(this.db, 'SELECT id FROM inbox WHERE id = ?', [id]) !== undefined;
  }

  inboxReceive(id: string, command: unknown, at: string): void {
    execute(this.db, 'INSERT OR IGNORE INTO inbox (id, json, received_at) VALUES (?, ?, ?)', [
      id,
      jsonStringify(command),
      at,
    ]);
  }

  inboxExecuted(id: string, at: string, result: string): void {
    execute(this.db, 'UPDATE inbox SET executed_at = ?, result = ? WHERE id = ?', [at, result, id]);
  }
}
