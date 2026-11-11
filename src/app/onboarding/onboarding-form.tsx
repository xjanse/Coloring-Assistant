
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function OnboardingPage() {
  const router = useRouter();

  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/onboarding", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          displayName,
          username,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }

      router.push("/");
      router.refresh();
    } catch {
      setError("Could not connect to the server.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#faf7fc] p-6">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md space-y-6 rounded-3xl border border-purple-100 bg-white p-8 shadow-sm"
      >
        <div className="space-y-2 text-center">
          <div className="text-4xl">🎨</div>
          <h1 className="text-2xl font-semibold text-gray-800">
            Welcome to Coloring Assistant!
          </h1>
          <p className="text-sm text-gray-500">
            Let's set up your profile before you get started.
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">
            Display name
          </label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="How should we call you?"
            required
            minLength={2}
            maxLength={40}
            className="w-full rounded-xl border border-gray-200 p-3 outline-none focus:border-purple-400"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">
            Username
          </label>
          <input
            type="text"
            value={username}
            onChange={(e) =>
              setUsername(
                e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "")
              )
            }
            placeholder="e.g. coloringfan"
            required
            minLength={3}
            maxLength={20}
            className="w-full rounded-xl border border-gray-200 p-3 outline-none focus:border-purple-400"
          />
          <p className="text-xs text-gray-400">
            3–20 characters. Letters, numbers and underscores only.
            Your username is used when inviting you to shared collections.
          </p>
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
          {loading ? "Setting up your account..." : "Let's get started"}
        </button>
      </form>
    </main>
  );
}
