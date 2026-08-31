import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class CreateMarketRateHistory1724846403000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'market_rate_history',
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
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'market_rate_history',
      new TableIndex({
        name: 'idx_market_rate_history_family_effective',
        columnNames: ['material_family_id', 'effective_from'],
      }),
    );

    await queryRunner.createForeignKey(
      'market_rate_history',
      new TableForeignKey({
        name: 'fk_market_rate_history_family',
        columnNames: ['material_family_id'],
        referencedTableName: 'material_families',
        referencedColumnNames: ['id'],
        onDelete: 'RESTRICT',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('market_rate_history');
  }
}
