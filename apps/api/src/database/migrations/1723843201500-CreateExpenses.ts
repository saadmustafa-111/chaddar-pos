import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds the Daily Expenses table for tracking operating expenses
 * separately from coil landing/processing costs.
 *
 * Expenses are categorized (Labour, Transport, Electricity, Rent,
 * Fuel, Loading/Unloading, Maintenance/Repair, Office Expense,
 * Food/Refreshment, Miscellaneous, Other/Custom). The date and
 * category columns are indexed for efficient filtering.
 */
export class CreateExpenses1723843201500 implements MigrationInterface {
  name = 'CreateExpenses1723843201500';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "expenses" (
        "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        "expense_date" date NOT NULL,
        "category" varchar(30) NOT NULL,
        "custom_category" varchar(100),
        "amount_paisa" integer NOT NULL,
        "note" text,
        "created_by" varchar(100),
        "created_at" datetime DEFAULT CURRENT_TIMESTAMP NOT NULL,
        "updated_at" datetime DEFAULT CURRENT_TIMESTAMP NOT NULL
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_expense_date" ON "expenses" ("expense_date")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_expense_category" ON "expenses" ("category")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_expense_category"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_expense_date"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "expenses"`);
  }
}
