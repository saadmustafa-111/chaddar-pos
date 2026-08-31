import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import {
  InventoryService,
  InventorySummary,
  FinishedStockRow,
  RawCoilRow,
} from './inventory.service';
import { FinishedChaddarStatus } from '../finished-chaddar-stock/entities/finished-chaddar-stock.entity';
import { InventoryStatus } from '../coils/entities/coil.entity';

@Controller('inventory')
@UseGuards(SessionAuthGuard)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  /**
   * Screen-ready totals (raw coil + finished chaddar) backed by SQL
   * aggregation. The UI calls this once per refresh.
   */
  @Get('summary')
  async getSummary(): Promise<InventorySummary> {
    return this.inventoryService.getSummary();
  }

  /**
   * Finished stock rows with category/size/gauge/status filters. Sold-out
   * rows are excluded by default because they are no longer sellable.
   */
  @Get('finished-stock')
  async listFinishedStock(
    @Query('search') search?: string,
    @Query('categoryId') categoryId?: string,
    @Query('sizeLabel') sizeLabel?: string,
    @Query('thicknessMm') thicknessMm?: string,
    @Query('status') status?: FinishedChaddarStatus,
    @Query('coilId') coilId?: string,
    @Query('includeSoldOut') includeSoldOut?: string,
  ): Promise<FinishedStockRow[]> {
    const filters = {
      search,
      categoryId: categoryId ? parseInt(categoryId, 10) : undefined,
      sizeLabel,
      thicknessMm:
        thicknessMm != null && thicknessMm !== ''
          ? parseFloat(thicknessMm)
          : undefined,
      status: status ?? undefined,
      coilId: coilId ? parseInt(coilId, 10) : undefined,
    };

    if (!filters.status && includeSoldOut !== 'true') {
      filters.status = undefined;
    }

    return this.inventoryService.listFinishedStock(filters);
  }

  /**
   * Distinct size labels and gauge values currently held in stock so the
   * filter UI can be data-driven.
   */
  @Get('finished-stock/facets')
  async getFinishedStockFacets(): Promise<{
    sizeLabels: string[];
    thicknessMm: number[];
  }> {
    return this.inventoryService.getFinishedStockFacets();
  }

  /**
   * Raw coils with light filters. Designed for the inventory overview tab;
   * the deep `/coils` endpoint stays for the procurement-side workflow.
   */
  @Get('raw-coils')
  async listRawCoils(
    @Query('search') search?: string,
    @Query('supplierId') supplierId?: string,
    @Query('status') status?: InventoryStatus,
    @Query('categoryId') categoryId?: string,
  ): Promise<RawCoilRow[]> {
    return this.inventoryService.listRawCoils({
      search,
      supplierId: supplierId ? parseInt(supplierId, 10) : undefined,
      status,
      categoryId: categoryId ? parseInt(categoryId, 10) : undefined,
    });
  }
}
