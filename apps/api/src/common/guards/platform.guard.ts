import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';

@Injectable()
export class PlatformGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const { user } = context.switchToHttp().getRequest();

    if (!user || user.role !== 'PLATFORM_OWNER') {
      throw new ForbiddenException('Only a PLATFORM_OWNER can access this resource.');
    }

    return true;
  }
}
