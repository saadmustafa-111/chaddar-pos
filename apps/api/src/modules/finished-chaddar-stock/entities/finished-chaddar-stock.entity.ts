import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { CuttingBatch } from '../../cutting-batches/entities/cutting-batch.entity';
import { Coil } from '../../coils/entities/coil.entity';
import { PriceCategory } from '../../price-categories/entities/price-category.entity';

export enum FinishedChaddarStatus {
  AVAILABLE = 'AVAILABLE',
  PARTIALLY_SOLD = 'PARTIALLY_SOLD',
  SOLD_OUT = 'SOLD_OUT',
  CANCELLED = 'CANCELLED',
}

@Entity('finished_chaddar_stock')
@Index('idx_finished_stock_batch_id', ['cuttingBatchId'])
@Index('idx_finished_stock_coil_id', ['sourceCoilId'])
@Index('idx_finished_stock_status', ['status'])
@Index('idx_finished_stock_heat_number', ['heatNumber'])
export class FinishedChaddarStock {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 30, unique: true })
  code: string;

  @Column({ name: 'heat_number', type: 'varchar', length: 50, nullable: true })
  heatNumber: string | null;

  @Column({ name: 'cutting_batch_id' })
  cuttingBatchId: number;

  @ManyToOne(() => CuttingBatch, (batch) => batch.finishedStocks)
  @JoinColumn({ name: 'cutting_batch_id' })
  cuttingBatch: CuttingBatch;

  @Column({ name: 'source_coil_id' })
  sourceCoilId: number;

  @ManyToOne(() => Coil, (coil) => coil.finishedStocks)
  @JoinColumn({ name: 'source_coil_id' })
  sourceCoil: Coil;

  @Column({ name: 'price_category_id', nullable: true })
  priceCategoryId: number | null;

  @ManyToOne(() => PriceCategory, { nullable: true })
  @JoinColumn({ name: 'price_category_id' })
  priceCategory: PriceCategory | null;

  @Column({ name: 'size_label', type: 'varchar', length: 50 })
  sizeLabel: string;

  @Column({
    name: 'width_mm',
    type: 'decimal',
    precision: 10,
    scale: 3,
    nullable: true,
  })
  widthMm: number | null;

  @Column({
    name: 'width_inches',
    type: 'decimal',
    precision: 10,
    scale: 3,
    nullable: true,
  })
  widthInches: number | null;

  @Column({
    name: 'thickness_mm',
    type: 'decimal',
    precision: 10,
    scale: 3,
    nullable: true,
  })
  thicknessMm: number | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  color: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  brand: string | null;

  /**
   * Length of one piece in feet. Persisted so sales and inventory
   * summaries can group by length without joining the parent batch.
   */
  @Column({
    name: 'length_ft',
    type: 'decimal',
    precision: 10,
    scale: 3,
    nullable: true,
  })
  lengthFt: number | null;

  @Column({ name: 'pieces_produced', type: 'integer' })
  piecesProduced: number;

  @Column({ name: 'total_weight_kg', type: 'decimal', precision: 12, scale: 3 })
  totalWeightKg: number;

  @Column({ name: 'remaining_pieces', type: 'integer' })
  remainingPieces: number;

  @Column({
    name: 'remaining_weight_kg',
    type: 'decimal',
    precision: 12,
    scale: 3,
  })
  remainingWeightKg: number;

  /**
   * Persisted average weight-per-piece in KG.
   *
   * This is the source of truth used by POS to derive sold weight from sold
   * pieces. It is derived from actual production data when the cutting batch
   * is recorded (`totalWeightKg / piecesProduced`), so the system never
   * invents a piece weight from dimensions.
   */
  @Column({
    name: 'weight_per_piece_kg',
    type: 'decimal',
    precision: 12,
    scale: 3,
    nullable: true,
  })
  weightPerPieceKg: number | null;

  @Column({
    name: 'finished_cost_per_kg_paisa',
    type: 'bigint',
    default: 0,
  })
  finishedCostPerKgPaisa: number;

  @Column({
    name: 'total_production_cost_paisa',
    type: 'bigint',
    default: 0,
  })
  totalProductionCostPaisa: number;

  @Column({
    type: 'varchar',
    length: 20,
    default: FinishedChaddarStatus.AVAILABLE,
  })
  status: FinishedChaddarStatus;

  @Column({ name: 'production_date', type: 'date' })
  productionDate: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
