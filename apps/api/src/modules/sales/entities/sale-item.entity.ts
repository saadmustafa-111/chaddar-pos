import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Sale } from './sale.entity';

@Entity('sale_items')
@Index('idx_sale_items_sale_id', ['saleId'])
@Index('idx_sale_items_finished_stock_id', ['finishedStockId'])
@Index('idx_sale_items_cutting_batch_id', ['cuttingBatchId'])
@Index('idx_sale_items_coil_id', ['sourceCoilId'])
export class SaleItem {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'sale_id' })
  saleId: number;

  @ManyToOne(() => Sale, (sale) => sale.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sale_id' })
  sale: Sale;

  @Column({ name: 'finished_stock_id' })
  finishedStockId: number;

  @Column({ name: 'cutting_batch_id' })
  cuttingBatchId: number;

  @Column({ name: 'source_coil_id' })
  sourceCoilId: number;

  @Column({ name: 'size_label', type: 'varchar', length: 50 })
  sizeLabel: string;

  @Column({ name: 'pieces_sold', type: 'integer' })
  piecesSold: number;

  @Column({ name: 'weight_sold_kg', type: 'decimal', precision: 12, scale: 3 })
  weightSoldKg: number;

  @Column({ name: 'selling_rate_paisa', type: 'bigint' })
  sellingRatePaisa: number;

  @Column({ name: 'finished_cost_per_kg_paisa', type: 'bigint' })
  finishedCostPerKgPaisa: number;

  @Column({ name: 'line_revenue_paisa', type: 'bigint' })
  lineRevenuePaisa: number;

  @Column({ name: 'line_cost_paisa', type: 'bigint' })
  lineCostPaisa: number;

  @Column({ name: 'line_gross_profit_paisa', type: 'bigint' })
  lineGrossProfitPaisa: number;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
