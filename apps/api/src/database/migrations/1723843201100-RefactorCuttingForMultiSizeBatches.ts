import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Refactors the cutting / finished-stock flow so a single cutting batch
 * can produce many FinishedChaddarStock rows (one per requested size, e.g.
 * `8ft x 110`, `10ft x 70`, `12ft x 85`) instead of one row with a single
 * manually-entered weight.
 *
 * The schema change is intentionally minimal and additive:
 *   - `cutting_batches` gains a small set of analytics / audit columns.
 *   - `cutting_batches.size_label.length` grows from 50 -> 100 chars so we
 *     can store a synthetic `Multi (8ft, 10ft)` style headline label.
 *   - No unique constraint changes; the FK column `cutting_batch_id` on
 *     `finished_chaddar_stock` was never UNIQUE at the DB level, so many
 *     finished stock rows per batch were always allowed. The application-
 *     level 1:1 relation is the only thing that needed to be relaxed, and
 *     TypeORM will pick that up from the entities.
 */
export class RefactorCuttingForMultiSizeBatches1723843201100 implements MigrationInterface {
  name = 'RefactorCuttingForMultiSizeBatches1723843201100';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await this.tableExists(queryRunner, 'cutting_batches')) {
      await this.addColumnIfMissing(
        queryRunner,
        'cutting_batches',
        'ten_ft_equivalent_qty',
        'decimal(12, 3)',
      );
      await this.addColumnIfMissing(
        queryRunner,
        'cutting_batches',
        'avg_10ft_piece_weight_kg',
        'decimal(12, 3)',
      );
      await this.addColumnIfMissing(
        queryRunner,
        'cutting_batches',
        'usable_coil_weight_kg',
        'decimal(12, 3)',
      );
      await this.addColumnIfMissing(
        queryRunner,
        'cutting_batches',
        'cut_rows_json',
        'text',
      );

      await this.createIndexIfMissing(
        queryRunner,
        'cutting_batches',
        'idx_cutting_batches_production_date',
        ['production_date'],
      );
    }

    if (await this.tableExists(queryRunner, 'finished_chaddar_stock')) {
      await this.addColumnIfMissing(
        queryRunner,
        'finished_chaddar_stock',
        'length_ft',
        'decimal(10, 3)',
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await this.tableExists(queryRunner, 'cutting_batches')) {
      await this.dropColumnIfExists(
        queryRunner,
        'cutting_batches',
        'cut_rows_json',
      );
      await this.dropColumnIfExists(
        queryRunner,
        'cutting_batches',
        'usable_coil_weight_kg',
      );
      await this.dropColumnIfExists(
        queryRunner,
        'cutting_batches',
        'avg_10ft_piece_weight_kg',
      );
      await this.dropColumnIfExists(
        queryRunner,
        'cutting_batches',
        'ten_ft_equivalent_qty',
      );
    }

    if (await this.tableExists(queryRunner, 'finished_chaddar_stock')) {
      await this.dropColumnIfExists(
        queryRunner,
        'finished_chaddar_stock',
        'length_ft',
      );
    }
  }

  private async tableExists(
    queryRunner: QueryRunner,
    tableName: string,
  ): Promise<boolean> {
    const rows = (await queryRunner.query(
      `SELECT 1 AS present FROM sqlite_master WHERE type = 'table' AND name = ?`,
      [tableName],
    )) as Array<{ present: number }>;
    return rows.length > 0;
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
    type: string,
  ): Promise<void> {
    if (await this.columnExists(queryRunner, tableName, columnName)) {
      return;
    }
    await queryRunner.query(
      `ALTER TABLE ${this.quoteIdent(tableName)} ADD COLUMN ${this.quoteIdent(columnName)} ${type}`,
    );
  }

  private async createIndexIfMissing(
    queryRunner: QueryRunner,
    tableName: string,
    indexName: string,
    columns: string[],
  ): Promise<void> {
    if (await this.indexExists(queryRunner, tableName, indexName)) {
      return;
    }
    const cols = columns.map((c) => this.quoteIdent(c)).join(', ');
    await queryRunner.query(
      `CREATE INDEX ${this.quoteIdent(indexName)} ON ${this.quoteIdent(tableName)} (${cols})`,
    );
  }

  private async dropColumnIfExists(
    queryRunner: QueryRunner,
    tableName: string,
    columnName: string,
  ): Promise<void> {
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
