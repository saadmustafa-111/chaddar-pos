import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

interface SessionData {
  authenticated?: boolean;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto, @Req() req: Request) {
    await this.authService.login(loginDto);
    (req.session as SessionData).authenticated = true;
    // Persist the session before responding so the Set-Cookie header is
    // attached to the response (without this, `saveUninitialized: false`
    // means the cookie is never emitted for the very first login).
    await new Promise<void>((resolve, reject) => {
      req.session.save((err?: Error | null) => (err ? reject(err) : resolve()));
    });
    return { message: 'Login successful' };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req: Request): Promise<{ message: string }> {
    return new Promise((resolve, reject) => {
      req.session.destroy((err) => {
        if (err) {
          reject(new Error('Failed to destroy session'));
        }
        resolve({ message: 'Logout successful' });
      });
    });
  }

  @Get('session')
  getSession(@Req() req: Request): { authenticated: boolean } {
    const session = req.session as SessionData;
    return { authenticated: session?.authenticated === true };
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @Body() changePasswordDto: ChangePasswordDto,
    @Req() req: Request,
  ) {
    const session = req.session as SessionData;
    if (session?.authenticated !== true) {
      throw new Error('Not authenticated');
    }
    return this.authService.changePassword(changePasswordDto);
  }
}
