import {
    Injectable,
    UnauthorizedException,
    ConflictException,
    NotFoundException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { Inject } from "@nestjs/common";
import { PrismaClient, MemberRole } from "@payflow/database";
import { PRISMA_TOKEN } from "../database/database.module";
import { RegisterDto, LoginDto, JwtPayload } from "@payflow/shared";
import * as bcrypt from "bcryptjs";
import { randomBytes } from "crypto";

@Injectable()
export class AuthService {
    constructor(
        @Inject(PRISMA_TOKEN) private readonly prisma: PrismaClient,
        private readonly jwtService: JwtService,
        private readonly config: ConfigService,
    ) {}

    async register(dto: RegisterDto): Promise<any> {
        const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
        if (existing) {
            throw new ConflictException("An account with this email already exists");
        }

        const passwordHash = await bcrypt.hash(dto.password, 12);
        const slug = await this.generateOrgSlug(dto.orgName ?? dto.fullName.split(" ")[0]!);

        const result = await this.prisma.$transaction(async (tx) => {
            const user = await tx.user.create({
                data: {
                    email: dto.email,
                    passwordHash,
                    fullName: dto.fullName,
                },
            });

            const org = await tx.organization.create({
                data: {
                    name: dto.orgName ?? `${dto.fullName}'s Organization`,
                    slug,
                },
            });

            await tx.organizationMember.create({
                data: { orgId: org.id, userId: user.id, role: MemberRole.OWNER },
            });

            return { user, org };
        });

        const token = this.signToken(result.user.id, result.user.email, result.org.id, MemberRole.OWNER as any);
        return { user: this.sanitizeUser(result.user), org: result.org, token };
    }

    async login(dto: LoginDto): Promise<any> {
        const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
        if (!user) throw new UnauthorizedException("Invalid credentials");

        const valid = await bcrypt.compare(dto.password, user.passwordHash);
        if (!valid) throw new UnauthorizedException("Invalid credentials");

        // Get active org membership
        const membership = await this.prisma.organizationMember.findFirst({
            where: { userId: user.id },
            include: { organization: true },
            orderBy: { createdAt: "asc" },
        });

        if (!membership) throw new UnauthorizedException("No active organization found");

        const token = this.signToken(user.id, user.email, membership.orgId, membership.role as any);
        return {
            user: this.sanitizeUser(user),
            org: membership.organization,
            role: membership.role,
            token,
        };
    }

    async validateApiKey(rawKey: string): Promise<any> {
        const { hashApiKey } = await import("@payflow/shared");
        const keyHash = hashApiKey(rawKey);
        const apiKey = await this.prisma.apiKey.findUnique({
            where: { keyHash },
            include: { organization: true },
        });

        if (!apiKey) return null;
        if (apiKey.revokedAt) return null;
        if (apiKey.expiresAt && apiKey.expiresAt < new Date()) return null;

        // Update lastUsedAt (fire-and-forget)
        this.prisma.apiKey.update({
            where: { id: apiKey.id },
            data: { lastUsedAt: new Date() },
        }).catch(() => {});

        return apiKey;
    }

    private signToken(userId: string, email: string, orgId: string, role: any): string {
        const payload: Omit<JwtPayload, "iat" | "exp"> = { sub: userId, email, orgId, role };
        return this.jwtService.sign(payload);
    }

    private sanitizeUser(user: { id: string; email: string; fullName: string; avatarUrl: string | null; emailVerified: boolean; createdAt: Date }) {
        const { ...safe } = user;
        return safe;
    }

    private async generateOrgSlug(base: string): Promise<string> {
        const baseSlug = base
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "")
            .slice(0, 40);

        let slug = baseSlug;
        let attempt = 0;

        while (true) {
            const existing = await this.prisma.organization.findUnique({ where: { slug } });
            if (!existing) return slug;
            attempt++;
            slug = `${baseSlug}-${randomBytes(3).toString("hex")}`;
            if (attempt > 10) throw new Error("Could not generate unique slug");
        }
    }
}
