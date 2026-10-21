"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LoginSchema } from "@payflow/shared";
import type { z } from "zod";
import { Button } from "@payflow/ui";
import { Input } from "@payflow/ui";

type LoginForm = z.infer<typeof LoginSchema>;

export default function LoginPage() {
    const router = useRouter();
    const [error, setError] = useState<string | null>(null);

    const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginForm>({
        resolver: zodResolver(LoginSchema),
    });

    const onSubmit = async (data: LoginForm) => {
        setError(null);
        const result = await signIn("credentials", { ...data, redirect: false });
        if (result?.error) {
            setError("Invalid email or password");
        } else {
            router.push("/dashboard");
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="w-full max-w-md">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-gray-900">PayFlow</h1>
                    <p className="mt-2 text-gray-600">Sign in to your account</p>
                </div>

                <div className="bg-white rounded-lg shadow p-8">
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                        {error && (
                            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
                                {error}
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                            <Input type="email" placeholder="you@company.com" {...register("email")} />
                            {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                            <Input type="password" placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢" {...register("password")} />
                            {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>}
                        </div>

                        <Button type="submit" className="w-full" loading={isSubmitting}>
                            Sign in
                        </Button>
                    </form>

                    <p className="mt-4 text-center text-sm text-gray-600">
                        Don&apos;t have an account?{" "}
                        <Link href="/register" className="text-blue-600 hover:underline">Register</Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
