import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Supplier } from './entities/supplier.entity';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';

@Injectable()
export class SuppliersService {
  constructor(
    @InjectRepository(Supplier)
    private readonly supplierRepository: Repository<Supplier>,
    private readonly dataSource: DataSource,
  ) {}

  private async generateCode(): Promise<string> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const result = (await queryRunner.query(`
        SELECT MAX(CAST(SUBSTR(code, 5) AS INTEGER)) as max_num
        FROM suppliers
        WHERE code LIKE 'SUP-%'
      `)) as Array<{ max_num: number | null }>;
      const maxNum = result[0]?.max_num ?? 0;
      const nextNum = maxNum + 1;
      const code = `SUP-${String(nextNum).padStart(5, '0')}`;
      await queryRunner.commitTransaction();
      return code;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async create(createDto: CreateSupplierDto): Promise<Supplier> {
    const code = await this.generateCode();

    const supplier = this.supplierRepository.create({
      ...createDto,
      code,
      isActive: createDto.isActive ?? true,
    });

    return this.supplierRepository.save(supplier);
  }

  async findAll(): Promise<Supplier[]> {
    return this.supplierRepository.find({
      order: { code: 'ASC' },
    });
  }

  async findActive(): Promise<Supplier[]> {
    return this.supplierRepository.find({
      where: { isActive: true },
      order: { code: 'ASC' },
    });
  }

  async findOne(id: number): Promise<Supplier> {
    const supplier = await this.supplierRepository.findOne({
      where: { id },
    });

    if (!supplier) {
      throw new NotFoundException('Supplier not found');
    }

    return supplier;
  }

  async update(id: number, updateDto: UpdateSupplierDto): Promise<Supplier> {
    const supplier = await this.findOne(id);

    Object.assign(supplier, updateDto);

    return this.supplierRepository.save(supplier);
  }
}
