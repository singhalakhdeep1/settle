import { Injectable, Inject, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaClient } from "@payflow/database";
import {
    CreateWebhookEndpointDto,
    UpdateWebhookEndpointDto,
    generateWebhookSecret,
    encrypt,
    decrypt,
} from "@payflow/shared";
import { PRISMA_TOKEN } from "../database/database.module";
import { AuditService } from "../audit/audit.service";

@Injectable()
export class WebhooksService {
    constructor(
        @Inject(PRISMA_TOKEN) private readonly prisma: PrismaClient,
        private readonly config: ConfigService,
        private readonly audit: AuditService,
    ) {}

    private get encKey() {
        return this.config.get<string>("app.encryption.key")!;
    }

    async createEndpoint(orgId: string, dto: CreateWebhookEndpointDto, actorId?: string, actorEmail?: string) {
        const secret = generateWebhookSecret();
        const secretEnc = encrypt(secret, this.encKey);

        const endpoint = await this.prisma.webhookEndpoint.create({
            data: {
                orgId,
                url: dto.url,
                secretEnc,
                events: dto.events,
                description: dto.description,
                enabled: dto.enabled,
            },
        });

        await this.audit.log({
            orgId, actorId, actorEmail,
            action: "webhook_endpoint.created",
            resourceType: "webhook_endpoint",
            resourceId: endpoint.id,
            after: { url: endpoint.url, events: endpoint.events },
        });

        // Return the plaintext secret ONCE — never again
        return { ...endpoint, secret };
    }

    async findEndpoints(orgId: string) {
        const endpoints = await this.prisma.webhookEndpoint.findMany({
            where: { orgId },
            orderBy: { createdAt: "desc" },
        });
        // Never expose secretEnc — omit it
        return endpoints.map(({ secretEnc: _, ...e }) => e);
    }

    async findEndpoint(orgId: string, id: string) {
        const endpoint = await this.prisma.webhookEndpoint.findFirst({ where: { id, orgId } });
        if (!endpoint) throw new NotFoundException(`Webhook endpoint ${id} not found`);
        const { secretEnc: _, ...safe } = endpoint;
        return safe;
    }

    async updateEndpoint(orgId: string, id: string, dto: UpdateWebhookEndpointDto, actorId?: string, actorEmail?: string) {
        const endpoint = await this.prisma.webhookEndpoint.findFirst({ where: { id, orgId } });
        if (!endpoint) throw new NotFoundException(`Webhook endpoint ${id} not found`);

        const updated = await this.prisma.webhookEndpoint.update({
            where: { id },
            data: {
                ...(dto.url !== undefined ? { url: dto.url } : {}),
                ...(dto.events !== undefined ? { events: dto.events } : {}),
                ...(dto.description !== undefined ? { description: dto.description } : {}),
                ...(dto.enabled !== undefined ? { enabled: dto.enabled } : {}),
            },
        });

        await this.audit.log({
            orgId, actorId, actorEmail,
            action: "webhook_endpoint.updated",
            resourceType: "webhook_endpoint",
            resourceId: id,
        });

        const { secretEnc: _, ...safe } = updated;
        return safe;
    }

    async rotateSecret(orgId: string, id: string, actorId?: string, actorEmail?: string) {
        const endpoint = await this.prisma.webhookEndpoint.findFirst({ where: { id, orgId } });
        if (!endpoint) throw new NotFoundException(`Webhook endpoint ${id} not found`);

        const newSecret = generateWebhookSecret();
        const newSecretEnc = encrypt(newSecret, this.encKey);

        await this.prisma.webhookEndpoint.update({
            where: { id },
            data: { secretEnc: newSecretEnc },
        });

        await this.audit.log({
            orgId, actorId, actorEmail,
            action: "webhook_endpoint.secret_rotated",
            resourceType: "webhook_endpoint",
            resourceId: id,
        });

        return { secret: newSecret };
    }

    async deleteEndpoint(orgId: string, id: string, actorId?: string, actorEmail?: string) {
        const endpoint = await this.prisma.webhookEndpoint.findFirst({ where: { id, orgId } });
        if (!endpoint) throw new NotFoundException(`Webhook endpoint ${id} not found`);

        await this.prisma.webhookEndpoint.delete({ where: { id } });

        await this.audit.log({
            orgId, actorId, actorEmail,
            action: "webhook_endpoint.deleted",
            resourceType: "webhook_endpoint",
            resourceId: id,
        });
    }

    async findDeliveries(orgId: string, opts: {
        endpointId?: string;
        status?: string;
        page?: number;
        pageSize?: number;
    }) {
        const page = opts.page ?? 1;
        const pageSize = opts.pageSize ?? 20;
        const skip = (page - 1) * pageSize;

        // Verify endpoint belongs to org
        const where = {
            endpoint: { orgId },
            ...(opts.endpointId ? { endpointId: opts.endpointId } : {}),
            ...(opts.status ? { status: opts.status as "PENDING" | "DELIVERED" | "FAILED" | "DEAD_LETTER" } : {}),
        };

        const [data, total] = await Promise.all([
            this.prisma.webhookDelivery.findMany({
                where,
                orderBy: { createdAt: "desc" },
                take: pageSize,
                skip,
                include: { endpoint: { select: { url: true, orgId: true } } },
            }),
            this.prisma.webhookDelivery.count({ where }),
        ]);

        return {
            data,
            meta: { total, page, pageSize, totalPages: Math.ceil(total / pageSize), hasNextPage: page * pageSize < total, hasPrevPage: page > 1 },
        };
    }

    /** Get decrypted secret for internal signing — NOT exposed via API */
    async getDecryptedSecret(endpointId: string): Promise<string> {
        const endpoint = await this.prisma.webhookEndpoint.findUnique({ where: { id: endpointId } });
        if (!endpoint) throw new NotFoundException("Endpoint not found");
        return decrypt(endpoint.secretEnc, this.encKey);
    }
}
