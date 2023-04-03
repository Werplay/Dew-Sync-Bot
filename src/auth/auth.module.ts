 import { Module } from '@nestjs/common';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';

import { configService } from "../config/configuration";
import { JwtStrategy } from './jwt-auth.strategy';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      useFactory: async () => {
        return {
          signOptions: {
            expiresIn: configService.getValue('JWT_TOKEN_EXPIRES_IN'),
            issuer: configService.getValue('JWT_TOKEN_ISSUER')
          },
          secret: configService.getValue('JWT_TOKEN_SECRET'),
        };
      },
    }),
  ],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService, JwtStrategy],
 })
 export class AuthModule {}
