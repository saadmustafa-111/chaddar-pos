import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('price_categories')
export class PriceCategory {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 20, unique: true })
  code: string;

  @Column({ type: 'varchar', length: 50 })
  name: string;

  /**
   * @deprecated
   * Coil purchase rate is now sourced from the actual supplier purchase
   * (see `coil.purchaseRatePaisa`). The `PriceCategory` only carries the
   * default *selling* rate. This column is intentionally retained on the
   * table for backward compatibility with existing rows and will be removed
   * in a future migration once all historical data is no longer needed.
   */
  @Column({ name: 'purchase_rate_paisa', type: 'integer', default: 0 })
  purchaseRatePaisa: number;

  @Column({ name: 'selling_rate_paisa', type: 'integer', default: 0 })
  sellingRatePaisa: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
