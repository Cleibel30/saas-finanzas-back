// src/auth/jwt.strategy.ts
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import jwkToPem from 'jwk-to-pem';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor() {
        const jwk = {
            kty: "EC",
            crv: "P-256",
            x: "I_SHVKLqDq_cjlfcgqiP0_3ESzmKkYVA_G0xEZrnp6w",
            y: "eTBG0KEcVvSg_DXftY9WHUEKvhkQQ6IApak8OyfzzSs"
        };

        const pem = jwkToPem(jwk as any);

        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: pem,
            algorithms: ['ES256'], 
        });
    }

    async validate(payload: any) {
        return { userId: payload.sub, email: payload.email, name: payload.user_metadata?.name };
    }
}