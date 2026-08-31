import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCuttingBatchesAndFinishedStock1723843200500 implements MigrationInterface {
  name = 'CreateCuttingBatchesAndFinishedStock1723843200500';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "cutting_batches" (
        "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        "code" varchar(20) UNIQUE NOT NULL,
        "source_coil_id" integer NOT NULL,
        "size_label" varchar(50) NOT NULL,
        "width_mm" decimal(10, 3),
        "thickness_mm" decimal(10, 3),
        "color" varchar(50),
        "brand" varchar(50),
        "pieces_produced" integer NOT NULL,
        "cutting_weight_kg" decimal(12, 3) NOT NULL,
        "finished_cost_per_kg_paisa" bigint NOT NULL DEFAULT 0,
        "total_production_cost_paisa" bigint NOT NULL DEFAULT 0,
        "production_date" date NOT NULL,
        "note" text,
        "created_by" varchar(100),
        "created_at" datetime DEFAULT CURRENT_TIMESTAMP NOT NULL,
        "updated_at" datetime DEFAULT CURRENT_TIMESTAMP NOT NULL,
        CONSTRAINT "fk_cutting_batches_coil"
          FOREIGN KEY ("source_coil_id") REFERENCES "coils" ("id")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_cutting_batches_source_coil_id" ON "cutting_batches" ("source_coil_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_cutting_batches_code" ON "cutting_batches" ("code")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_cutting_batches_production_date" ON "cutting_batches" ("production_date")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "finished_chaddar_stock" (
        "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        "code" varchar(20) UNIQUE NOT NULL,
        "cutting_batch_id" integer NOT NULL,
        "source_coil_id" integer NOT NULL,
        "size_label" varchar(50) NOT NULL,
        "width_mm" decimal(10, 3),
        "thickness_mm" decimal(10, 3),
        "color" varchar(50),
        "brand" varchar(50),
        "pieces_produced" integer NOT NULL,
        "total_weight_kg" decimal(12, 3) NOT NULL,
        "remaining_pieces" integer NOT NULL,
        "remaining_weight_kg" decimal(12, 3) NOT NULL,
        "finished_cost_per_kg_paisa" bigint NOT NULL DEFAULT 0,
        "total_production_cost_paisa" bigint NOT NULL DEFAULT 0,
        "status" varchar(20) DEFAULT 'AVAILABLE' NOT NULL,
        "production_date" date NOT NULL,
        "created_at" datetime DEFAULT CURRENT_TIMESTAMP NOT NULL,
        "updated_at" datetime DEFAULT CURRENT_TIMESTAMP NOT NULL,
        CONSTRAINT "fk_finished_stock_batch"
          FOREIGN KEY ("cutting_batch_id") REFERENCES "cutting_batches" ("id"),
        CONSTRAINT "fk_finished_stock_coil"
          FOREIGN KEY ("source_coil_id") REFERENCES "coils" ("id")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_finished_stock_batch_id" ON "finished_chaddar_stock" ("cutting_batch_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_finished_stock_coil_id" ON "finished_chaddar_stock" ("source_coil_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_finished_stock_code" ON "finished_chaddar_stock" ("code")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_finished_stock_status" ON "finished_chaddar_stock" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_finished_stock_production_date" ON "finished_chaddar_stock" ("production_date")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_finished_stock_production_date"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_finished_stock_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_finished_stock_code"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_finished_stock_coil_id"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_finished_stock_batch_id"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "finished_chaddar_stock"`);

    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_cutting_batches_production_date"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_cutting_batches_code"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_cutting_batches_source_coil_id"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "cutting_batches"`);
  }
}
