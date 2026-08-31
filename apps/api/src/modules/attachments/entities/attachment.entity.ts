import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum AttachmentEntityType {
  SUPPLIER = 'SUPPLIER',
  CUSTOMER = 'CUSTOMER',
  PURCHASE = 'PURCHASE',
  SALE = 'SALE',
  PURCHASE_PAYMENT = 'PURCHASE_PAYMENT',
  CUSTOMER_PAYMENT = 'CUSTOMER_PAYMENT',
  EXPENSE = 'EXPENSE',
  COIL = 'COIL',
  COIL_LANDING_EXPENSE = 'COIL_LANDING_EXPENSE',
  OTHER = 'OTHER',
}

export enum DocumentType {
  RECEIPT = 'RECEIPT',
  INVOICE = 'INVOICE',
  PAYMENT_PROOF = 'PAYMENT_PROOF',
  DELIVERY_CHALLAN = 'DELIVERY_CHALLAN',
  PURCHASE_DOCUMENT = 'PURCHASE_DOCUMENT',
  CNIC = 'CNIC',
  OTHER = 'OTHER',
}

@Entity('attachments')
@Index('idx_attachment_entity', ['entityType', 'entityId'])
export class Attachment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 30 })
  entityType: AttachmentEntityType;

  @Column({ type: 'integer' })
  entityId: number;

  @Column({ type: 'varchar', length: 30 })
  documentType: DocumentType;

  @Column({ type: 'varchar', length: 255 })
  originalFilename: string;

  @Column({ type: 'varchar', length: 255 })
  storedFilename: string;

  @Column({ type: 'varchar', length: 100 })
  mimeType: string;

  @Column({ type: 'integer' })
  sizeBytes: number;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ name: 'uploaded_by', type: 'varchar', length: 100, nullable: true })
  uploadedBy: string | null;

  @CreateDateColumn({ name: 'uploaded_at' })
  uploadedAt: Date;
}
