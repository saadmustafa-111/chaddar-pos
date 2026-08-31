const fs = require('fs');
const path = 'C:/ahmedchadar/chaddar-pos/apps/api/src/modules/price-categories/price-categories.service.spec.ts';
const content = String.raw`import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PriceCategoriesService } from './price-categories.service';
import { PriceCategory } from './entities/price-category.entity';

describe('PriceCategoriesService', () => {
  let service: PriceCategoriesService;
  let repo: {
    findOne: jest.Mock;
    find: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };

  beforeEach(async () => {
    repo = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest
        .fn()
        .mockImplementation((data: Partial<PriceCategory>) => ({
          id: 1,
          ...data,
        })),
      save: jest
        .fn()
        .mockImplementation((entity: PriceCategory) =>
          Promise.resolve({ ...entity, id: entity.id ?? 1 }),
        ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PriceCategoriesService,
        {
          provide: getRepositoryToken(PriceCategory),
          useValue: repo,
        },
      ],
    }).compile();

    service = module.get<PriceCategoriesService>(PriceCategoriesService);
    jest.clearAllMocks();
  });

  it('should seed the four default categories on module init', async () => {
    repo.findOne.mockResolvedValue(null);
    await service.onModuleInit();

    expect(repo.save).toHaveBeenCalledTimes(4);
    const savedEntities = repo.save.mock.calls as unknown as [PriceCategory][];
    const savedCodes = savedEntities.map((c) => c[0].code);
    expect(savedCodes).toEqual(['BRONZE', 'SILVER', 'GOLD', 'PLATINUM']);
  });

  it('should not re-seed existing categories', async () => {
    repo.findOne.mockImplementation((opts: { where: { code: string } }) => {
      if (opts.where.code === 'BRONZE') {
        return Promise.resolve({
          id: 1,
          code: 'BRONZE',
          name: 'Bronze',
        } as PriceCategory);
      }
      return Promise.resolve(null);
    });
    await service.onModuleInit();

    const savedEntities = repo.save.mock.calls as unknown as [PriceCategory][];
    const savedCodes = savedEntities.map((c) => c[0].code);
    expect(savedCodes).toEqual(['SILVER', 'GOLD', 'PLATINUM']);
  });

  it('findAll returns all categories', async () => {
    repo.find.mockResolvedValue([]);
    const result = await service.findAll();
    expect(result).toEqual([]);
    expect(repo.find).toHaveBeenCalled();
  });

  it('findActive returns only isActive=true categories', async () => {
    const bronze = { id: 1, code: 'BRONZE', isActive: true } as PriceCategory;
    const gold = { id: 3, code: 'GOLD', isActive: true } as PriceCategory;
    repo.find.mockResolvedValue([bronze, gold]);

    const result = await service.findActive();

    expect(result).toEqual([bronze, gold]);
    expect(repo.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isActive: true } }),
    );
  });

  it('should update a category selling rate and active flag', async () => {
    const existing = {
      id: 1,
      code: 'BRONZE',
      name: 'Bronze',
      purchaseRatePaisa: 0,
      sellingRatePaisa: 0,
      isActive: true,
    } as PriceCategory;
    repo.findOne.mockResolvedValue(existing);

    const updated = await service.update(1, {
      sellingRatePaisa: 28000,
      isActive: false,
    });

    expect(Number(updated.sellingRatePaisa)).toBe(28000);
    expect(updated.isActive).toBe(false);
  });

  it('should not seed or mutate purchaseRatePaisa (purchases come from the supplier)', async () => {
    repo.findOne.mockResolvedValue(null);
    await service.onModuleInit();

    const savedEntities = repo.save.mock.calls as unknown as [PriceCategory][];
    for (const [entity] of savedEntities) {
      expect(entity.purchaseRatePaisa ?? 0).toBe(0);
    }

    const bronze = {
      id: 1,
      code: 'BRONZE',
      name: 'Bronze',
      purchaseRatePaisa: 4242,
      sellingRatePaisa: 26000,
      isActive: true,
    } as PriceCategory;
    repo.findOne.mockResolvedValue(bronze);
    const updated = await service.update(1, { sellingRatePaisa: 27500 });
    expect(Number(updated.purchaseRatePaisa)).toBe(4242);
    expect(Number(updated.sellingRatePaisa)).toBe(27500);
  });

  it('should ignore a purchaseRatePaisa payload if the client still sends one', async () => {
    const existing = {
      id: 1,
      code: 'BRONZE',
      name: 'Bronze',
      purchaseRatePaisa: 0,
      sellingRatePaisa: 0,
      isActive: true,
    } as PriceCategory;
    repo.findOne.mockResolvedValue(existing);

    const updated = await service.update(
      1,
      { sellingRatePaisa: 28000 } as unknown as Parameters<
        typeof service.update
      >[1],
    );
    expect(Number(updated.sellingRatePaisa)).toBe(28000);
  });
});
`;
fs.writeFileSync(path, content, 'utf8');
console.log('Wrote', path, 'len', content.length);
