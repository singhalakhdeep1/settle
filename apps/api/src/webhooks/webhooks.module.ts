import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { ConfigService } from "@nestjs/config";
import { WebhooksController } from "./webhooks.controller";
import { WebhooksService } from "./webhooks.service";
import { WebhookDispatchService } from "./webhook-dispatch.service";
import { WebhookDeliveryProcessor } from "./webhook-delivery.processor";

export const WEBHOOK_QUEUE = "webhook-delivery";

@Module({
    imports: [
        BullModule.forRootAsync({
            inject: [ConfigService],
            useFactory: (config: ConfigService) => ({
                connection: { url: config.get<string>("app.redis.url") },
            }),
        }),
        BullModule.registerQueue({ name: WEBHOOK_QUEUE }),
    ],
    controllers: [WebhooksController],
    providers: [WebhooksService, WebhookDispatchService, WebhookDeliveryProcessor],
    exports: [WebhookDispatchService],
})
export class WebhooksModule {}
