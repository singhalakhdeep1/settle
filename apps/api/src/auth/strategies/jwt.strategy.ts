import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { ConfigService } from "@nestjs/config";
import { JwtPayload } from "@payflow/shared";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, "jwt") {
    constructor(config: ConfigService) {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: config.get<string>("app.jwt.secret")!,
        });
    }

    validate(payload: JwtPayload) {
        if (!payload.sub || !payload.orgId) {
            throw new UnauthorizedException("Invalid token payload");
        }
        return {
            userId: payload.sub,
            email: payload.email,
            orgId: payload.orgId,
            role: payload.role,
        };
    }
}
