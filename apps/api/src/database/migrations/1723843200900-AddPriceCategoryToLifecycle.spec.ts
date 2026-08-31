import { AddPriceCategoryToLifecycle1723843200900 } from './1723843200900-AddPriceCategoryToLifecycle';

interface FakeQueryRunner {
  query: jest.Mock;
}

interface FakeSchema {
  tables: Set<string>;
  columns: Map<string, Set<string>>; // key: table, value: set of column names
  indexes: Map<string, Set<string>>; // key: table, value: set of index names
}

function makeSchema(
  initial: { tables?: string[]; columns?: Record<string, string[]> } = {},
): FakeSchema {
  const schema: FakeSchema = {
    tables: new Set(initial.tables ?? []),
    columns: new Map(),
    indexes: new Map(),
  };
  for (const [k, v] of Object.entries(initial.columns ?? {})) {
    schema.columns.set(k, new Set(v));
  }
  return schema;
}

function makeRunner(schema: FakeSchema): FakeQueryRunner {
  const hasTable = (table: string) => schema.tables.has(table);
  const hasColumn = (table: string, column: string) =>
    schema.columns.get(table)?.has(column) ?? false;
  const hasIndex = (table: string, index: string) =>
    schema.indexes.get(table)?.has(index) ?? false;

  return {
    query: jest.fn().mockImplementation((sql: string, params?: unknown[]) => {
      const s = sql.replace(/\s+/g, ' ').trim().toLowerCase();

      const addCol = s.match(
        /^alter table "?([\w]+)"? add column "?([\w]+)"?/i,
      );
      if (addCol) {
        const t = addCol[1];
        const c = addCol[2];
        if (hasTable(t)) {
          if (hasColumn(t, c)) {
            throw new Error(`duplicate column: ${t}.${c}`);
          }
          const set = schema.columns.get(t) ?? new Set<string>();
          set.add(c);
          schema.columns.set(t, set);
        }
        return Promise.resolve([]);
      }

      const createIdx = s.match(/^create index "?([\w]+)"? on "?([\w]+)"?/i);
      if (createIdx) {
        const name = createIdx[1];
        const t = createIdx[2];
        if (hasTable(t)) {
          if (hasIndex(t, name)) {
            throw new Error(`index already exists: ${name}`);
          }
          const set = schema.indexes.get(t) ?? new Set<string>();
          set.add(name);
          schema.indexes.set(t, set);
        }
        return Promise.resolve([]);
      }

      const dropIdx = s.match(/^drop index "?([\w]+)"?/i);
      if (dropIdx) {
        const name = dropIdx[1];
        for (const set of schema.indexes.values()) {
          if (set.has(name)) {
            set.delete(name);
            return Promise.resolve([]);
          }
        }
        return Promise.resolve([]);
      }

      const dropCol = s.match(
        /^alter table "?([\w]+)"? drop column "?([\w]+)"?/i,
      );
      if (dropCol) {
        const t = dropCol[1];
        const c = dropCol[2];
        if (hasTable(t)) {
          schema.columns.get(t)?.delete(c);
        }
        return Promise.resolve([]);
      }

      const info = s.match(/^pragma table_info\("?([\w]+)"?\)/i);
      if (info) {
        const t = info[1];
        const cols = schema.columns.get(t);
        if (!cols) return Promise.resolve([]);
        return Promise.resolve(Array.from(cols).map((name) => ({ name })));
      }

      const list = s.match(/^pragma index_list\("?([\w]+)"?\)/i);
      if (list) {
        const t = list[1];
        const idxs = schema.indexes.get(t);
        if (!idxs) return Promise.resolve([]);
        return Promise.resolve(Array.from(idxs).map((name) => ({ name })));
      }

      const sel = s.match(
        /^select 1 as present from sqlite_master where type = 'table' and name = \?/i,
      );
      if (sel) {
        const param = params?.[0];
        const tableName = typeof param === 'string' ? param : '';
        if (hasTable(tableName)) return Promise.resolve([{ present: 1 }]);
        return Promise.resolve([]);
      }

      return Promise.resolve([]);
    }),
  };
}

