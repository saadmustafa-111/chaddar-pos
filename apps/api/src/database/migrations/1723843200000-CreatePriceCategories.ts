import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePriceCategories1723843200000 implements MigrationInterface {
  name = 'CreatePriceCategories1723843200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "price_categories" (
        "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        "code" varchar(20) UNIQUE NOT NULL,
        "name" varchar(50) NOT NULL,
        "purchase_rate_paisa" integer NOT NULL DEFAULT 0,
        "selling_rate_paisa" integer NOT NULL DEFAULT 0,
        "is_active" boolean DEFAULT 1 NOT NULL,
        "created_at" datetime DEFAULT CURRENT_TIMESTAMP NOT NULL,
        "updated_at" datetime DEFAULT CURRENT_TIMESTAMP NOT NULL
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "price_categories"`);
  }
}
