import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddReplacementCostToSaleItems1724846402000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'sale_items',
      new TableColumn({
        name: 'replacement_cost_per_kg_paisa',
        type: 'bigint',
        isNullable: true,
      }),
    );

    await queryRunner.addColumn(
      'sale_items',
      new TableColumn({
        name: 'current_business_margin_paisa',
        type: 'bigint',
        isNullable: true,
      }),
    );

    await queryRunner.addColumn(
      'sale_items',
      new TableColumn({
        name: 'market_rate_snapshot_date',
        type: 'varchar',
        length: '10',
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('sale_items', 'replacement_cost_per_kg_paisa');
    await queryRunner.dropColumn('sale_items', 'current_business_margin_paisa');
    await queryRunner.dropColumn('sale_items', 'market_rate_snapshot_date');
  }
}
