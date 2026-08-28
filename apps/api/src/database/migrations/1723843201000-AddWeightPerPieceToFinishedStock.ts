import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWeightPerPieceToFinishedStock1723843201000 implements MigrationInterface {
  name = 'AddWeightPerPieceToFinishedStock1723843201000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "finished_chaddar_stock" ADD COLUMN "weight_per_piece_kg" decimal(12, 3)`,
    );

    await queryRunner.query(
      `UPDATE "finished_chaddar_stock"
       SET "weight_per_piece_kg" = ROUND("total_weight_kg" / "pieces_produced", 3)
       WHERE "pieces_produced" > 0
         AND "weight_per_piece_kg" IS NULL`,
    );

    await queryRunner.query(
      `ALTER TABLE "cutting_batches" ADD COLUMN "weight_per_piece_kg" decimal(12, 3)`,
    );

    await queryRunner.query(
      `UPDATE "cutting_batches"
       SET "weight_per_piece_kg" = ROUND("cutting_weight_kg" / "pieces_produced", 3)
       WHERE "pieces_produced" > 0
         AND "weight_per_piece_kg" IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "cutting_batches" DROP COLUMN "weight_per_piece_kg"`,
    );
    await queryRunner.query(
      `ALTER TABLE "finished_chaddar_stock" DROP COLUMN "weight_per_piece_kg"`,
    );
  }
}
