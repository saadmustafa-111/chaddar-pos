import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddLogoUrlToBusinessProfile1724846400000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'business_profiles',
      new TableColumn({
        name: 'logo_url',
        type: 'varchar',
        length: '500',
        isNullable: true,
        default: null,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('business_profiles', 'logo_url');
  }
}
