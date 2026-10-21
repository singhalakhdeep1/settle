import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { Strategy } = require("passport") as { Strategy: any };
import { AuthService } from "../auth.service";
import type { Request } from "express";

// Custom Passport strategy for API key authentication
class ApiKeyPassportStrategy extends Strategy {
    name = "api-key";

    constructor(private verify: (key: string) => Promise<unknown>) {
        super();
    }

    authenticate(req: Request) {
        const self = this as any;
        const key = req.headers["x-api-key"] as string | undefined;
        if (!key) {
            return self.fail({ message: "X-API-Key header is required" }, 401);
        }

        this.verify(key)
            .then((result) => {
                if (!result) {
                    return self.fail({ message: "Invalid or revoked API key" }, 401);
                }
                self.success(result);
            })
            .catch((err: Error) => self.error(err));
    }

    validate() { return true; }
}

@Injectable()
export class ApiKeyStrategy extends (PassportStrategy(ApiKeyPassportStrategy, "api-key") as any) {
    constructor(private readonly authService: AuthService) {
        super(async (key: string) => {
            const apiKey = await authService.validateApiKey(key);
            if (!apiKey) throw new UnauthorizedException("Invalid API key");
            return {
                apiKeyId: apiKey.id,
                orgId: apiKey.orgId,
                permissions: apiKey.permissions,
                rateLimit: apiKey.rateLimit,
                isApiKey: true,
            };
        });
    }
}