describe('AddPriceCategoryToLifecycle migration', () => {
  it('should add columns and indexes on a fresh database with all tables present', async () => {
    const schema = makeSchema({
      tables: ['coils', 'cutting_batches', 'finished_chaddar_stock'],
      columns: {
        coils: ['id', 'code'],
        cutting_batches: ['id', 'code'],
        finished_chaddar_stock: ['id', 'code'],
      },
    });
    const runner = makeRunner(schema);
    const migration = new AddPriceCategoryToLifecycle1723843200900();
    await migration.up(runner as never);

    expect(schema.columns.get('coils')?.has('price_category_id')).toBe(true);
    expect(
      schema.columns.get('cutting_batches')?.has('price_category_id'),
    ).toBe(true);
    expect(
      schema.columns.get('finished_chaddar_stock')?.has('price_category_id'),
    ).toBe(true);
    expect(
      schema.indexes.get('coils')?.has('idx_coils_price_category_id'),
    ).toBe(true);
    expect(
      schema.indexes
        .get('cutting_batches')
        ?.has('idx_cutting_batches_price_category_id'),
    ).toBe(true);
    expect(
      schema.indexes
        .get('finished_chaddar_stock')
        ?.has('idx_finished_stock_price_category_id'),
    ).toBe(true);
    // The bad index must not be created.
    expect(
      schema.indexes.get('coils')?.has('idx_coils_price_category_id_active'),
    ).toBe(false);
  });

  it('should be a no-op when the columns and indexes already exist (idempotent re-run)', async () => {
    const schema = makeSchema({
      tables: ['coils', 'cutting_batches', 'finished_chaddar_stock'],
      columns: {
        coils: ['id', 'code', 'price_category_id'],
        cutting_batches: ['id', 'code', 'price_category_id'],
        finished_chaddar_stock: ['id', 'code', 'price_category_id'],
      },
    });
    const runner = makeRunner(schema);
    const migration = new AddPriceCategoryToLifecycle1723843200900();
    await expect(migration.up(runner as never)).resolves.toBeUndefined();
  });

  it('should add only the coils column/index when the other tables are missing', async () => {
    const schema = makeSchema({
      tables: ['coils'],
      columns: { coils: ['id', 'code'] },
    });
    const runner = makeRunner(schema);
    const migration = new AddPriceCategoryToLifecycle1723843200900();
    await migration.up(runner as never);
    expect(schema.columns.get('coils')?.has('price_category_id')).toBe(true);
    expect(
      schema.indexes.get('coils')?.has('idx_coils_price_category_id'),
    ).toBe(true);
    expect(schema.columns.get('cutting_batches')).toBeUndefined();
    expect(schema.columns.get('finished_chaddar_stock')).toBeUndefined();
  });

  it('should skip the column entirely when no relevant tables exist', async () => {
    const schema = makeSchema({ tables: [] });
    const runner = makeRunner(schema);
    const migration = new AddPriceCategoryToLifecycle1723843200900();
    await migration.up(runner as never);
    expect(schema.columns.size).toBe(0);
    expect(schema.indexes.size).toBe(0);
  });

  it('down() should clean up the added columns and indexes', async () => {
    const schema = makeSchema({
      tables: ['coils', 'cutting_batches', 'finished_chaddar_stock'],
      columns: {
        coils: ['id', 'code', 'price_category_id'],
        cutting_batches: ['id', 'code', 'price_category_id'],
        finished_chaddar_stock: ['id', 'code', 'price_category_id'],
      },
    });
    // Initialize indexes map with empty sets so we can assert absence.
    schema.indexes.set('coils', new Set());
    schema.indexes.set('cutting_batches', new Set());
    schema.indexes.set('finished_chaddar_stock', new Set());

    const runner = makeRunner(schema);
    const migration = new AddPriceCategoryToLifecycle1723843200900();
    await migration.down(runner as never);
    expect(schema.columns.get('coils')?.has('price_category_id')).toBe(false);
    expect(
      schema.columns.get('cutting_batches')?.has('price_category_id'),
    ).toBe(false);
    expect(
      schema.columns.get('finished_chaddar_stock')?.has('price_category_id'),
    ).toBe(false);
    expect(
      schema.indexes.get('coils')?.has('idx_coils_price_category_id'),
    ).toBe(false);
    expect(
      schema.indexes
        .get('finished_chaddar_stock')
        ?.has('idx_finished_stock_price_category_id'),
    ).toBe(false);
  });
});
