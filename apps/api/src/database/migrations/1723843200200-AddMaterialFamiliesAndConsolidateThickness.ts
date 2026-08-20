import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMaterialFamiliesAndConsolidateThickness1723843200200 implements MigrationInterface {
  name = 'AddMaterialFamiliesAndConsolidateThickness1723843200200';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "material_families" (
        "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        "code" varchar(20) UNIQUE NOT NULL,
        "name" varchar(100) NOT NULL,
        "description" text,
        "is_active" boolean DEFAULT 1 NOT NULL,
        "created_at" datetime DEFAULT CURRENT_TIMESTAMP NOT NULL,
        "updated_at" datetime DEFAULT CURRENT_TIMESTAMP NOT NULL
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "temporary_coils" (
        "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        "code" varchar(20) UNIQUE NOT NULL,
        "batch_number" varchar(50),
        "purchase_id" integer NOT NULL,
        "supplier_id" integer NOT NULL,
        "material_family_id" integer,
        "brand" varchar(50),
        "color" varchar(50),
        "width" decimal(10, 3) DEFAULT 0 NOT NULL,
        "thickness_mm" decimal(10, 3),
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
        CONSTRAINT "fk_coils_supplier" FOREIGN KEY ("supplier_id") REFERENCES "suppliers" ("id"),
        CONSTRAINT "fk_coils_material_family" FOREIGN KEY ("material_family_id") REFERENCES "material_families" ("id")
      )
    `);

    await queryRunner.query(`
      INSERT INTO temporary_coils (
        "id", "code", "batch_number", "purchase_id", "supplier_id",
        "brand", "color", "width", "thickness_mm",
        "gross_weight", "purchase_weight", "purchase_rate_paisa", "purchase_amount_paisa",
        "current_weight", "status", "location", "notes", "created_at", "updated_at"
      )
      SELECT
        "id", "code", "batch_number", "purchase_id", "supplier_id",
        "brand", "color", "width", "thickness",
        "gross_weight", "purchase_weight", "purchase_rate_paisa", "purchase_amount_paisa",
        "current_weight", "status", "location", "notes", "created_at", "updated_at"
      FROM "coils"
    `);

    await queryRunner.query(`DROP TABLE "coils"`);
    await queryRunner.query(`ALTER TABLE "temporary_coils" RENAME TO "coils"`);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_coils_material_family_id" ON "coils" ("material_family_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_coils_material_family_id"`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "temporary_coils" (
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
      INSERT INTO temporary_coils (
        "id", "code", "batch_number", "purchase_id", "supplier_id",
        "material_type", "brand", "color", "width", "thickness", "gauge",
        "gross_weight", "purchase_weight", "purchase_rate_paisa", "purchase_amount_paisa",
        "current_weight", "status", "location", "notes", "created_at", "updated_at"
      )
      SELECT
        "id", "code", "batch_number", "purchase_id", "supplier_id,
        NULL as "material_type", "brand", "color", "width", "thickness_mm", NULL as "gauge",
        "gross_weight", "purchase_weight", "purchase_rate_paisa", "purchase_amount_paisa",
        "current_weight", "status", "location", "notes", "created_at", "updated_at"
      FROM "coils"
    `);

    await queryRunner.query(`DROP TABLE "coils"`);
    await queryRunner.query(`ALTER TABLE "temporary_coils" RENAME TO "coils"`);

    await queryRunner.query(`DROP TABLE IF EXISTS "material_families"`);
  }
}
