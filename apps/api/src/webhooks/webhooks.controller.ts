import {
    Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Version, HttpCode, HttpStatus,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth, ApiSecurity } from "@nestjs/swagger";
import { WebhooksService } from "./webhooks.service";
import { JwtOrApiKeyGuard } from "../auth/guards/jwt-or-api-key.guard";
import { ApiKeyGuard } from "../auth/guards/api-key.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { CurrentUser, AuthenticatedUser, Roles, RequirePermissions } from "../auth/decorators/auth.decorators";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import {
    CreateWebhookEndpointSchema, CreateWebhookEndpointDto,
    UpdateWebhookEndpointSchema, UpdateWebhookEndpointDto,
    ListWebhookDeliveriesSchema, ListWebhookDeliveriesDto,
    MemberRole,
} from "@payflow/shared";

@ApiTags("webhooks")
@ApiBearerAuth()
@ApiSecurity("api-key")
@UseGuards(JwtOrApiKeyGuard, ApiKeyGuard, RolesGuard)
@Controller("webhooks")
export class WebhooksController {
    constructor(private readonly webhooksService: WebhooksService) {}

    @Post("endpoints")
    @Version("1")
    @Roles(MemberRole.ADMIN, MemberRole.OWNER)
    @RequirePermissions("webhooks:write")
    @ApiOperation({ summary: "Create a webhook endpoint" })
    createEndpoint(
        @Body(new ZodValidationPipe(CreateWebhookEndpointSchema)) dto: CreateWebhookEndpointDto,
        @CurrentUser() user: AuthenticatedUser,
    ) {
        return this.webhooksService.createEndpoint(user.orgId, dto, user.userId, user.email);
    }

    @Get("endpoints")
    @Version("1")
    @RequirePermissions("webhooks:read")
    @ApiOperation({ summary: "List webhook endpoints" })
    findEndpoints(@CurrentUser() user: AuthenticatedUser) {
        return this.webhooksService.findEndpoints(user.orgId);
    }

    @Get("endpoints/:id")
    @Version("1")
    @RequirePermissions("webhooks:read")
    @ApiOperation({ summary: "Get a webhook endpoint" })
    findEndpoint(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
        return this.webhooksService.findEndpoint(user.orgId, id);
    }

    @Patch("endpoints/:id")
    @Version("1")
    @Roles(MemberRole.ADMIN, MemberRole.OWNER)
    @RequirePermissions("webhooks:write")
    @ApiOperation({ summary: "Update a webhook endpoint" })
    updateEndpoint(
        @Param("id") id: string,
        @Body(new ZodValidationPipe(UpdateWebhookEndpointSchema)) dto: UpdateWebhookEndpointDto,
        @CurrentUser() user: AuthenticatedUser,
    ) {
        return this.webhooksService.updateEndpoint(user.orgId, id, dto, user.userId, user.email);
    }

    @Post("endpoints/:id/rotate-secret")
    @Version("1")
    @HttpCode(HttpStatus.OK)
    @Roles(MemberRole.ADMIN, MemberRole.OWNER)
    @RequirePermissions("webhooks:write")
    @ApiOperation({ summary: "Rotate webhook endpoint secret" })
    rotateSecret(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
        return this.webhooksService.rotateSecret(user.orgId, id, user.userId, user.email);
    }

    @Delete("endpoints/:id")
    @Version("1")
    @HttpCode(HttpStatus.NO_CONTENT)
    @Roles(MemberRole.OWNER)
    @RequirePermissions("webhooks:write")
    @ApiOperation({ summary: "Delete a webhook endpoint" })
    deleteEndpoint(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
        return this.webhooksService.deleteEndpoint(user.orgId, id, user.userId, user.email);
    }

    @Get("deliveries")
    @Version("1")
    @RequirePermissions("webhooks:read")
    @ApiOperation({ summary: "List webhook deliveries" })
    findDeliveries(
        @Query(new ZodValidationPipe(ListWebhookDeliveriesSchema)) query: ListWebhookDeliveriesDto,
        @CurrentUser() user: AuthenticatedUser,
    ): Promise<any> {
        return this.webhooksService.findDeliveries(user.orgId, query);
    }
}
