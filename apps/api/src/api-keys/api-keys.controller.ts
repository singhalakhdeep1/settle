import {
    Controller, Get, Post, Delete, Body, Param, UseGuards, Version, HttpCode, HttpStatus,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { ApiKeysService } from "./api-keys.service";
import { AuthGuard } from "@nestjs/passport";
import { RolesGuard } from "../auth/guards/roles.guard";
import { CurrentUser, AuthenticatedUser, Roles } from "../auth/decorators/auth.decorators";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { CreateApiKeySchema, CreateApiKeyDto, MemberRole } from "@payflow/shared";

@ApiTags("api-keys")
@ApiBearerAuth()
@UseGuards(AuthGuard("jwt"), RolesGuard)  // API key management is JWT-only
@Controller("api-keys")
export class ApiKeysController {
    constructor(private readonly apiKeysService: ApiKeysService) {}

    @Post()
    @Version("1")
    @Roles(MemberRole.ADMIN, MemberRole.OWNER)
    @ApiOperation({ summary: "Create a new API key" })
    create(
        @Body(new ZodValidationPipe(CreateApiKeySchema)) dto: CreateApiKeyDto,
        @CurrentUser() user: AuthenticatedUser,
    ) {
        return this.apiKeysService.create(user.orgId, dto, user.userId, user.email);
    }

    @Get()
    @Version("1")
    @ApiOperation({ summary: "List API keys (no secrets returned)" })
    findAll(@CurrentUser() user: AuthenticatedUser) {
        return this.apiKeysService.findAll(user.orgId);
    }

    @Delete(":id")
    @Version("1")
    @HttpCode(HttpStatus.NO_CONTENT)
    @Roles(MemberRole.ADMIN, MemberRole.OWNER)
    @ApiOperation({ summary: "Revoke an API key" })
    revoke(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
        return this.apiKeysService.revoke(user.orgId, id, user.userId, user.email);
    }
}
