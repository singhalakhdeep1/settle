"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { RegisterSchema } from "@payflow/shared";
import type { z } from "zod";
import { Button } from "@payflow/ui";
import { Input } from "@payflow/ui";
import apiClient from "@/lib/api-client";

type RegisterForm = z.infer<typeof RegisterSchema>;

export default function RegisterPage() {
    const router = useRouter();
    const [error, setError] = useState<string | null>(null);

    const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<RegisterForm>({
        resolver: zodResolver(RegisterSchema),
    });

    const onSubmit = async (data: RegisterForm) => {
        setError(null);
        try {
            await apiClient.post("/v1/auth/register", data);
            router.push("/login?registered=1");
        } catch (err: unknown) {
            const msg = (err instanceof Error) ? err.message : undefined;
            setError(msg ?? "Registration failed. Please try again.");
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="w-full max-w-md">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-gray-900">PayFlow</h1>
                    <p className="mt-2 text-gray-600">Create your account</p>
                </div>

                <div className="bg-white rounded-lg shadow p-8">
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                        {error && (
                            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
                                {error}
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Full name</label>
                            <Input placeholder="Jane Smith" {...register("fullName")} />
                            {errors.fullName && <p className="mt-1 text-xs text-red-600">{errors.fullName.message}</p>}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Organization name</label>
                            <Input placeholder="Acme Inc." {...register("orgName")} />
                            {errors.orgName && <p className="mt-1 text-xs text-red-600">{errors.orgName.message}</p>}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                            <Input type="email" placeholder="you@company.com" {...register("email")} />
                            {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                            <Input type="password" placeholder="Min. 8 characters" {...register("password")} />
                            {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>}
                        </div>

                        <Button type="submit" className="w-full" loading={isSubmitting}>
                            Create account
                        </Button>
                    </form>

                    <p className="mt-4 text-center text-sm text-gray-600">
                        Already have an account?{" "}
                        <Link href="/login" className="text-blue-600 hover:underline">Sign in</Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
