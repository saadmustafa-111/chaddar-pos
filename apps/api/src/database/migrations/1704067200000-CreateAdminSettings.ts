import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAdminSettings1704067200000 implements MigrationInterface {
  name = 'CreateAdminSettings1704067200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "admin_settings" (
        "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        "password_hash" varchar NOT NULL,
        "created_at" datetime DEFAULT CURRENT_TIMESTAMP NOT NULL,
        "updated_at" datetime DEFAULT CURRENT_TIMESTAMP NOT NULL
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "admin_settings"`);
  }
}
