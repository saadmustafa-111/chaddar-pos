import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { Coil } from '../../coils/entities/coil.entity';
import { FinishedChaddarStock } from '../../finished-chaddar-stock/entities/finished-chaddar-stock.entity';
import { PriceCategory } from '../../price-categories/entities/price-category.entity';

@Entity('cutting_batches')
@Index('idx_cutting_batches_source_coil_id', ['sourceCoilId'])
export class CuttingBatch {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 20, unique: true })
  code: string;

  @Column({ name: 'source_coil_id' })
  sourceCoilId: number;

  @ManyToOne(() => Coil, (coil) => coil.cuttingBatches)
  @JoinColumn({ name: 'source_coil_id' })
  sourceCoil: Coil;

  @Column({ name: 'price_category_id', nullable: true })
  priceCategoryId: number | null;

  @ManyToOne(() => PriceCategory, { nullable: true })
  @JoinColumn({ name: 'price_category_id' })
  priceCategory: PriceCategory | null;

  /**
   * `size_label` is preserved for legacy single-size batches and as the
   * headline summary label shown on the Production History list. For
   * multi-size cuts we store a synthetic label like `Multi (8ft, 10ft)`.
   */
  @Column({ name: 'size_label', type: 'varchar', length: 100 })
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
   * Total pieces produced across all rows of the cutting batch. Each
   * row has its own per-size FinishedChaddarStock record.
   */
  @Column({ name: 'pieces_produced', type: 'integer' })
  piecesProduced: number;

  @Column({
    name: 'cutting_weight_kg',
    type: 'decimal',
    precision: 12,
    scale: 3,
  })
  cuttingWeightKg: number;

  /**
   * Weighted average weight-per-piece across all rows of this cutting
   * batch. POS derives sold weight from the per-row FinishedChaddarStock
   * snapshot in normal cases; this is a back-stop for legacy / one-row
   * cuts that never had a per-row snapshot.
   */
  @Column({
    name: 'weight_per_piece_kg',
    type: 'decimal',
    precision: 12,
    scale: 3,
    nullable: true,
  })
  weightPerPieceKg: number | null;

  /**
   * Number of 10-ft equivalent pieces this batch represents. Useful for
   * the production history view and for analytical reports.
   * `ten_ft_equivalent_qty = SUM(lengthFt * quantity) / 10`.
   */
  @Column({
    name: 'ten_ft_equivalent_qty',
    type: 'decimal',
    precision: 12,
    scale: 3,
    nullable: true,
  })
  tenFtEquivalentQty: number | null;

  /**
   * Average weight-per-piece of a 10-ft piece for this batch:
   * `avg_10ft_piece_weight_kg = usableCoilWeight / tenFtEquivalentQty`.
   */
  @Column({
    name: 'avg_10ft_piece_weight_kg',
    type: 'decimal',
    precision: 12,
    scale: 3,
    nullable: true,
  })
  avg10ftPieceWeightKg: number | null;

  /**
   * Usable coil weight captured at the time of this cut. Persisted for
   * audit and to keep the Production History card self-contained even
   * after the coil is later depleted.
   */
  @Column({
    name: 'usable_coil_weight_kg',
    type: 'decimal',
    precision: 12,
    scale: 3,
    nullable: true,
  })
  usableCoilWeightKg: number | null;

  /**
   * JSON snapshot of the cutting rows for auditability. Shape:
   *   Array<{lengthFt:number, quantity:number, pieceWeightKg:number, totalWeightKg:number}>
   * Always present for batches created by the new flow.
   */
  @Column({ name: 'cut_rows_json', type: 'text', nullable: true })
  cutRowsJson: string | null;

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

  /**
   * Business date only. Stored without a timezone so the value is
   * stable regardless of the host machine's locale. `utc: true` tells
   * TypeORM to read/write this column via `getUTC*()` accessors so a
   * `new Date('YYYY-MM-DD')` value (which the language spec parses as
   * UTC midnight) round-trips back to the same YYYY-MM-DD string and
   * never silently shifts by a day on hosts west of UTC.
   */
  @Column({ name: 'production_date', type: 'date', utc: true })
  productionDate: Date;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ name: 'created_by', type: 'varchar', length: 100, nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  /**
   * One cutting batch may produce many finished stock rows (one per size
   * length). Each FinishedChaddarStock carries its own length, weight-per-
   * piece and finished cost snapshot so sales target the correct row.
   */
  @OneToMany(() => FinishedChaddarStock, (stock) => stock.cuttingBatch)
  finishedStocks: FinishedChaddarStock[];
}
