import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { OtherItemsService } from './other-items.service';
import { CreateOtherItemDto } from './dto/create-other-item.dto';
import { UpdateOtherItemDto } from './dto/update-other-item.dto';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { OtherItem } from './entities/other-item.entity';

@Controller('other-items')
@UseGuards(SessionAuthGuard)
export class OtherItemsController {
  constructor(private readonly otherItemsService: OtherItemsService) {}

  @Get()
  async findAll(@Query('search') search?: string): Promise<OtherItem[]> {
    return this.otherItemsService.findAll(search);
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<OtherItem> {
    return this.otherItemsService.findOne(id);
  }

  @Post()
  async create(@Body() createDto: CreateOtherItemDto): Promise<OtherItem> {
    return this.otherItemsService.create(createDto);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateOtherItemDto,
  ): Promise<OtherItem> {
    return this.otherItemsService.update(id, updateDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.otherItemsService.delete(id);
  }
}
