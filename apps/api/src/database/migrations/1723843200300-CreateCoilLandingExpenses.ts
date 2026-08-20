import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCoilLandingExpenses1723843200300 implements MigrationInterface {
  name = 'CreateCoilLandingExpenses1723843200300';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "coil_landing_expenses" (
        "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        "coil_id" integer NOT NULL,
        "type" varchar(20) DEFAULT 'OTHER' NOT NULL,
        "amount_paisa" bigint DEFAULT 0 NOT NULL,
        "description" varchar(255),
        "reference_number" varchar(50),
        "expense_date" date NOT NULL,
        "created_by" varchar(100),
        "created_at" datetime DEFAULT CURRENT_TIMESTAMP NOT NULL,
        "updated_at" datetime DEFAULT CURRENT_TIMESTAMP NOT NULL,
        CONSTRAINT "fk_landing_expenses_coil" FOREIGN KEY ("coil_id") REFERENCES "coils" ("id")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_landing_expenses_coil_id" ON "coil_landing_expenses" ("coil_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_landing_expenses_coil_id"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "coil_landing_expenses"`);
  }
}
