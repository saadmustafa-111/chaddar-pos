import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds heat number generation support to finished chaddar stock:
 *   - `width_inches` on cutting_batches (coil width in inches, used for heat number)
 *   - `width_inches` on finished_chaddar_stock (per-row width, used for heat number)
 *   - `heat_number` on finished_chaddar_stock (unique identifier per stock row)
 *   - Index on heat_number for fast lookup
 *
 * Heat number formula: {normalizedLength}-{normalizedWidth}-{last3DigitsOfAvg10}
 * Example: "10-2.50-785"
 */
export class AddHeatNumberAndWidthInches1724846405000 implements MigrationInterface {
  name = 'AddHeatNumberAndWidthInches1724846405000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await this.tableExists(queryRunner, 'cutting_batches')) {
      await this.addColumnIfMissing(
        queryRunner,
        'cutting_batches',
        'width_inches',
        'decimal(10, 3)',
      );
    }

    if (await this.tableExists(queryRunner, 'finished_chaddar_stock')) {
      await this.addColumnIfMissing(
        queryRunner,
        'finished_chaddar_stock',
        'width_inches',
        'decimal(10, 3)',
      );
      await this.addColumnIfMissing(
        queryRunner,
        'finished_chaddar_stock',
        'heat_number',
        'varchar(50)',
      );
      await this.createIndexIfMissing(
        queryRunner,
        'finished_chaddar_stock',
        'idx_finished_stock_heat_number',
        ['heat_number'],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await this.tableExists(queryRunner, 'finished_chaddar_stock')) {
      await this.dropIndexIfExists(
        queryRunner,
        'finished_chaddar_stock',
        'idx_finished_stock_heat_number',
      );
      await this.dropColumnIfExists(
        queryRunner,
        'finished_chaddar_stock',
        'heat_number',
      );
      await this.dropColumnIfExists(
        queryRunner,
        'finished_chaddar_stock',
        'width_inches',
      );
    }

    if (await this.tableExists(queryRunner, 'cutting_batches')) {
      await this.dropColumnIfExists(
        queryRunner,
        'cutting_batches',
        'width_inches',
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

  private async dropIndexIfExists(
    queryRunner: QueryRunner,
    tableName: string,
    indexName: string,
  ): Promise<void> {
    if (!(await this.indexExists(queryRunner, tableName, indexName))) {
      return;
    }
    await queryRunner.query(`DROP INDEX ${this.quoteIdent(indexName)}`);
  }

  private quoteIdent(name: string): string {
    return `"${name.replace(/"/g, '""')}"`;
  }
}
