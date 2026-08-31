import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCoilProcessingWastage1723843200400 implements MigrationInterface {
  name = 'AddCoilProcessingWastage1723843200400';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "coils"
        ADD COLUMN "processing_status" varchar(20) DEFAULT 'NOT_STARTED' NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "coils"
        ADD COLUMN "processing_date" date
    `);

    await queryRunner.query(`
      ALTER TABLE "coils"
        ADD COLUMN "processing_note" text
    `);

    await queryRunner.query(`
      ALTER TABLE "coils"
        ADD COLUMN "wastage_weight" decimal(12, 3) DEFAULT 0 NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "coils" DROP COLUMN "wastage_weight"`);
    await queryRunner.query(
      `ALTER TABLE "coils" DROP COLUMN "processing_note"`,
    );
    await queryRunner.query(
      `ALTER TABLE "coils" DROP COLUMN "processing_date"`,
    );
    await queryRunner.query(
      `ALTER TABLE "coils" DROP COLUMN "processing_status"`,
    );
  }
}
