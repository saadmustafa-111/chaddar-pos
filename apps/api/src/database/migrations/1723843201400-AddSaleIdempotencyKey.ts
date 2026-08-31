import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds `sales.idempotency_key` as an optional, unique column so the
 * sale endpoint can safely dedupe accidental double-clicks on the POS
 * "Complete Sale" button without ever creating duplicate financial /
 * inventory rows.
 *
 * The column is added with `nullable: true` so the migration is safe
 * on existing rows that pre-date the field. A unique index is then
 * created separately so duplicate keys are rejected at the DB level.
 */
export class AddSaleIdempotencyKey1723843201400 implements MigrationInterface {
  name = 'AddSaleIdempotencyKey1723843201400';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const cols = (await queryRunner.query(
      `PRAGMA table_info(sales)`,
    )) as Array<{ name: string }>;
    if (!cols.some((c) => c.name === 'idempotency_key')) {
      await queryRunner.query(
        `ALTER TABLE "sales" ADD COLUMN "idempotency_key" varchar(64)`,
      );
    }

    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "uq_sales_idempotency_key" ON "sales" ("idempotency_key")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "uq_sales_idempotency_key"`);
    await queryRunner.query(
      `ALTER TABLE "sales" DROP COLUMN "idempotency_key"`,
    );
  }
}
