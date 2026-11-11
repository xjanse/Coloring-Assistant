
"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const { error } = await authClient.signIn.email({
        email,
        password,
      });

      if (error) {
        setError(error.message ?? "Login failed.");
        return;
      }

      router.push("/");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleLogin() {
    setError("");

    await authClient.signIn.social({
      provider: "google",
      callbackURL: "/",
    });
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#faf7fc] p-6">
      <form
        onSubmit={handleLogin}
        className="w-full max-w-md space-y-6 rounded-3xl border border-purple-100 bg-white p-8 shadow-sm"
      >
        <div className="space-y-2 text-center">
          <div className="text-4xl">🎨</div>
          <h1 className="text-2xl font-semibold text-gray-800">
            Welcome back!
          </h1>
          <p className="text-sm text-gray-500">
            Sign in to your Coloring Assistant account.
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">
            Email address
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            className="w-full rounded-xl border border-gray-200 p-3 outline-none focus:border-purple-400"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Your password"
            required
            className="w-full rounded-xl border border-gray-200 p-3 outline-none focus:border-purple-400"
          />
        </div>

        {error && (
          <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-purple-500 p-3 font-medium text-white transition hover:bg-purple-600 disabled:opacity-50"
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>

        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-gray-200" />
          <span className="text-xs text-gray-400">OR</span>
          <div className="h-px flex-1 bg-gray-200" />
        </div>

        <button
          type="button"
          onClick={handleGoogleLogin}
          className="w-full rounded-xl border border-gray-200 p-3 font-medium text-gray-700 hover:bg-gray-50"
        >
          Continue with Google
        </button>

        <p className="text-center text-sm text-gray-500">
          Don't have an account?{" "}
          <Link
            href="/register"
            className="font-medium text-purple-600 hover:underline"
          >
            Create one
          </Link>
        </p>
      </form>
    </main>
  );
}
