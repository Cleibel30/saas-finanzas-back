import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import jwkToPem from 'jwk-to-pem';
import { SupabaseJwtPayload } from './interfaces/jwt-payload.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly expectedIssuer: string | undefined;
  private readonly expectedAudience: string;

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, '');
    const jwkX = process.env.SUPABASE_JWT_JWK_X;
    const jwkY = process.env.SUPABASE_JWT_JWK_Y;

    if (!jwkX || !jwkY) {
      throw new Error(
        'SUPABASE_JWT_JWK_X y SUPABASE_JWT_JWK_Y son obligatorios (coordenadas EC P-256 del proyecto Supabase).',
      );
    }

    const jwk = {
      kty: 'EC',
      crv: 'P-256',
      x: jwkX,
      y: jwkY,
    };

    const pem = jwkToPem(jwk as Parameters<typeof jwkToPem>[0]);

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: pem,
      algorithms: ['ES256'],
    });

    this.expectedIssuer =
      process.env.SUPABASE_JWT_ISSUER ??
      (supabaseUrl ? `${supabaseUrl}/auth/v1` : undefined);
    this.expectedAudience =
      process.env.SUPABASE_JWT_AUDIENCE ?? 'authenticated';
  }

  validate(payload: SupabaseJwtPayload) {
    if (!payload?.sub) {
      throw new UnauthorizedException('Token inválido');
    }

    if (
      this.expectedIssuer &&
      payload.iss &&
      payload.iss !== this.expectedIssuer
    ) {
      throw new UnauthorizedException('Emisor del token no válido');
    }

    if (payload.aud) {
      const audiences = Array.isArray(payload.aud)
        ? payload.aud
        : [payload.aud];
      if (!audiences.includes(this.expectedAudience)) {
        throw new UnauthorizedException('Audiencia del token no válida');
      }
    }

    return {
      userId: payload.sub,
      email: payload.email,
      name: payload.user_metadata?.name,
    };
  }
}
