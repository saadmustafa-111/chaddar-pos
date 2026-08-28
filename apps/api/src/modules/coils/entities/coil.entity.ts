import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Purchase } from '../../purchases/entities/purchase.entity';
import { Supplier } from '../../suppliers/entities/supplier.entity';
import { MaterialFamily } from '../../material-families/entities/material-family.entity';
import { InventoryMovement } from '../../inventory-movements/entities/inventory-movement.entity';
import { CoilLandingExpense } from '../../landing-expenses/entities/coil-landing-expense.entity';
import { CuttingBatch } from '../../cutting-batches/entities/cutting-batch.entity';
import { FinishedChaddarStock } from '../../finished-chaddar-stock/entities/finished-chaddar-stock.entity';
import { PlaneStock } from '../../plane-stock/entities/plane-stock.entity';
import { PriceCategory } from '../../price-categories/entities/price-category.entity';

export enum InventoryStatus {
  RAW = 'RAW',
  IN_PROCESS = 'IN_PROCESS',
  FINISHED = 'FINISHED',
  DEPLETED = 'DEPLETED',
}

export enum ProcessingStatus {
  NOT_STARTED = 'NOT_STARTED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
}

@Entity('coils')
export class Coil {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 20, unique: true })
  code: string;

  @Column({ name: 'batch_number', type: 'varchar', length: 50, nullable: true })
  batchNumber: string | null;

  @Column({ name: 'purchase_id' })
  purchaseId: number;

  @ManyToOne(() => Purchase, (purchase) => purchase.coils)
  @JoinColumn({ name: 'purchase_id' })
  purchase: Purchase;

  @Column({ name: 'supplier_id' })
  supplierId: number;

  @ManyToOne(() => Supplier)
  @JoinColumn({ name: 'supplier_id' })
  supplier: Supplier;

  @Column({ name: 'material_family_id', nullable: true })
  materialFamilyId: number | null;

  @ManyToOne(() => MaterialFamily, (family) => family.coils, { nullable: true })
  @JoinColumn({ name: 'material_family_id' })
  materialFamily: MaterialFamily | null;

  @Column({ name: 'price_category_id', nullable: true })
  priceCategoryId: number | null;

  @ManyToOne(() => PriceCategory, { nullable: true })
  @JoinColumn({ name: 'price_category_id' })
  priceCategory: PriceCategory | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  brand: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  color: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 3, default: 0 })
  width: number;

  @Column({
    name: 'thickness_mm',
    type: 'decimal',
    precision: 10,
    scale: 3,
    nullable: true,
  })
  thicknessMm: number | null;

  @Column({
    name: 'gross_weight',
    type: 'decimal',
    precision: 12,
    scale: 3,
    default: 0,
  })
  grossWeight: number;

  @Column({
    name: 'purchase_weight',
    type: 'decimal',
    precision: 12,
    scale: 3,
    default: 0,
  })
  purchaseWeight: number;

  @Column({ name: 'purchase_rate_paisa', type: 'bigint', default: 0 })
  purchaseRatePaisa: number;

  @Column({ name: 'purchase_amount_paisa', type: 'bigint', default: 0 })
  purchaseAmountPaisa: number;

  @Column({
    name: 'current_weight',
    type: 'decimal',
    precision: 12,
    scale: 3,
    default: 0,
  })
  currentWeight: number;

  @Column({
    type: 'varchar',
    length: 20,
    default: InventoryStatus.RAW,
  })
  status: InventoryStatus;

  @Column({
    name: 'processing_status',
    type: 'varchar',
    length: 20,
    default: ProcessingStatus.NOT_STARTED,
  })
  processingStatus: ProcessingStatus;

  @Column({ name: 'processing_date', type: 'date', nullable: true })
  processingDate: Date | null;

  @Column({ name: 'processing_note', type: 'text', nullable: true })
  processingNote: string | null;

  @Column({
    name: 'wastage_weight',
    type: 'decimal',
    precision: 12,
    scale: 3,
    default: 0,
  })
  wastageWeight: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  location: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => InventoryMovement, (movement) => movement.coil)
  inventoryMovements: InventoryMovement[];

  @OneToMany(() => CoilLandingExpense, (expense) => expense.coil)
  landingExpenses: CoilLandingExpense[];

  @OneToMany(() => CuttingBatch, (batch) => batch.sourceCoil)
  cuttingBatches: CuttingBatch[];

  @OneToMany(() => FinishedChaddarStock, (stock) => stock.sourceCoil)
  finishedStocks: FinishedChaddarStock[];

  @OneToMany(() => PlaneStock, (plane) => plane.coil)
  planeStocks: PlaneStock[];
}
