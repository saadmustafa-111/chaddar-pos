import {
  Injectable,
  UnauthorizedException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as argon2 from 'argon2';
import { ConfigService } from '@nestjs/config';
import { AdminSettings } from './entities/admin-settings.entity';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

@Injectable()
export class AuthService implements OnModuleInit {
  constructor(
    @InjectRepository(AdminSettings)
    private readonly adminRepository: Repository<AdminSettings>,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit() {
    await this.initializeAdmin();
  }

  private async initializeAdmin(): Promise<void> {
    const existingAdmin = await this.adminRepository.findOne({
      where: {},
    });

    if (existingAdmin) {
      return;
    }

    const initialPassword = this.configService.get<string>(
      'INITIAL_ADMIN_PASSWORD',
    );

    if (!initialPassword) {
      throw new Error(
        'INITIAL_ADMIN_PASSWORD environment variable is not set. Please set it before starting the application.',
      );
    }

    const passwordHash = await argon2.hash(initialPassword);

    const admin = this.adminRepository.create({
      passwordHash,
    });

    await this.adminRepository.save(admin);
  }

  async login(loginDto: LoginDto): Promise<{ authenticated: boolean }> {
    const admin = await this.adminRepository.findOne({ where: {} });

    if (!admin) {
      throw new UnauthorizedException('Invalid password');
    }

    const isPasswordValid = await argon2.verify(
      admin.passwordHash,
      loginDto.password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid password');
    }

    return { authenticated: true };
  }

  async changePassword(
    changePasswordDto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    const admin = await this.adminRepository.findOne({ where: {} });

    if (!admin) {
      throw new UnauthorizedException('Invalid password');
    }

    const isCurrentPasswordValid = await argon2.verify(
      admin.passwordHash,
      changePasswordDto.currentPassword,
    );

    if (!isCurrentPasswordValid) {
      throw new UnauthorizedException('Invalid password');
    }

    if (changePasswordDto.newPassword !== changePasswordDto.confirmPassword) {
      throw new UnauthorizedException('New passwords do not match');
    }

    const newPasswordHash = await argon2.hash(changePasswordDto.newPassword);

    admin.passwordHash = newPasswordHash;
    await this.adminRepository.save(admin);

    return { message: 'Password changed successfully' };
  }
}
