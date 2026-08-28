import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSalesAndSaleItems1723843200600 implements MigrationInterface {
  name = 'CreateSalesAndSaleItems1723843200600';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "sales" (
        "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        "code" varchar(20) UNIQUE NOT NULL,
        "customer_name" varchar(100),
        "customer_phone" varchar(30),
        "sale_date" date NOT NULL,
        "total_amount_paisa" bigint DEFAULT 0 NOT NULL,
        "total_cost_paisa" bigint DEFAULT 0 NOT NULL,
        "gross_profit_paisa" bigint DEFAULT 0 NOT NULL,
        "status" varchar(20) DEFAULT 'COMPLETED' NOT NULL,
        "note" text,
        "created_by" varchar(100),
        "created_at" datetime DEFAULT CURRENT_TIMESTAMP NOT NULL,
        "updated_at" datetime DEFAULT CURRENT_TIMESTAMP NOT NULL
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_sales_code" ON "sales" ("code")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_sales_sale_date" ON "sales" ("sale_date")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_sales_status" ON "sales" ("status")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "sale_items" (
        "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        "sale_id" integer NOT NULL,
        "finished_stock_id" integer NOT NULL,
        "cutting_batch_id" integer NOT NULL,
        "source_coil_id" integer NOT NULL,
        "size_label" varchar(50) NOT NULL,
        "pieces_sold" integer NOT NULL,
        "weight_sold_kg" decimal(12, 3) NOT NULL,
        "selling_rate_paisa" bigint NOT NULL DEFAULT 0,
        "finished_cost_per_kg_paisa" bigint NOT NULL DEFAULT 0,
        "line_revenue_paisa" bigint NOT NULL DEFAULT 0,
        "line_cost_paisa" bigint NOT NULL DEFAULT 0,
        "line_gross_profit_paisa" bigint NOT NULL DEFAULT 0,
        "note" text,
        "created_at" datetime DEFAULT CURRENT_TIMESTAMP NOT NULL,
        CONSTRAINT "fk_sale_items_sale"
          FOREIGN KEY ("sale_id") REFERENCES "sales" ("id"),
        CONSTRAINT "fk_sale_items_finished_stock"
          FOREIGN KEY ("finished_stock_id") REFERENCES "finished_chaddar_stock" ("id"),
        CONSTRAINT "fk_sale_items_cutting_batch"
          FOREIGN KEY ("cutting_batch_id") REFERENCES "cutting_batches" ("id"),
        CONSTRAINT "fk_sale_items_coil"
          FOREIGN KEY ("source_coil_id") REFERENCES "coils" ("id")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_sale_items_sale_id" ON "sale_items" ("sale_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_sale_items_finished_stock_id" ON "sale_items" ("finished_stock_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_sale_items_cutting_batch_id" ON "sale_items" ("cutting_batch_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_sale_items_coil_id" ON "sale_items" ("source_coil_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_sale_items_coil_id"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_sale_items_cutting_batch_id"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_sale_items_finished_stock_id"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_sale_items_sale_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "sale_items"`);

    await queryRunner.query(`DROP INDEX IF EXISTS "idx_sales_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_sales_sale_date"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_sales_code"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "sales"`);
  }
}
