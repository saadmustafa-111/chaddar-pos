import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { CustomersService } from './customers.service';
import {
  CreateCustomerDto,
  RecordPaymentDto,
  UpdateCustomerDto,
} from './dto/customer.dto';
import { Customer } from './entities/customer.entity';
import { CustomerLedgerEntry } from './entities/customer-ledger-entry.entity';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';

@Controller('customers')
@UseGuards(SessionAuthGuard)
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  async findAll(@Query('search') search?: string): Promise<Customer[]> {
    return this.customersService.findAll(search);
  }

  @Get('active')
  async findAllActive(): Promise<Customer[]> {
    return this.customersService.findAllActive();
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<Customer> {
    return this.customersService.findOne(id);
  }

  @Get(':id/ledger')
  async getLedger(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<CustomerLedgerEntry[]> {
    return this.customersService.getLedger(id);
  }

  @Get(':id/totals')
  async getTotals(@Param('id', ParseIntPipe) id: number): Promise<{
    totalSalesPaisa: number;
    totalPaidPaisa: number;
    outstandingPaisa: number;
  }> {
    return this.customersService.getTotals(id);
  }

  @Post()
  async create(@Body() createDto: CreateCustomerDto): Promise<Customer> {
    return this.customersService.create(createDto);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateCustomerDto,
  ): Promise<Customer> {
    return this.customersService.update(id, updateDto);
  }

  @Post(':id/payments')
  async recordPayment(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RecordPaymentDto,
  ): Promise<CustomerLedgerEntry> {
    return this.customersService.recordPayment(id, dto);
  }

  @Delete(':id')
  async delete(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.customersService.delete(id);
  }
}
