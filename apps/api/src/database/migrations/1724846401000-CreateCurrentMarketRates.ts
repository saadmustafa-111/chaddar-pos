import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class CreateCurrentMarketRates1724846401000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'current_market_rates',
        columns: [
          {
            name: 'id',
            type: 'integer',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'material_family_id',
            type: 'integer',
            isUnique: true,
          },
          {
            name: 'raw_material_rate_paisa',
            type: 'bigint',
          },
          {
            name: 'effective_from',
            type: 'date',
          },
          {
            name: 'notes',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'datetime',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'datetime',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'current_market_rates',
      new TableIndex({
        name: 'idx_market_rate_family',
        columnNames: ['material_family_id'],
        isUnique: true,
      }),
    );

    await queryRunner.createForeignKey(
      'current_market_rates',
      new TableForeignKey({
        name: 'fk_market_rate_family',
        columnNames: ['material_family_id'],
        referencedTableName: 'material_families',
        referencedColumnNames: ['id'],
        onDelete: 'RESTRICT',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('current_market_rates');
  }
}
