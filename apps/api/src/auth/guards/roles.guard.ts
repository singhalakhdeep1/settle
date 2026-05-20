import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { MemberRole } from "@payflow/shared";

export const ROLES_KEY = "roles";

// ─── RBAC Guard ──────────────────────────────────────────────────────────────

const ROLE_HIERARCHY: Record<MemberRole, number> = {
    [MemberRole.OWNER]: 3,
    [MemberRole.ADMIN]: 2,
    [MemberRole.VIEWER]: 1,
};

@Injectable()
export class RolesGuard implements CanActivate {
    constructor(private reflector: Reflector) { }

    canActivate(context: ExecutionContext): boolean {
        const requiredRoles = this.reflector.getAllAndOverride<MemberRole[]>(ROLES_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);

        if (!requiredRoles || requiredRoles.length === 0) return true;

        const req = context.switchToHttp().getRequest<{ user?: { role?: MemberRole; isApiKey?: boolean } }>();
        const user = req.user;

        // API key auth doesn't carry a role — default to VIEWER-level for RBAC
        if (user?.isApiKey) {
            const hasRole = requiredRoles.includes(MemberRole.VIEWER);
            if (!hasRole) throw new ForbiddenException("API keys cannot perform this action");
            return true;
        }

        if (!user?.role) throw new ForbiddenException("No role assigned");

        const userLevel = ROLE_HIERARCHY[user.role] ?? 0;
        const minRequired = Math.min(...requiredRoles.map((r) => ROLE_HIERARCHY[r] ?? 0));

        if (userLevel < minRequired) {
            throw new ForbiddenException(
                `Requires at least ${requiredRoles.join(" or ")} role`,
            );
        }

        return true;
    }
}
