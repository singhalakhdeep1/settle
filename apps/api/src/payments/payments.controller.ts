import {
    Controller,
    Get,
    Post,
    Patch,
    Delete,
    Body,
    Param,
    Query,
    Headers,
    UseGuards,
    Version,
    HttpCode,
    HttpStatus,
    Req,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth, ApiSecurity } from "@nestjs/swagger";
import { PaymentsService } from "./payments.service";
import { JwtOrApiKeyGuard } from "../auth/guards/jwt-or-api-key.guard";
import { ApiKeyGuard } from "../auth/guards/api-key.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { CurrentUser, AuthenticatedUser, Roles, RequirePermissions } from "../auth/decorators/auth.decorators";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import {
    CreatePaymentIntentSchema,
    CreatePaymentIntentDto,
    UpdatePaymentIntentSchema,
    UpdatePaymentIntentDto,
    ConfirmPaymentIntentSchema,
    ConfirmPaymentIntentDto,
    CancelPaymentIntentSchema,
    CancelPaymentIntentDto,
    ListPaymentIntentsSchema,
    ListPaymentIntentsDto,
    MemberRole,
    validateIdempotencyKey,
} from "@payflow/shared";
import type { Request } from "express";

@ApiTags("payments")
@ApiBearerAuth()
@ApiSecurity("api-key")
@UseGuards(JwtOrApiKeyGuard, ApiKeyGuard, RolesGuard)
@Controller("payments")
export class PaymentsController {
    constructor(private readonly paymentsService: PaymentsService) {}

    @Post()
    @Version("1")
    @RequirePermissions("payments:write")
    @ApiOperation({ summary: "Create a payment intent (idempotent)" })
    create(
        @Body(new ZodValidationPipe(CreatePaymentIntentSchema)) dto: CreatePaymentIntentDto,
        @Headers("idempotency-key") rawKey: string,
        @CurrentUser() user: AuthenticatedUser,
        @Req() req: Request,
    ) {
        const idempotencyKey = validateIdempotencyKey(rawKey);
        return this.paymentsService.create(
            user.orgId,
            dto,
            idempotencyKey,
            user.userId,
            user.email,
            req.ip,
        );
    }

    @Get()
    @Version("1")
    @RequirePermissions("payments:read")
    @ApiOperation({ summary: "List payment intents" })
    findAll(
        @Query(new ZodValidationPipe(ListPaymentIntentsSchema)) query: ListPaymentIntentsDto,
        @CurrentUser() user: AuthenticatedUser,
    ) {
        return this.paymentsService.findAll(user.orgId, query);
    }

    @Get(":id")
    @Version("1")
    @RequirePermissions("payments:read")
    @ApiOperation({ summary: "Get a payment intent" })
    findOne(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
        return this.paymentsService.findOne(user.orgId, id);
    }

    @Patch(":id")
    @Version("1")
    @RequirePermissions("payments:write")
    @ApiOperation({ summary: "Update a payment intent" })
    update(
        @Param("id") id: string,
        @Body(new ZodValidationPipe(UpdatePaymentIntentSchema)) dto: UpdatePaymentIntentDto,
        @CurrentUser() user: AuthenticatedUser,
    ) {
        return this.paymentsService.update(user.orgId, id, dto, user.userId, user.email);
    }

    @Post(":id/confirm")
    @Version("1")
    @HttpCode(HttpStatus.OK)
    @RequirePermissions("payments:write")
    @ApiOperation({ summary: "Confirm a payment intent" })
    confirm(
        @Param("id") id: string,
        @Body(new ZodValidationPipe(ConfirmPaymentIntentSchema)) dto: ConfirmPaymentIntentDto,
        @CurrentUser() user: AuthenticatedUser,
    ) {
        return this.paymentsService.confirm(user.orgId, id, dto, user.userId, user.email);
    }

    @Delete(":id")
    @Version("1")
    @Roles(MemberRole.ADMIN, MemberRole.OWNER)
    @RequirePermissions("payments:write")
    @ApiOperation({ summary: "Cancel a payment intent" })
    cancel(
        @Param("id") id: string,
        @Body(new ZodValidationPipe(CancelPaymentIntentSchema)) dto: CancelPaymentIntentDto,
        @CurrentUser() user: AuthenticatedUser,
    ) {
        return this.paymentsService.cancel(user.orgId, id, dto, user.userId, user.email);
    }
}
