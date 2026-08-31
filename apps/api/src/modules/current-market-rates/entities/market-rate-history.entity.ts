import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { MaterialFamily } from '../../material-families/entities/material-family.entity';

@Entity('market_rate_history')
@Index('idx_market_rate_history_family_effective', [
  'materialFamilyId',
  'effectiveFrom',
])
export class MarketRateHistory {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'material_family_id' })
  materialFamilyId: number;

  @ManyToOne(() => MaterialFamily)
  @JoinColumn({ name: 'material_family_id' })
  materialFamily: MaterialFamily;

  @Column({ name: 'raw_material_rate_paisa', type: 'bigint' })
  rawMaterialRatePaisa: number;

  @Column({ name: 'effective_from', type: 'date' })
  effectiveFrom: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
