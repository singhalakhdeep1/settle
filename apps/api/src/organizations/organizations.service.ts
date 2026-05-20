import { Injectable, Inject, NotFoundException, ConflictException } from "@nestjs/common";
import { PrismaClient, MemberRole } from "@payflow/database";
import { PRISMA_TOKEN } from "../database/database.module";
import { AuditService } from "../audit/audit.service";

@Injectable()
export class OrganizationsService {
    constructor(
        @Inject(PRISMA_TOKEN) private readonly prisma: PrismaClient,
        private readonly audit: AuditService,
    ) {}

    async getOrg(orgId: string) {
        const org = await this.prisma.organization.findUnique({
            where: { id: orgId },
            include: {
                members: {
                    include: { user: { select: { id: true, email: true, fullName: true, avatarUrl: true } } },
                },
            },
        });
        if (!org) throw new NotFoundException("Organization not found");
        return org;
    }

    async getMetrics(orgId: string) {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        const [totalPayments, successfulPayments, failedPayments, monthlyRevenue] = await Promise.all([
            this.prisma.paymentIntent.count({ where: { orgId } }),
            this.prisma.paymentIntent.count({ where: { orgId, status: "SUCCEEDED" } }),
            this.prisma.paymentIntent.count({ where: { orgId, status: "FAILED" } }),
            this.prisma.paymentIntent.aggregate({
                where: { orgId, status: "SUCCEEDED", capturedAt: { gte: startOfMonth } },
                _sum: { amountPaise: true },
            }),
        ]);

        const monthlyRevenuePaise = monthlyRevenue._sum.amountPaise ?? 0n;
        const { formatINR, paise_to_string } = await import("@payflow/shared");

        return {
            totalPayments,
            successfulPayments,
            failedPayments,
            successRate: totalPayments > 0
                ? Math.round((successfulPayments / totalPayments) * 100)
                : 0,
            monthlyRevenuePaise: paise_to_string(monthlyRevenuePaise),
            monthlyRevenueFormatted: formatINR(monthlyRevenuePaise),
        };
    }

    async inviteMember(orgId: string, email: string, role: MemberRole, actorId?: string, actorEmail?: string) {
        const user = await this.prisma.user.findUnique({ where: { email } });
        if (!user) throw new NotFoundException("User with this email does not exist");

        const existing = await this.prisma.organizationMember.findUnique({
            where: { orgId_userId: { orgId, userId: user.id } },
        });
        if (existing) throw new ConflictException("User is already a member");

        const membership = await this.prisma.organizationMember.create({
            data: { orgId, userId: user.id, role },
            include: { user: { select: { id: true, email: true, fullName: true } } },
        });

        await this.audit.log({
            orgId, actorId, actorEmail,
            action: "member.invited",
            resourceType: "organization_member",
            resourceId: membership.id,
            after: { email, role },
        });

        return membership;
    }

    async removeMember(orgId: string, memberId: string, actorId?: string, actorEmail?: string) {
        const member = await this.prisma.organizationMember.findFirst({
            where: { id: memberId, orgId },
        });
        if (!member) throw new NotFoundException("Member not found");
        if (member.role === MemberRole.OWNER) {
            throw new ConflictException("Cannot remove the organization owner");
        }

        await this.prisma.organizationMember.delete({ where: { id: memberId } });
        await this.audit.log({
            orgId, actorId, actorEmail,
            action: "member.removed",
            resourceType: "organization_member",
            resourceId: memberId,
        });
    }
}
