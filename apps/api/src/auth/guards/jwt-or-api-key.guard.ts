import { Injectable, CanActivate, ExecutionContext } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { Observable } from "rxjs";

/**
 * Accepts EITHER a valid JWT Bearer token OR an X-API-Key header.
 * Use on most endpoints to support both users (dashboard) and programmatic access.
 */
@Injectable()
export class JwtOrApiKeyGuard implements CanActivate {
    private readonly jwtGuard = new (AuthGuard("jwt"))();
    private readonly apiKeyGuard = new (AuthGuard("api-key"))();

    canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
        const req = context.switchToHttp().getRequest<{ headers: Record<string, string> }>();
        const hasApiKey = !!req.headers["x-api-key"];

        if (hasApiKey) {
            return this.apiKeyGuard.canActivate(context) as Promise<boolean>;
        }
        return this.jwtGuard.canActivate(context) as Promise<boolean>;
    }
}
