import { PassportStrategy } from '@nestjs/passport';
import { configService } from "../config/configuration";
import { ExtractJwt, Strategy } from 'passport-jwt';

export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: configService.getValue('JWT_TOKEN_SECRET'),
    });
  }

  async validate(payload) {
    return { userId: payload.sub };
  }
}
