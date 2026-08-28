import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCustomersLedgerAndSalePayments1723843200700 implements MigrationInterface {
  name = 'CreateCustomersLedgerAndSalePayments1723843200700';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "customers" (
        "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        "code" varchar(20) UNIQUE NOT NULL,
        "name" varchar(100) NOT NULL,
        "phone" varchar(30),
        "address" text,
        "note" text,
        "current_balance_paisa" bigint DEFAULT 0 NOT NULL,
        "is_active" boolean DEFAULT 1 NOT NULL,
        "created_at" datetime DEFAULT CURRENT_TIMESTAMP NOT NULL,
        "updated_at" datetime DEFAULT CURRENT_TIMESTAMP NOT NULL
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_customers_code" ON "customers" ("code")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_customers_phone" ON "customers" ("phone")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_customers_name" ON "customers" ("name")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_customers_is_active" ON "customers" ("is_active")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "customer_ledger_entries" (
        "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        "customer_id" integer NOT NULL,
        "sale_id" integer,
        "entry_type" varchar(20) NOT NULL,
        "amount_paisa" bigint NOT NULL,
        "balance_after_paisa" bigint NOT NULL,
        "entry_date" date NOT NULL,
        "note" text,
        "created_by" varchar(100),
        "created_at" datetime DEFAULT CURRENT_TIMESTAMP NOT NULL,
        CONSTRAINT "fk_ledger_customer"
          FOREIGN KEY ("customer_id") REFERENCES "customers" ("id"),
        CONSTRAINT "fk_ledger_sale"
          FOREIGN KEY ("sale_id") REFERENCES "sales" ("id")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_ledger_customer_id" ON "customer_ledger_entries" ("customer_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_ledger_sale_id" ON "customer_ledger_entries" ("sale_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_ledger_entry_date" ON "customer_ledger_entries" ("entry_date")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_ledger_entry_type" ON "customer_ledger_entries" ("entry_type")`,
    );

    await queryRunner.query(`
      ALTER TABLE "sales"
        ADD COLUMN "customer_id" integer
    `);
    await queryRunner.query(`
      ALTER TABLE "sales"
        ADD COLUMN "paid_amount_paisa" bigint DEFAULT 0 NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "sales"
        ADD COLUMN "due_amount_paisa" bigint DEFAULT 0 NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "sales"
        ADD COLUMN "payment_status" varchar(20) DEFAULT 'UNPAID' NOT NULL
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_sales_customer_id" ON "sales" ("customer_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_sales_payment_status" ON "sales" ("payment_status")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_sales_payment_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_sales_customer_id"`);
    await queryRunner.query(`ALTER TABLE "sales" DROP COLUMN "payment_status"`);
    await queryRunner.query(
      `ALTER TABLE "sales" DROP COLUMN "due_amount_paisa"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sales" DROP COLUMN "paid_amount_paisa"`,
    );
    await queryRunner.query(`ALTER TABLE "sales" DROP COLUMN "customer_id"`);

    await queryRunner.query(`DROP INDEX IF EXISTS "idx_ledger_entry_type"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_ledger_entry_date"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_ledger_sale_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_ledger_customer_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "customer_ledger_entries"`);

    await queryRunner.query(`DROP INDEX IF EXISTS "idx_customers_is_active"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_customers_name"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_customers_phone"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_customers_code"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "customers"`);
  }
}
