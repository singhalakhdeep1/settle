import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { Strategy } from "passport";
import { AuthService } from "../auth.service";
import type { Request } from "express";

// Custom Passport strategy for API key authentication
class ApiKeyPassportStrategy extends Strategy {
    name = "api-key";

    constructor(private verify: (key: string) => Promise<unknown>) {
        super();
    }

    authenticate(req: Request) {
        const key = req.headers["x-api-key"] as string | undefined;
        if (!key) {
            return this.fail({ message: "X-API-Key header is required" }, 401);
        }

        this.verify(key)
            .then((result) => {
                if (!result) {
                    return this.fail({ message: "Invalid or revoked API key" }, 401);
                }
                this.success(result);
            })
            .catch((err: Error) => this.error(err));
    }
}

@Injectable()
export class ApiKeyStrategy extends PassportStrategy(ApiKeyPassportStrategy, "api-key") {
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
