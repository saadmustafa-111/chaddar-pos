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
import { Supplier } from '../../suppliers/entities/supplier.entity';
import { Coil } from '../../coils/entities/coil.entity';
import { SupplierLedgerEntry } from '../../suppliers/entities/supplier-ledger-entry.entity';

@Entity('purchases')
export class Purchase {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 20, unique: true })
  code: string;

  @Column({ name: 'supplier_id' })
  supplierId: number;

  @ManyToOne(() => Supplier, (supplier) => supplier.purchases)
  @JoinColumn({ name: 'supplier_id' })
  supplier: Supplier;

  @Column({
    name: 'supplier_invoice_number',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  supplierInvoiceNumber: string | null;

  @Column({ name: 'purchase_date', type: 'date' })
  purchaseDate: Date;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ name: 'created_by', type: 'varchar', length: 100, nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => Coil, (coil) => coil.purchase)
  coils: Coil[];

  @OneToMany(() => SupplierLedgerEntry, (entry) => entry.purchase)
  ledgerEntries: SupplierLedgerEntry[];
}
