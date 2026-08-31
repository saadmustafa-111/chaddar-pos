import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum ExpenseCategory {
  LABOUR = 'LABOUR',
  TRANSPORT = 'TRANSPORT',
  ELECTRICITY = 'ELECTRICITY',
  RENT = 'RENT',
  FUEL = 'FUEL',
  LOADING_UNLOADING = 'LOADING_UNLOADING',
  MAINTENANCE_REPAIR = 'MAINTENANCE_REPAIR',
  OFFICE_EXPENSE = 'OFFICE_EXPENSE',
  FOOD_REFRESHMENT = 'FOOD_REFRESHMENT',
  MISCELLANEOUS = 'MISCELLANEOUS',
  OTHER = 'OTHER',
}

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  [ExpenseCategory.LABOUR]: 'Labour',
  [ExpenseCategory.TRANSPORT]: 'Transport',
  [ExpenseCategory.ELECTRICITY]: 'Electricity',
  [ExpenseCategory.RENT]: 'Rent',
  [ExpenseCategory.FUEL]: 'Fuel',
  [ExpenseCategory.LOADING_UNLOADING]: 'Loading / Unloading',
  [ExpenseCategory.MAINTENANCE_REPAIR]: 'Maintenance / Repair',
  [ExpenseCategory.OFFICE_EXPENSE]: 'Office Expense',
  [ExpenseCategory.FOOD_REFRESHMENT]: 'Food / Refreshment',
  [ExpenseCategory.MISCELLANEOUS]: 'Miscellaneous',
  [ExpenseCategory.OTHER]: 'Other / Custom',
};

@Entity('expenses')
@Index('idx_expense_date', ['expenseDate'])
@Index('idx_expense_category', ['category'])
export class Expense {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'expense_date', type: 'date' })
  expenseDate: Date;

  @Column({ type: 'varchar', length: 30 })
  category: ExpenseCategory;

  @Column({
    name: 'custom_category',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  customCategory: string | null;

  @Column({ name: 'amount_paisa', type: 'integer' })
  amountPaisa: number;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ name: 'created_by', type: 'varchar', length: 100, nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
