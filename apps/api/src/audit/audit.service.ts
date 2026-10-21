import { Injectable, Inject } from "@nestjs/common";
import { PrismaClient } from "@payflow/database";
import { PRISMA_TOKEN } from "../database/database.module";

export interface AuditLogEntry {
    orgId: string;
    actorId?: string;
    actorEmail?: string;
    action: string;
    resourceType: string;
    resourceId: string;
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
    ipAddress?: string;
    userAgent?: string;
    metadata?: Record<string, unknown>;
}

@Injectable()
export class AuditService {
    constructor(@Inject(PRISMA_TOKEN) private readonly prisma: PrismaClient) {}

    /**
     * IMMUTABLE append-only audit log write.
     * Never throws — audit failures must not break the main request.
     */
    async log(entry: AuditLogEntry): Promise<void> {
        try {
            await this.prisma.auditLog.create({ data: entry as any });
        } catch (err) {
            // Log error but do not propagate — audit failures are non-fatal
            console.error("[AuditService] Failed to write audit log:", err);
        }
    }

    async findMany(orgId: string, opts?: {
        resourceType?: string;
        resourceId?: string;
        action?: string;
        page?: number;
        pageSize?: number;
    }): Promise<any> {
        const page = opts?.page ?? 1;
        const pageSize = opts?.pageSize ?? 50;
        const skip = (page - 1) * pageSize;

        const where = {
            orgId,
            ...(opts?.resourceType ? { resourceType: opts.resourceType } : {}),
            ...(opts?.resourceId ? { resourceId: opts.resourceId } : {}),
            ...(opts?.action ? { action: opts.action } : {}),
        };

        const [data, total] = await Promise.all([
            this.prisma.auditLog.findMany({
                where,
                orderBy: { createdAt: "desc" },
                take: pageSize,
                skip,
            }),
            this.prisma.auditLog.count({ where }),
        ]);

        return {
            data,
            meta: {
                total,
                page,
                pageSize,
                totalPages: Math.ceil(total / pageSize),
                hasNextPage: page * pageSize < total,
                hasPrevPage: page > 1,
            },
        };
    }
}
