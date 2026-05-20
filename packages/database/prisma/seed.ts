/**
 * PayFlow — Database Seed
 *
 * Creates:
 *   - 2 demo users (owner + viewer)
 *   - 1 organization
 *   - 2 API keys
 *   - 5 payment intents (mixed statuses)
 *   - 1 webhook endpoint
 */

import { PrismaClient, Plan, MemberRole, PaymentIntentStatus, DeliveryStatus } from "@prisma/client";
import { createHash, randomBytes } from "crypto";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

function sha256(input: string): string {
    return createHash("sha256").update(input).digest("hex");
}

function generateApiKey(): string {
    return `pf_live_${randomBytes(24).toString("hex")}`;
}

async function main() {
    console.log("🌱 Seeding PayFlow database...");

    // ── Users ────────────────────────────────────────────────────────────────
    const passwordHash = await bcrypt.hash("password123", 12);

    const owner = await prisma.user.upsert({
        where: { email: "admin@acme.com" },
        update: {},
        create: {
            email: "admin@acme.com",
            passwordHash,
            fullName: "Arjun Mehta",
            emailVerified: true,
        },
    });

    const viewer = await prisma.user.upsert({
        where: { email: "dev@acme.com" },
        update: {},
        create: {
            email: "dev@acme.com",
            passwordHash,
            fullName: "Priya Sharma",
            emailVerified: true,
        },
    });

    console.log(`✅ Users: ${owner.email}, ${viewer.email}`);

    // ── Organization ─────────────────────────────────────────────────────────
    const org = await prisma.organization.upsert({
        where: { slug: "acme-corp" },
        update: {},
        create: {
            name: "ACME Corp",
            slug: "acme-corp",
            plan: Plan.GROWTH,
            metadata: { industry: "e-commerce", country: "IN" },
        },
    });

    // ── Members ──────────────────────────────────────────────────────────────
    await prisma.organizationMember.upsert({
        where: { orgId_userId: { orgId: org.id, userId: owner.id } },
        update: {},
        create: { orgId: org.id, userId: owner.id, role: MemberRole.OWNER },
    });

    await prisma.organizationMember.upsert({
        where: { orgId_userId: { orgId: org.id, userId: viewer.id } },
        update: {},
        create: { orgId: org.id, userId: viewer.id, role: MemberRole.VIEWER },
    });

    console.log(`✅ Organization: ${org.slug}`);

    // ── API Keys ─────────────────────────────────────────────────────────────
    const key1 = generateApiKey();
    const key2 = generateApiKey();

    await prisma.apiKey.createMany({
        skipDuplicates: true,
        data: [
            {
                orgId: org.id,
                name: "Production Key",
                keyHash: sha256(key1),
                keyPrefix: key1.slice(0, 12),
                permissions: ["payments:read", "payments:write", "webhooks:read", "webhooks:write"],
                rateLimit: 5000,
            },
            {
                orgId: org.id,
                name: "Read-Only Key",
                keyHash: sha256(key2),
                keyPrefix: key2.slice(0, 12),
                permissions: ["payments:read", "webhooks:read"],
                rateLimit: 1000,
            },
        ],
    });

    console.log(`✅ API Keys created`);
    console.log(`   Key 1 (full access): ${key1}`);
    console.log(`   Key 2 (read-only):   ${key2}`);

    // ── Payment Intents ───────────────────────────────────────────────────────
    const payments = [
        {
            orgId: org.id,
            idempotencyKey: "seed-pi-001",
            amountPaise: BigInt(99900),     // ₹999
            currency: "INR",
            status: PaymentIntentStatus.SUCCEEDED,
            description: "Premium subscription — annual",
            customerId: "cust_001",
            metadata: { product: "premium_annual", user_id: "usr_123" },
            capturedAt: new Date(Date.now() - 1000 * 60 * 60 * 2),
        },
        {
            orgId: org.id,
            idempotencyKey: "seed-pi-002",
            amountPaise: BigInt(4999),      // ₹49.99
            currency: "INR",
            status: PaymentIntentStatus.SUCCEEDED,
            description: "One-time purchase — T-shirt",
            customerId: "cust_002",
            metadata: { product: "tshirt_xl", order_id: "ord_456" },
            capturedAt: new Date(Date.now() - 1000 * 60 * 30),
        },
        {
            orgId: org.id,
            idempotencyKey: "seed-pi-003",
            amountPaise: BigInt(250000),    // ₹2500
            currency: "INR",
            status: PaymentIntentStatus.PROCESSING,
            description: "Course enrollment",
            customerId: "cust_003",
            metadata: { course_id: "crs_789" },
        },
        {
            orgId: org.id,
            idempotencyKey: "seed-pi-004",
            amountPaise: BigInt(15000),     // ₹150
            currency: "INR",
            status: PaymentIntentStatus.FAILED,
            description: "Mobile recharge",
            customerId: "cust_004",
            metadata: { phone: "+91xxxxxxxxxx" },
            failureReason: "insufficient_funds",
        },
        {
            orgId: org.id,
            idempotencyKey: "seed-pi-005",
            amountPaise: BigInt(599900),    // ₹5999
            currency: "INR",
            status: PaymentIntentStatus.REQUIRES_PAYMENT_METHOD,
            description: "Enterprise plan upgrade",
            customerId: "cust_005",
            metadata: { plan: "enterprise_monthly" },
        },
    ];

    for (const payment of payments) {
        await prisma.paymentIntent.upsert({
            where: { orgId_idempotencyKey: { orgId: payment.orgId, idempotencyKey: payment.idempotencyKey } },
            update: {},
            create: payment,
        });
    }

    console.log(`✅ Payment intents: ${payments.length} created`);

    // ── Webhook Endpoint ──────────────────────────────────────────────────────
    await prisma.webhookEndpoint.create({
        data: {
            orgId: org.id,
            url: "https://webhook.site/demo",
            secretEnc: "seed_webhook_secret_encrypted",
            events: ["payment.succeeded", "payment.failed"],
            description: "Demo webhook endpoint",
        },
    }).catch(() => {}); // ignore if already exists

    console.log(`✅ Webhook endpoint created`);

    // ── Audit Logs ────────────────────────────────────────────────────────────
    await prisma.auditLog.createMany({
        data: [
            {
                orgId: org.id,
                actorId: owner.id,
                actorEmail: owner.email,
                action: "organization.created",
                resourceType: "organization",
                resourceId: org.id,
                after: { name: org.name, slug: org.slug },
                ipAddress: "127.0.0.1",
            },
            {
                orgId: org.id,
                actorId: owner.id,
                actorEmail: owner.email,
                action: "api_key.created",
                resourceType: "api_key",
                resourceId: "seed-key-1",
                after: { name: "Production Key" },
                ipAddress: "127.0.0.1",
            },
        ],
    });

    console.log(`✅ Audit logs created`);
    console.log("\n🎉 Seed complete!");
    console.log(`\nLogin credentials:\n  Email:    admin@acme.com\n  Password: password123`);
}

main()
    .catch((e) => {
        console.error("❌ Seed failed:", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
