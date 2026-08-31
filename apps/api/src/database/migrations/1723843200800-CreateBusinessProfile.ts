import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateBusinessProfile1723843200800 implements MigrationInterface {
  name = 'CreateBusinessProfile1723843200800';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "business_profiles" (
        "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        "shop_name" varchar(100) NOT NULL DEFAULT 'SteelCoil POS',
        "address" varchar(255),
        "phone" varchar(30),
        "tax_number" varchar(50),
        "footer_message" varchar(255),
        "created_at" datetime DEFAULT CURRENT_TIMESTAMP NOT NULL,
        "updated_at" datetime DEFAULT CURRENT_TIMESTAMP NOT NULL
      )
    `);

    await queryRunner.query(`
      INSERT INTO "business_profiles" ("shop_name", "footer_message")
      SELECT 'SteelCoil POS', 'Thank you for your business.'
      WHERE NOT EXISTS (SELECT 1 FROM "business_profiles")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "business_profiles"`);
  }
}
