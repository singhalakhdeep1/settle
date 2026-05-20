import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe, VersioningType } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import helmet from "helmet";
import * as compression from "compression";
import * as cookieParser from "cookie-parser";
import { AppModule } from "./app.module";

async function bootstrap() {
    const app = await NestFactory.create(AppModule, {
        logger: process.env.NODE_ENV === "production"
            ? ["error", "warn", "log"]
            : ["error", "warn", "log", "debug", "verbose"],
    });

    // ── Security middleware ──────────────────────────────────────────────────
    app.use(helmet({
        contentSecurityPolicy: process.env.NODE_ENV === "production",
    }));
    app.use(compression());
    app.use(cookieParser());

    // ── CORS ─────────────────────────────────────────────────────────────────
    app.enableCors({
        origin: process.env.WEB_URL ?? "http://localhost:3000",
        credentials: true,
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization", "X-API-Key", "Idempotency-Key"],
    });

    // ── API Versioning ────────────────────────────────────────────────────────
    app.enableVersioning({ type: VersioningType.URI });
    app.setGlobalPrefix("api");

    // ── Global Validation Pipe ────────────────────────────────────────────────
    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            transform: true,
            forbidNonWhitelisted: true,
            transformOptions: { enableImplicitConversion: true },
        }),
    );

    // ── Swagger / OpenAPI ────────────────────────────────────────────────────
    if (process.env.NODE_ENV !== "production") {
        const config = new DocumentBuilder()
            .setTitle("PayFlow API")
            .setDescription("Payment processing platform API")
            .setVersion("1.0")
            .addBearerAuth()
            .addApiKey({ type: "apiKey", in: "header", name: "X-API-Key" }, "api-key")
            .build();

        const document = SwaggerModule.createDocument(app, config);
        SwaggerModule.setup("api/docs", app, document, {
            swaggerOptions: { persistAuthorization: true },
        });
    }

    const port = Number(process.env.API_PORT) || 4000;
    await app.listen(port);
    console.log(`PayFlow API running on http://localhost:${port}`);
    if (process.env.NODE_ENV !== "production") {
        console.log(`Swagger docs: http://localhost:${port}/api/docs`);
    }
}

bootstrap();
