import { Injectable, Inject, NotFoundException, ForbiddenException } from "@nestjs/common";
import { PrismaClient } from "@payflow/database";
import { PRISMA_TOKEN } from "../database/database.module";
import { AuditService } from "../audit/audit.service";
import { generateApiKey, CreateApiKeyDto } from "@payflow/shared";

@Injectable()
export class ApiKeysService {
    constructor(
        @Inject(PRISMA_TOKEN) private readonly prisma: PrismaClient,
        private readonly audit: AuditService,
    ) {}

    async create(orgId: string, dto: CreateApiKeyDto, actorId?: string, actorEmail?: string) {
        const { key, keyHash, keyPrefix } = generateApiKey();

        const apiKey = await this.prisma.apiKey.create({
            data: {
                orgId,
                name: dto.name,
                keyHash,
                keyPrefix,
                permissions: dto.permissions,
                rateLimit: dto.rateLimit,
                expiresAt: dto.expiresAt,
            },
        });

        await this.audit.log({
            orgId, actorId, actorEmail,
            action: "api_key.created",
            resourceType: "api_key",
            resourceId: apiKey.id,
            after: { name: apiKey.name, permissions: apiKey.permissions },
        });

        // Return the plaintext key ONCE — never stored
        return {
            id: apiKey.id,
            name: apiKey.name,
            key, // Only returned here!
            keyPrefix: apiKey.keyPrefix,
            permissions: apiKey.permissions,
            rateLimit: apiKey.rateLimit,
            expiresAt: apiKey.expiresAt,
            createdAt: apiKey.createdAt,
        };
    }

    async findAll(orgId: string) {
        const keys = await this.prisma.apiKey.findMany({
            where: { orgId, revokedAt: null },
            orderBy: { createdAt: "desc" },
            select: {
                id: true,
                name: true,
                keyPrefix: true,
                permissions: true,
                rateLimit: true,
                lastUsedAt: true,
                expiresAt: true,
                createdAt: true,
            },
        });
        return keys;
    }

    async revoke(orgId: string, id: string, actorId?: string, actorEmail?: string) {
        const key = await this.prisma.apiKey.findFirst({ where: { id, orgId } });
        if (!key) throw new NotFoundException(`API key ${id} not found`);
        if (key.revokedAt) throw new ForbiddenException("API key is already revoked");

        await this.prisma.apiKey.update({
            where: { id },
            data: { revokedAt: new Date() },
        });

        await this.audit.log({
            orgId, actorId, actorEmail,
            action: "api_key.revoked",
            resourceType: "api_key",
            resourceId: id,
            after: { revokedAt: new Date().toISOString() },
        });
    }
}
