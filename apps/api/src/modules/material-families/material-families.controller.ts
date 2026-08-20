import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { MaterialFamiliesService } from './material-families.service';
import { CreateMaterialFamilyDto } from './dto/create-material-family.dto';
import { UpdateMaterialFamilyDto } from './dto/update-material-family.dto';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { MaterialFamily } from './entities/material-family.entity';

@Controller('material-families')
@UseGuards(SessionAuthGuard)
export class MaterialFamiliesController {
  constructor(
    private readonly materialFamiliesService: MaterialFamiliesService,
  ) {}

  @Post()
  async create(
    @Body() createDto: CreateMaterialFamilyDto,
  ): Promise<MaterialFamily> {
    return this.materialFamiliesService.create(createDto);
  }

  @Get()
  async findAll(): Promise<MaterialFamily[]> {
    return this.materialFamiliesService.findAll();
  }

  @Get('active')
  async findActive(): Promise<MaterialFamily[]> {
    return this.materialFamiliesService.findActive();
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<MaterialFamily> {
    return this.materialFamiliesService.findOne(id);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateMaterialFamilyDto,
  ): Promise<MaterialFamily> {
    return this.materialFamiliesService.update(id, updateDto);
  }
}
