import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Coil } from '../../coils/entities/coil.entity';

export enum MovementType {
  PURCHASE_RECEIPT = 'PURCHASE_RECEIPT',
  PROCESSING_INPUT = 'PROCESSING_INPUT',
  PROCESSING_OUTPUT = 'PROCESSING_OUTPUT',
  CUTTING_CONSUMPTION = 'CUTTING_CONSUMPTION',
  SHEET_PRODUCTION = 'SHEET_PRODUCTION',
  SCRAP = 'SCRAP',
  SALE = 'SALE',
  ADJUSTMENT = 'ADJUSTMENT',
  RETURN = 'RETURN',
  /**
   * Material moved from a raw coil into the separate Plane Stock
   * category. Always a deduction against the source coil and a
   * positive entry in Plane Stock; never wastage and never a sale.
   */
  PLANE_TRANSFER = 'PLANE_TRANSFER',
  /**
   * Material moved out of Plane Stock back to the source coil (or
   * onwards into a finished operation). Reserved for future flows.
   */
  PLANE_REVERSAL = 'PLANE_REVERSAL',
}

@Entity('inventory_movements')
export class InventoryMovement {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'coil_id' })
  coilId: number;

  @ManyToOne(() => Coil, (coil) => coil.inventoryMovements)
  @JoinColumn({ name: 'coil_id' })
  coil: Coil;

  @Column({ type: 'varchar', length: 30 })
  type: MovementType;

  @Column({ name: 'weight_delta', type: 'decimal', precision: 12, scale: 3 })
  weightDelta: number;

  @Column({ name: 'weight_balance', type: 'decimal', precision: 12, scale: 3 })
  weightBalance: number;

  @Column({
    name: 'reference_type',
    type: 'varchar',
    length: 30,
    nullable: true,
  })
  referenceType: string | null;

  @Column({ name: 'reference_id', type: 'integer', nullable: true })
  referenceId: number | null;

  @Column({
    name: 'reference_code',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  referenceCode: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ name: 'created_by', type: 'varchar', length: 100, nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
