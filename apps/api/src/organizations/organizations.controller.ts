import { Controller, Get, Post, Delete, Body, Param, UseGuards, Version, HttpCode, HttpStatus } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { OrganizationsService } from "./organizations.service";
import { AuthGuard } from "@nestjs/passport";
import { RolesGuard } from "../auth/guards/roles.guard";
import { CurrentUser, AuthenticatedUser, Roles } from "../auth/decorators/auth.decorators";
import { MemberRole } from "@payflow/shared";
import { IsEmail, IsEnum } from "class-validator";

class InviteMemberDto {
    @IsEmail()
    email!: string;

    @IsEnum(MemberRole)
    role!: MemberRole;
}

@ApiTags("organizations")
@ApiBearerAuth()
@UseGuards(AuthGuard("jwt"), RolesGuard)
@Controller("organizations")
export class OrganizationsController {
    constructor(private readonly orgsService: OrganizationsService) {}

    @Get("me")
    @Version("1")
    @ApiOperation({ summary: "Get current organization" })
    getOrg(@CurrentUser() user: AuthenticatedUser): Promise<any> {
        return this.orgsService.getOrg(user.orgId);
    }

    @Get("me/metrics")
    @Version("1")
    @ApiOperation({ summary: "Get organization metrics for dashboard" })
    getMetrics(@CurrentUser() user: AuthenticatedUser) {
        return this.orgsService.getMetrics(user.orgId);
    }

    @Post("me/members")
    @Version("1")
    @Roles(MemberRole.ADMIN, MemberRole.OWNER)
    @ApiOperation({ summary: "Invite a member to the organization" })
    inviteMember(@Body() dto: InviteMemberDto, @CurrentUser() user: AuthenticatedUser) {
        return this.orgsService.inviteMember(user.orgId, dto.email, dto.role, user.userId, user.email);
    }

    @Delete("me/members/:memberId")
    @Version("1")
    @HttpCode(HttpStatus.NO_CONTENT)
    @Roles(MemberRole.ADMIN, MemberRole.OWNER)
    @ApiOperation({ summary: "Remove a member" })
    removeMember(@Param("memberId") memberId: string, @CurrentUser() user: AuthenticatedUser) {
        return this.orgsService.removeMember(user.orgId, memberId, user.userId, user.email);
    }
}
