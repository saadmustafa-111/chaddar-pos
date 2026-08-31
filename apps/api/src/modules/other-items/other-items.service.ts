import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OtherItem } from './entities/other-item.entity';
import { CreateOtherItemDto } from './dto/create-other-item.dto';
import { UpdateOtherItemDto } from './dto/update-other-item.dto';

@Injectable()
export class OtherItemsService {
  constructor(
    @InjectRepository(OtherItem)
    private readonly itemRepository: Repository<OtherItem>,
  ) {}

  async create(dto: CreateOtherItemDto): Promise<OtherItem> {
    const existing = await this.itemRepository.findOne({
      where: { name: dto.name.trim() },
    });
    if (existing) {
      throw new ConflictException(
        `An item with name "${dto.name}" already exists`,
      );
    }

    const item = this.itemRepository.create({
      name: dto.name.trim(),
      pricePaisa: dto.pricePaisa,
      note: dto.note?.trim() || null,
    });

    return this.itemRepository.save(item);
  }

  async findAll(search?: string): Promise<OtherItem[]> {
    const qb = this.itemRepository
      .createQueryBuilder('item')
      .orderBy('item.created_at', 'DESC');

    if (search && search.trim().length > 0) {
      qb.where('LOWER(item.name) LIKE LOWER(:search)', {
        search: `%${search.trim()}%`,
      });
    }

    return qb.getMany();
  }

  async findOne(id: number): Promise<OtherItem> {
    const item = await this.itemRepository.findOne({ where: { id } });
    if (!item) {
      throw new NotFoundException('Item not found');
    }
    return item;
  }

  async update(id: number, dto: UpdateOtherItemDto): Promise<OtherItem> {
    const item = await this.findOne(id);

    if (dto.name !== undefined) {
      const trimmedName = dto.name.trim();
      const existing = await this.itemRepository.findOne({
        where: { name: trimmedName },
      });
      if (existing && existing.id !== id) {
        throw new ConflictException(
          `An item with name "${trimmedName}" already exists`,
        );
      }
      item.name = trimmedName;
    }

    if (dto.pricePaisa !== undefined) {
      item.pricePaisa = dto.pricePaisa;
    }

    if (dto.note !== undefined) {
      item.note = dto.note?.trim() || null;
    }

    return this.itemRepository.save(item);
  }

  async delete(id: number): Promise<void> {
    const item = await this.findOne(id);
    await this.itemRepository.remove(item);
  }
}
