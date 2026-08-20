import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Coil, InventoryStatus } from './entities/coil.entity';
import { InventoryMovement } from '../inventory-movements/entities/inventory-movement.entity';

export interface CoilFilters {
  search?: string;
  supplierId?: number;
  status?: InventoryStatus;
  dateFrom?: string;
  dateTo?: string;
}

@Injectable()
export class CoilsService {
  constructor(
    @InjectRepository(Coil)
    private readonly coilRepository: Repository<Coil>,
    @InjectRepository(InventoryMovement)
    private readonly movementRepository: Repository<InventoryMovement>,
  ) {}

  async findAll(filters?: CoilFilters): Promise<Coil[]> {
    const queryBuilder = this.coilRepository
      .createQueryBuilder('coil')
      .leftJoinAndSelect('coil.supplier', 'supplier')
      .leftJoinAndSelect('coil.purchase', 'purchase')
      .leftJoinAndSelect('coil.materialFamily', 'materialFamily')
      .orderBy('coil.createdAt', 'DESC');

    if (filters?.supplierId) {
      queryBuilder.andWhere('coil.supplierId = :supplierId', {
        supplierId: filters.supplierId,
      });
    }

    if (filters?.status) {
      queryBuilder.andWhere('coil.status = :status', {
        status: filters.status,
      });
    }

    if (filters?.dateFrom) {
      queryBuilder.andWhere('coil.createdAt >= :dateFrom', {
        dateFrom: new Date(filters.dateFrom),
      });
    }

    if (filters?.dateTo) {
      queryBuilder.andWhere('coil.createdAt <= :dateTo', {
        dateTo: new Date(filters.dateTo),
      });
    }

    if (filters?.search) {
      const search = `%${filters.search}%`;
      queryBuilder.andWhere(
        '(coil.code LIKE :search OR coil.batchNumber LIKE :search OR purchase.code LIKE :search OR supplier.name LIKE :search)',
        { search },
      );
    }

    return queryBuilder.getMany();
  }

  async findOne(id: number): Promise<Coil> {
    const coil = await this.coilRepository.findOne({
      where: { id },
      relations: { supplier: true, purchase: true, materialFamily: true },
    });

    if (!coil) {
      throw new NotFoundException('Coil not found');
    }

    return coil;
  }

  async getMovements(coilId: number): Promise<InventoryMovement[]> {
    const coil = await this.findOne(coilId);

    return this.movementRepository.find({
      where: { coilId: coil.id },
      order: { createdAt: 'ASC' },
    });
  }
}
