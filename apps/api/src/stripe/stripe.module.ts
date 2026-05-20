import { Module } from "@nestjs/common";
import { StripeWebhookController } from "./stripe-webhook.controller";
import { WebhooksModule } from "../webhooks/webhooks.module";

@Module({
    imports: [WebhooksModule],
    controllers: [StripeWebhookController],
})
export class StripeModule { }
