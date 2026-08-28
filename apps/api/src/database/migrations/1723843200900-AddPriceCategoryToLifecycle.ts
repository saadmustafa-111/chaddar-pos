import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds the `price_category_id` FK column to coils, cutting_batches and
 * finished_chaddar_stock, plus a simple per-table index.
 *
 * Designed to be safe for:
 *   - a database that has *partially* executed an earlier version of this
 *     migration (column may exist, index may not);
 *   - a fresh database running all migrations from zero (the dependent
 *     tables cutting_batches / finished_chaddar_stock may not yet exist
 *     when we start, or may exist if earlier migrations already ran).
 *
 * Notes
 * -----
 *  - `is_active` lives on `price_categories`, NOT on `coils`. The earlier
 *    `idx_coils_price_category_id_active (price_category_id, is_active)`
 *    index was the root cause of the failure and is intentionally not
 *    recreated here.
 *  - SQLite `ALTER TABLE` does not support `ADD CONSTRAINT FOREIGN KEY`,
 *    so the FK is *not* added at the database level. The TypeORM
 *    `@ManyToOne` relations on Coil / CuttingBatch / FinishedChaddarStock
 *    preserve referential integrity at the application layer, matching
 *    how the existing tables (e.g. `material_family_id`) are wired in this
 *    project. Adding a DB-level FK would require a full table rebuild and
 *    is out of scope for this fix.
 *  - `down()` is best-effort and only reverses what `up()` added; the
 *    removed `idx_coils_price_category_id_active` index is dropped in
 *    `down()` too in case a previous run partially created it.
 */
export class AddPriceCategoryToLifecycle1723843200900 implements MigrationInterface {
  name = 'AddPriceCategoryToLifecycle1723843200900';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.addColumnIfMissing(queryRunner, 'coils', 'price_category_id');
    await this.addColumnIfMissing(
      queryRunner,
      'cutting_batches',
      'price_category_id',
    );
    await this.addColumnIfMissing(
      queryRunner,
      'finished_chaddar_stock',
      'price_category_id',
    );

    await this.createIndexIfMissing(
      queryRunner,
      'coils',
      'idx_coils_price_category_id',
      ['price_category_id'],
    );
    await this.createIndexIfMissing(
      queryRunner,
      'cutting_batches',
      'idx_cutting_batches_price_category_id',
      ['price_category_id'],
    );
    await this.createIndexIfMissing(
      queryRunner,
      'finished_chaddar_stock',
      'idx_finished_stock_price_category_id',
      ['price_category_id'],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await this.dropIndexIfExists(
      queryRunner,
      'finished_chaddar_stock',
      'idx_finished_stock_price_category_id',
    );
    await this.dropColumnIfExists(
      queryRunner,
      'finished_chaddar_stock',
      'price_category_id',
    );

    await this.dropIndexIfExists(
      queryRunner,
      'cutting_batches',
      'idx_cutting_batches_price_category_id',
    );
    await this.dropColumnIfExists(
      queryRunner,
      'cutting_batches',
      'price_category_id',
    );

    await this.dropIndexIfExists(
      queryRunner,
      'coils',
      'idx_coils_price_category_id_active',
    );
    await this.dropIndexIfExists(
      queryRunner,
      'coils',
      'idx_coils_price_category_id',
    );
    await this.dropColumnIfExists(queryRunner, 'coils', 'price_category_id');
  }

  private async tableExists(
    queryRunner: QueryRunner,
    tableName: string,
  ): Promise<boolean> {
    const result = (await queryRunner.query(
      `SELECT 1 AS present FROM sqlite_master WHERE type = 'table' AND name = ?`,
      [tableName],
    )) as Array<{ present: number }>;
    return result.length > 0;
  }

  private async columnExists(
    queryRunner: QueryRunner,
    tableName: string,
    columnName: string,
  ): Promise<boolean> {
    const cols = (await queryRunner.query(
      `PRAGMA table_info(${this.quoteIdent(tableName)})`,
    )) as Array<{ name: string }>;
    return cols.some((c) => c.name === columnName);
  }

  private async indexExists(
    queryRunner: QueryRunner,
    tableName: string,
    indexName: string,
  ): Promise<boolean> {
    const indexes = (await queryRunner.query(
      `PRAGMA index_list(${this.quoteIdent(tableName)})`,
    )) as Array<{ name: string }>;
    return indexes.some((i) => i.name === indexName);
  }

  private async addColumnIfMissing(
    queryRunner: QueryRunner,
    tableName: string,
    columnName: string,
  ): Promise<void> {
    if (!(await this.tableExists(queryRunner, tableName))) {
      return;
    }
    if (await this.columnExists(queryRunner, tableName, columnName)) {
      return;
    }
    await queryRunner.query(
      `ALTER TABLE ${this.quoteIdent(tableName)} ADD COLUMN ${this.quoteIdent(columnName)} integer`,
    );
  }

  private async createIndexIfMissing(
    queryRunner: QueryRunner,
    tableName: string,
    indexName: string,
    columns: string[],
  ): Promise<void> {
    if (!(await this.tableExists(queryRunner, tableName))) {
      return;
    }
    if (await this.indexExists(queryRunner, tableName, indexName)) {
      return;
    }
    const cols = columns.map((c) => this.quoteIdent(c)).join(', ');
    await queryRunner.query(
      `CREATE INDEX ${this.quoteIdent(indexName)} ON ${this.quoteIdent(tableName)} (${cols})`,
    );
  }

  private async dropIndexIfExists(
    queryRunner: QueryRunner,
    tableName: string,
    indexName: string,
  ): Promise<void> {
    if (!(await this.tableExists(queryRunner, tableName))) {
      return;
    }
    if (!(await this.indexExists(queryRunner, tableName, indexName))) {
      return;
    }
    await queryRunner.query(`DROP INDEX ${this.quoteIdent(indexName)}`);
  }

  private async dropColumnIfExists(
    queryRunner: QueryRunner,
    tableName: string,
    columnName: string,
  ): Promise<void> {
    if (!(await this.tableExists(queryRunner, tableName))) {
      return;
    }
    if (!(await this.columnExists(queryRunner, tableName, columnName))) {
      return;
    }
    await queryRunner.query(
      `ALTER TABLE ${this.quoteIdent(tableName)} DROP COLUMN ${this.quoteIdent(columnName)}`,
    );
  }

  private quoteIdent(name: string): string {
    return `"${name.replace(/"/g, '""')}"`;
  }
}
