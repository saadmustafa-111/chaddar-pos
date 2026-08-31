import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAttachments1724846404000 implements MigrationInterface {
  name = 'CreateAttachments1724846404000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "attachments" (
        "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        "entityType" varchar(30) NOT NULL,
        "entityId" integer NOT NULL,
        "documentType" varchar(30) NOT NULL,
        "originalFilename" varchar(255) NOT NULL,
        "storedFilename" varchar(255) NOT NULL,
        "mimeType" varchar(100) NOT NULL,
        "sizeBytes" integer NOT NULL,
        "note" text,
        "uploaded_by" varchar(100),
        "uploaded_at" datetime DEFAULT (datetime('now')) NOT NULL
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_attachment_entity" ON "attachments" ("entityType", "entityId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_attachment_entity"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "attachments"`);
  }
}
