import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('business_profiles')
export class BusinessProfile {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'shop_name', type: 'varchar', length: 100 })
  shopName: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  address: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  phone: string | null;

  @Column({ name: 'tax_number', type: 'varchar', length: 50, nullable: true })
  taxNumber: string | null;

  @Column({
    name: 'footer_message',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  footerMessage: string | null;

  @Column({ name: 'logo_url', type: 'varchar', length: 500, nullable: true })
  logoUrl: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
