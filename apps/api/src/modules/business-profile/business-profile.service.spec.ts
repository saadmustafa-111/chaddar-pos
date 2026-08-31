import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BusinessProfileService } from './business-profile.service';
import { BusinessProfile } from './entities/business-profile.entity';

describe('BusinessProfileService', () => {
  let service: BusinessProfileService;
  let repo: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };

  beforeEach(async () => {
    repo = {
      findOne: jest.fn(),
      create: jest
        .fn()
        .mockImplementation((data: Partial<BusinessProfile>) => ({
          id: 1,
          ...data,
        })),
      save: jest
        .fn()
        .mockImplementation((entity: BusinessProfile) =>
          Promise.resolve({ ...entity, id: 1 }),
        ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BusinessProfileService,
        {
          provide: getRepositoryToken(BusinessProfile),
          useValue: repo,
        },
      ],
    }).compile();

    service = module.get<BusinessProfileService>(BusinessProfileService);
    jest.clearAllMocks();
  });

  it('should return existing profile when one is found', async () => {
    const existing: BusinessProfile = {
      id: 1,
      shopName: 'Khan Steel',
      address: 'Lahore',
      phone: '0300-0000000',
      taxNumber: 'NTN-123',
      footerMessage: 'Thank you',
      logoUrl: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    repo.findOne.mockResolvedValue(existing);

    const result = await service.getProfile();
    expect(result).toEqual(existing);
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('should create a default profile when none exists', async () => {
    repo.findOne.mockResolvedValue(null);
    const result = await service.getProfile();
    expect(result.shopName).toBe('SteelCoil POS');
    expect(result.footerMessage).toBe('Thank you for your business.');
    expect(repo.save).toHaveBeenCalled();
  });

  it('should update fields via updateProfile', async () => {
    const existing: BusinessProfile = {
      id: 1,
      shopName: 'Old',
      address: null,
      phone: null,
      taxNumber: null,
      footerMessage: null,
      logoUrl: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    repo.findOne.mockResolvedValue(existing);

    const result = await service.updateProfile({
      shopName: 'New',
      phone: '0300-111',
      address: 'Karachi',
    });

    expect(result.shopName).toBe('New');
    expect(result.phone).toBe('0300-111');
    expect(result.address).toBe('Karachi');
    expect(result.taxNumber).toBeNull();
  });
});
