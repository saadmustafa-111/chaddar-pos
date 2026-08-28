import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  ParseIntPipe,
  Req,
} from '@nestjs/common';
import { SuppliersService, SupplierWithTotals } from './suppliers.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { Supplier } from './entities/supplier.entity';
import {
  SupplierLedgerService,
  SupplierTotals,
} from './supplier-ledger.service';
import {
  SupplierLedgerEntry,
  SupplierLedgerEntryType,
} from './entities/supplier-ledger-entry.entity';
import { RecordSupplierPaymentDto } from './dto/supplier-payment.dto';

@Controller('suppliers')
@UseGuards(SessionAuthGuard)
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Post()
  async create(@Body() createDto: CreateSupplierDto): Promise<Supplier> {
    return this.suppliersService.create(createDto);
  }

  @Get()
  async findAll(): Promise<Supplier[]> {
    return this.suppliersService.findAll();
  }

  @Get('with-totals')
  async findAllWithTotals(): Promise<SupplierWithTotals[]> {
    return this.suppliersService.findAllWithTotals();
  }

  @Get('active')
  async findActive(): Promise<Supplier[]> {
    return this.suppliersService.findActive();
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<Supplier> {
    return this.suppliersService.findOne(id);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateSupplierDto,
  ): Promise<Supplier> {
    return this.suppliersService.update(id, updateDto);
  }

  @Delete(':id')
  async delete(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.suppliersService.delete(id);
  }
}

@Controller('suppliers/:supplierId')
@UseGuards(SessionAuthGuard)
export class SupplierLedgerController {
  constructor(
    private readonly suppliersService: SuppliersService,
    private readonly ledgerService: SupplierLedgerService,
  ) {}

  @Get('ledger')
  async getLedger(
    @Param('supplierId', ParseIntPipe) supplierId: number,
  ): Promise<SupplierLedgerEntry[]> {
    return this.ledgerService.getLedger(supplierId);
  }

  @Get('totals')
  async getTotals(
    @Param('supplierId', ParseIntPipe) supplierId: number,
  ): Promise<SupplierTotals> {
    return this.ledgerService.getTotals(supplierId);
  }

  @Get('ledger/recent')
  async getRecentLedger(
    @Param('supplierId', ParseIntPipe) supplierId: number,
  ): Promise<SupplierLedgerEntry[]> {
    return this.suppliersService.getRecentLedger(supplierId, 10);
  }

  @Post('payments')
  async recordPayment(
    @Param('supplierId', ParseIntPipe) supplierId: number,
    @Body() dto: RecordSupplierPaymentDto,
    @Req() req: { session?: { username?: string } },
  ): Promise<SupplierLedgerEntry> {
    return this.ledgerService.recordPayment(
      supplierId,
      dto,
      req.session?.username,
    );
  }
}

// Re-export so existing imports keep working.
export { SupplierLedgerEntryType };
