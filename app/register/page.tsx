"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage("");

    if (password !== confirm) {
      setMessage("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();

      if (!response.ok) {
        setMessage(data.message || "Unable to create account.");
        return;
      }

      router.replace("/owner");
      router.refresh();
    } catch {
      setMessage("Unable to create account right now.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page">
      <div className="card">
        <p>🐾 Taiwan Pet ID</p>
        <h1>Create owner account</h1>
        <p>Use your email address and a password to protect your pet dashboard.</p>

        <form onSubmit={submit}>
          <div className="field">
            <label htmlFor="email">Email address</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>

          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              minLength={8}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="confirm">Confirm password</label>
            <input
              id="confirm"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              required
            />
          </div>

          <button className="button" type="submit" disabled={loading}>
            {loading ? "Creating account..." : "Create account"}
          </button>
        </form>

        {message && <div className="status warning" style={{ marginTop: 16 }}>{message}</div>}

        <p style={{ marginTop: 20 }}>
          Already have an account? <Link href="/login">Sign in</Link>
        </p>
      </div>
    </main>
  );
}
