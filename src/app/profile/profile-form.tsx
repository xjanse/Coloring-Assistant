"use client";

import { useState } from "react";

export default function ProfileForm({
  initialUsername,
}: {
  initialUsername: string;
}) {
  const [username, setUsername] = useState(initialUsername);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage("");
    setLoading(true);

    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error ?? "Something went wrong.");
        return;
      }

      setMessage("Username updated successfully!");
    } catch {
      setMessage("Could not update your username.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <h3 className="text-lg font-semibold">Username</h3>
      <p className="mt-1 text-sm text-muted">
        Other users can use your username to invite you to shared collections.
      </p>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <input
          type="text"
          value={username}
          onChange={(e) =>
            setUsername(
              e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "")
            )
          }
          minLength={3}
          maxLength={20}
          required
          className="min-w-0 flex-1 rounded-xl border border-border bg-background px-4 py-3 outline-none focus:border-primary"
          placeholder="Your username"
        />

        <button
          type="submit"
          disabled={loading || username === initialUsername}
          className="rounded-xl bg-primary px-5 py-3 font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Saving..." : "Save changes"}
        </button>
      </div>

      {message && (
        <p className="mt-3 text-sm text-muted">{message}</p>
      )}
    </form>
  );
}