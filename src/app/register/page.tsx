"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export default function RegisterPage() {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    async function handleRegister(e: React.FormEvent) {
        e.preventDefault();
        setError("");
        setLoading(true);

        const { error } = await authClient.signUp.email({
            name,
            email,
            password,
        });

        setLoading(false);

        if (error) {
            setError(error.message ?? "Registration failed");
            return;
        }

        window.location.href = "/onboarding";
    }

    return (
        <main className="flex min-h-screen items-center justify-center p-6">
            <form
                onSubmit={handleRegister}
                className="w-full max-w-md space-y-4 rounded-2xl border p-8"
            >
                <h1 className="text-2xl font-semibold">
                    Create your account
                </h1>

                <input
                    className="w-full rounded-lg border p-3"
                    placeholder="Your name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                />

                <input
                    className="w-full rounded-lg border p-3"
                    type="email"
                    placeholder="Email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                />

                <input
                    className="w-full rounded-lg border p-3"
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                />

                {error && (
                    <p className="text-sm text-red-500">{error}</p>
                )}

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full rounded-lg bg-purple-500 p-3 text-white disabled:opacity-50"
                >
                    {loading ? "Creating account..." : "Create account"}
                </button>
                <button
                    type="button"
                    onClick={() =>
                        authClient.signIn.social({
                            provider: "google",
                            callbackURL: "/onboarding",
                        })
                    }
                    className="w-full rounded-lg border p-3"
                >
                    Continue with Google
                </button>
            </form>
        </main>
    );
}