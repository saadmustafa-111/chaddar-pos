import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSuppliersPurchasesCoils1723843200100 implements MigrationInterface {
  name = 'CreateSuppliersPurchasesCoils1723843200100';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "suppliers" (
        "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        "code" varchar(20) UNIQUE NOT NULL,
        "name" varchar(100) NOT NULL,
        "contact_person" varchar(100),
        "phone" varchar(20),
        "email" varchar(100),
        "address" text,
        "tax_number" varchar(50),
        "notes" text,
        "is_active" boolean DEFAULT 1 NOT NULL,
        "created_at" datetime DEFAULT CURRENT_TIMESTAMP NOT NULL,
        "updated_at" datetime DEFAULT CURRENT_TIMESTAMP NOT NULL
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "purchases" (
        "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        "code" varchar(20) UNIQUE NOT NULL,
        "supplier_id" integer NOT NULL,
        "supplier_invoice_number" varchar(50),
        "purchase_date" date NOT NULL,
        "notes" text,
        "created_by" varchar(100),
        "created_at" datetime DEFAULT CURRENT_TIMESTAMP NOT NULL,
        "updated_at" datetime DEFAULT CURRENT_TIMESTAMP NOT NULL,
        CONSTRAINT "fk_purchases_supplier" FOREIGN KEY ("supplier_id") REFERENCES "suppliers" ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "coils" (
        "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        "code" varchar(20) UNIQUE NOT NULL,
        "batch_number" varchar(50),
        "purchase_id" integer NOT NULL,
        "supplier_id" integer NOT NULL,
        "material_type" varchar(50),
        "brand" varchar(50),
        "color" varchar(50),
        "width" decimal(10, 3) DEFAULT 0 NOT NULL,
        "thickness" decimal(10, 3),
        "gauge" decimal(10, 3),
        "gross_weight" decimal(12, 3) DEFAULT 0 NOT NULL,
        "purchase_weight" decimal(12, 3) DEFAULT 0 NOT NULL,
        "purchase_rate_paisa" bigint DEFAULT 0 NOT NULL,
        "purchase_amount_paisa" bigint DEFAULT 0 NOT NULL,
        "current_weight" decimal(12, 3) DEFAULT 0 NOT NULL,
        "status" varchar(20) DEFAULT 'RAW' NOT NULL,
        "location" varchar(100),
        "notes" text,
        "created_at" datetime DEFAULT CURRENT_TIMESTAMP NOT NULL,
        "updated_at" datetime DEFAULT CURRENT_TIMESTAMP NOT NULL,
        CONSTRAINT "fk_coils_purchase" FOREIGN KEY ("purchase_id") REFERENCES "purchases" ("id"),
        CONSTRAINT "fk_coils_supplier" FOREIGN KEY ("supplier_id") REFERENCES "suppliers" ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "inventory_movements" (
        "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        "coil_id" integer NOT NULL,
        "type" varchar(30) NOT NULL,
        "weight_delta" decimal(12, 3) NOT NULL,
        "weight_balance" decimal(12, 3) NOT NULL,
        "reference_type" varchar(30),
        "reference_id" integer,
        "reference_code" varchar(50),
        "notes" text,
        "created_by" varchar(100),
        "created_at" datetime DEFAULT CURRENT_TIMESTAMP NOT NULL,
        CONSTRAINT "fk_movements_coil" FOREIGN KEY ("coil_id") REFERENCES "coils" ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_purchases_supplier_id" ON "purchases" ("supplier_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_purchases_code" ON "purchases" ("code")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_coils_purchase_id" ON "coils" ("purchase_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_coils_supplier_id" ON "coils" ("supplier_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_coils_code" ON "coils" ("code")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_coils_status" ON "coils" ("status")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_movements_coil_id" ON "inventory_movements" ("coil_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_movements_coil_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_coils_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_coils_code"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_coils_supplier_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_coils_purchase_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_purchases_code"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_purchases_supplier_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "inventory_movements"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "coils"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "purchases"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "suppliers"`);
  }
}
