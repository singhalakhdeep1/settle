import { createParamDecorator, ExecutionContext, SetMetadata } from "@nestjs/common";
import { MemberRole, ApiKeyPermission } from "@payflow/shared";
import { ROLES_KEY } from "../guards/roles.guard";
import { PERMISSIONS_KEY } from "../guards/api-key.guard";

// ─── Current User decorator ───────────────────────────────────────────────────

export interface AuthenticatedUser {
    userId?: string;
    email?: string;
    orgId: string;
    role?: MemberRole;
    apiKeyId?: string;
    permissions?: string[];
    isApiKey?: boolean;
}

export const CurrentUser = createParamDecorator(
    (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
        const request = ctx.switchToHttp().getRequest<{ user: AuthenticatedUser }>();
        return request.user;
    },
);

// ─── Roles decorator ──────────────────────────────────────────────────────────

export const Roles = (...roles: MemberRole[]) => SetMetadata(ROLES_KEY, roles);

// ─── Permissions decorator (for API keys) ────────────────────────────────────

export const RequirePermissions = (...permissions: ApiKeyPermission[]) =>
    SetMetadata(PERMISSIONS_KEY, permissions);
