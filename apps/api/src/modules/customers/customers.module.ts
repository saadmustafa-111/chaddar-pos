import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Customer } from './entities/customer.entity';
import { CustomerLedgerEntry } from './entities/customer-ledger-entry.entity';
import { Sale } from '../sales/entities/sale.entity';
import { CustomersService } from './customers.service';
import { CustomersController } from './customers.controller';
import { AttachmentsModule } from '../attachments/attachments.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Customer, CustomerLedgerEntry, Sale]),
    AttachmentsModule,
  ],
  controllers: [CustomersController],
  providers: [CustomersService],
  exports: [CustomersService],
})
export class CustomersModule {}
