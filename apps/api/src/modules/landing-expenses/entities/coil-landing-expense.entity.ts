import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Coil } from '../../coils/entities/coil.entity';

export enum LandingExpenseType {
  TRANSPORT = 'TRANSPORT',
  FREIGHT = 'FREIGHT',
  LOADING = 'LOADING',
  UNLOADING = 'UNLOADING',
  HANDLING = 'HANDLING',
  DELIVERY = 'DELIVERY',
  OTHER = 'OTHER',
}

@Entity('coil_landing_expenses')
export class CoilLandingExpense {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'coil_id' })
  coilId: number;

  @ManyToOne(() => Coil, (coil) => coil.landingExpenses)
  @JoinColumn({ name: 'coil_id' })
  coil: Coil;

  @Column({
    type: 'varchar',
    length: 20,
    default: LandingExpenseType.OTHER,
  })
  type: LandingExpenseType;

  @Column({
    name: 'amount_paisa',
    type: 'bigint',
    default: 0,
  })
  amountPaisa: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description: string | null;

  @Column({
    name: 'reference_number',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  referenceNumber: string | null;

  @Column({
    name: 'expense_date',
    type: 'date',
  })
  expenseDate: Date;

  @Column({ name: 'created_by', type: 'varchar', length: 100, nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
