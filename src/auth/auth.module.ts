import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './jwt.strategy';
import { PrismaModule } from '@/prisma/prisma.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  imports: [PassportModule, PrismaModule],
  providers: [JwtStrategy, AuthService],
  controllers: [AuthController],
  exports: [JwtStrategy],
})
export class AuthModule {}