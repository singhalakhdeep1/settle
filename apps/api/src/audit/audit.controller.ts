import { Controller, Get, Query, UseGuards, Req, ParseIntPipe, DefaultValuePipe } from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt.guard";
import { AuditService } from "./audit.service";

@ApiTags("audit")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller({ path: "audit", version: "1" })
export class AuditController {
    constructor(private readonly auditService: AuditService) { }

    @Get()
    @ApiOperation({ summary: "List audit log entries for the authenticated organization" })
    async list(
        @Req() req: any,
        @Query("resourceType") resourceType?: string,
        @Query("resourceId") resourceId?: string,
        @Query("action") action?: string,
        @Query("page", new DefaultValuePipe(1), ParseIntPipe) page?: number,
        @Query("pageSize", new DefaultValuePipe(50), ParseIntPipe) pageSize?: number,
    ) {
        const orgId: string = req.user?.orgId;
        return this.auditService.findMany(orgId, {
            resourceType,
            resourceId,
            action,
            page,
            pageSize: Math.min(pageSize ?? 50, 100),
        });
    }
}
