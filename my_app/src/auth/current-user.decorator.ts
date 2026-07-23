import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { JwtPayload } from './jwt-auth.guard';

// Lấy thông tin user đã được guard gắn vào request từ token.
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): JwtPayload => {
    const request = context.switchToHttp().getRequest<Request>();
    return request['user'] as JwtPayload;
  },
);
