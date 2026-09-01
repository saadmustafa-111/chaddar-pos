import {
  Injectable,
  UnauthorizedException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
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

    const passwordHash = await bcrypt.hash(initialPassword, 10);

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

    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      admin.passwordHash,
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

    const isCurrentPasswordValid = await bcrypt.compare(
      changePasswordDto.currentPassword,
      admin.passwordHash,
    );

    if (!isCurrentPasswordValid) {
      throw new UnauthorizedException('Invalid password');
    }

    if (changePasswordDto.newPassword !== changePasswordDto.confirmPassword) {
      throw new UnauthorizedException('New passwords do not match');
    }

    const newPasswordHash = await bcrypt.hash(changePasswordDto.newPassword, 10);

    admin.passwordHash = newPasswordHash;
    await this.adminRepository.save(admin);

    return { message: 'Password changed successfully' };
  }
}
