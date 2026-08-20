import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { MaterialFamily } from './entities/material-family.entity';
import { CreateMaterialFamilyDto } from './dto/create-material-family.dto';
import { UpdateMaterialFamilyDto } from './dto/update-material-family.dto';

@Injectable()
export class MaterialFamiliesService {
  constructor(
    @InjectRepository(MaterialFamily)
    private readonly materialFamilyRepository: Repository<MaterialFamily>,
    private readonly dataSource: DataSource,
  ) {}

  private async generateCode(): Promise<string> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const result = (await queryRunner.query(`
        SELECT MAX(CAST(SUBSTR(code, 5) AS INTEGER)) as max_num
        FROM material_families
        WHERE code LIKE 'FAM-%'
      `)) as Array<{ max_num: number | null }>;
      const maxNum = result[0]?.max_num ?? 0;
      const nextNum = maxNum + 1;
      const code = `FAM-${String(nextNum).padStart(5, '0')}`;
      await queryRunner.commitTransaction();
      return code;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async create(createDto: CreateMaterialFamilyDto): Promise<MaterialFamily> {
    const existing = await this.materialFamilyRepository.findOne({
      where: { name: createDto.name },
    });

    if (existing) {
      throw new ConflictException(
        'Material family with this name already exists',
      );
    }

    const code = createDto.code || (await this.generateCode());

    const family = this.materialFamilyRepository.create({
      ...createDto,
      name: createDto.name.trim(),
      code,
      isActive: createDto.isActive ?? true,
    });

    return this.materialFamilyRepository.save(family);
  }

  async findAll(): Promise<MaterialFamily[]> {
    return this.materialFamilyRepository.find({
      order: { name: 'ASC' },
    });
  }

  async findActive(): Promise<MaterialFamily[]> {
    return this.materialFamilyRepository.find({
      where: { isActive: true },
      order: { name: 'ASC' },
    });
  }

  async findOne(id: number): Promise<MaterialFamily> {
    const family = await this.materialFamilyRepository.findOne({
      where: { id },
    });

    if (!family) {
      throw new NotFoundException('Material family not found');
    }

    return family;
  }

  async update(
    id: number,
    updateDto: UpdateMaterialFamilyDto,
  ): Promise<MaterialFamily> {
    const family = await this.findOne(id);

    if (updateDto.name && updateDto.name !== family.name) {
      const existing = await this.materialFamilyRepository.findOne({
        where: { name: updateDto.name },
      });

      if (existing && existing.id !== id) {
        throw new ConflictException(
          'Material family with this name already exists',
        );
      }
    }

    if (updateDto.name !== undefined) {
      (updateDto as { name?: string }).name = updateDto.name.trim();
    }

    Object.assign(family, updateDto);

    return this.materialFamilyRepository.save(family);
  }
}
