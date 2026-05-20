import { z } from "zod";

// ─── Register ─────────────────────────────────────────────────────────────────

export const RegisterSchema = z.object({
    email: z
        .string()
        .email("Must be a valid email address")
        .max(255)
        .toLowerCase()
        .trim(),
    password: z
        .string()
        .min(8, "Password must be at least 8 characters")
        .max(72, "Password must be at most 72 characters")
        .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
        .regex(/[a-z]/, "Password must contain at least one lowercase letter")
        .regex(/[0-9]/, "Password must contain at least one number"),
    fullName: z.string().min(2, "Full name is required").max(100).trim(),
    orgName: z
        .string()
        .min(2, "Organization name must be at least 2 characters")
        .max(100)
        .trim()
        .optional(),
});

export type RegisterDto = z.infer<typeof RegisterSchema>;

// ─── Login ────────────────────────────────────────────────────────────────────

export const LoginSchema = z.object({
    email: z.string().email().toLowerCase().trim(),
    password: z.string().min(1, "Password is required"),
});

export type LoginDto = z.infer<typeof LoginSchema>;

// ─── Change Password ──────────────────────────────────────────────────────────

export const ChangePasswordSchema = z
    .object({
        currentPassword: z.string().min(1, "Current password is required"),
        newPassword: z
            .string()
            .min(8)
            .max(72)
            .regex(/[A-Z]/, "Must contain uppercase")
            .regex(/[a-z]/, "Must contain lowercase")
            .regex(/[0-9]/, "Must contain a number"),
        confirmPassword: z.string(),
    })
    .refine((data) => data.newPassword === data.confirmPassword, {
        message: "Passwords do not match",
        path: ["confirmPassword"],
    });

export type ChangePasswordDto = z.infer<typeof ChangePasswordSchema>;

// ─── Create API Key ───────────────────────────────────────────────────────────

export const CreateApiKeySchema = z.object({
    name: z.string().min(2, "Name must be at least 2 characters").max(100).trim(),
    permissions: z
        .array(
            z.enum([
                "payments:read",
                "payments:write",
                "webhooks:read",
                "webhooks:write",
            ])
        )
        .min(1, "At least one permission is required"),
    rateLimit: z.number().int().min(100).max(100_000).optional().default(1000),
    expiresAt: z.coerce.date().optional(),
});

export type CreateApiKeyDto = z.infer<typeof CreateApiKeySchema>;
