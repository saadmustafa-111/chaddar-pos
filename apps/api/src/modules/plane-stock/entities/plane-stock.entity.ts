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
import { Coil } from '../../coils/entities/coil.entity';

export enum PlaneStockStatus {
  AVAILABLE = 'AVAILABLE',
  CONSUMED = 'CONSUMED',
  CANCELLED = 'CANCELLED',
}

/**
 * A separate inventory bucket for "plane" material that the operator
 * deliberately moves off a raw coil before cutting. Each Plane record
 * is linked to exactly one source coil - the coil is the source of
 * truth for color, brand, thickness, width, density, cost/KG, etc.,
 * so this table intentionally stores only the data that is intrinsic
 * to the plane entry itself.
 *
 * `weightKg` is the net weight moved off the coil at the time of the
 * transfer. `calculatedFeet` is the equivalent linear feet derived
 * from the coil's own kg/foot at the same moment, so the displayed
 * figure matches what the cutting system would have produced had the
 * operator cut the same weight into 10ft pieces.
 */
@Entity('plane_stock')
@Index('idx_plane_stock_coil_id', ['coilId'])
@Index('idx_plane_stock_status', ['status'])
@Index('idx_plane_stock_created_at', ['createdAt'])
export class PlaneStock {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'coil_id' })
  coilId: number;

  @ManyToOne(() => Coil, (coil) => coil.planeStocks, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'coil_id' })
  coil: Coil;

  @Column({
    name: 'weight_kg',
    type: 'decimal',
    precision: 12,
    scale: 3,
  })
  weightKg: number;

  @Column({
    name: 'calculated_feet',
    type: 'decimal',
    precision: 12,
    scale: 3,
  })
  calculatedFeet: number;

  /**
   * Snapshot of the kg/foot that was used to derive `calculatedFeet`.
   * Persisted so future migrations / re-calculations can be audited
   * even if the source coil's history changes later.
   */
  @Column({
    name: 'kg_per_foot',
    type: 'decimal',
    precision: 12,
    scale: 6,
  })
  kgPerFoot: number;

  @Column({
    name: 'cost_per_kg_paisa',
    type: 'bigint',
    default: 0,
  })
  costPerKgPaisa: number;

  /**
   * Total value snapshot at creation time: `weightKg *
   * costPerKgPaisa`. Stored as bigint paisa.
   */
  @Column({
    name: 'total_value_paisa',
    type: 'bigint',
    default: 0,
  })
  totalValuePaisa: number;

  @Column({
    type: 'varchar',
    length: 20,
    default: PlaneStockStatus.AVAILABLE,
  })
  status: PlaneStockStatus;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ name: 'created_by', type: 'varchar', length: 100, nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
