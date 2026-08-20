import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';

interface SessionData {
  authenticated?: boolean;
}

@Injectable()
export class SessionAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const session = request.session as SessionData;

    if (session?.authenticated !== true) {
      throw new UnauthorizedException('Not authenticated');
    }

    return true;
  }
}
