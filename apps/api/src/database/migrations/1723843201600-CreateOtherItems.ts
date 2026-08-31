import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds the Other Items table for tracking miscellaneous items
 * that do not follow the coil inventory lifecycle (e.g. scrap,
 * spares, old chaddar, etc.) with standalone pricing.
 */
export class CreateOtherItems1723843201600 implements MigrationInterface {
  name = 'CreateOtherItems1723843201600';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "other_items" (
        "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        "name" varchar(100) NOT NULL,
        "price_paisa" integer NOT NULL,
        "note" text,
        "created_at" datetime DEFAULT CURRENT_TIMESTAMP NOT NULL,
        "updated_at" datetime DEFAULT CURRENT_TIMESTAMP NOT NULL
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "other_items"`);
  }
}
