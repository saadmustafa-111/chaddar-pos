import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds the Plane Stock inventory bucket.
 *
 * Each row records the operator-initiated transfer of weight from a
 * raw coil into the separate Plane Stock category. The `coil_id`
 * foreign key uses `ON DELETE RESTRICT` so we can never silently lose
 * the source of a plane entry - if a coil needs to be retired the
 * operator has to consume / cancel its plane entries first.
 */
export class CreatePlaneStock1723843201300 implements MigrationInterface {
  name = 'CreatePlaneStock1723843201300';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "plane_stock" (
        "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        "coil_id" integer NOT NULL,
        "weight_kg" decimal(12, 3) NOT NULL,
        "calculated_feet" decimal(12, 3) NOT NULL,
        "kg_per_foot" decimal(12, 6) NOT NULL,
        "cost_per_kg_paisa" bigint NOT NULL DEFAULT 0,
        "total_value_paisa" bigint NOT NULL DEFAULT 0,
        "status" varchar(20) DEFAULT 'AVAILABLE' NOT NULL,
        "note" text,
        "created_by" varchar(100),
        "created_at" datetime DEFAULT CURRENT_TIMESTAMP NOT NULL,
        "updated_at" datetime DEFAULT CURRENT_TIMESTAMP NOT NULL,
        CONSTRAINT "fk_plane_stock_coil"
          FOREIGN KEY ("coil_id") REFERENCES "coils" ("id") ON DELETE RESTRICT
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_plane_stock_coil_id" ON "plane_stock" ("coil_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_plane_stock_status" ON "plane_stock" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_plane_stock_created_at" ON "plane_stock" ("created_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_plane_stock_created_at"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_plane_stock_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_plane_stock_coil_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "plane_stock"`);
  }
}
