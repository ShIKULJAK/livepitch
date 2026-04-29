"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { AuthProgress } from "@/components/ui/auth-progress";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    setError(null);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError("Invalid email or password.");
        return;
      }

      router.replace("/dashboard");
      router.refresh();
    } catch {
      setError("Login failed. Please try again.");
    } finally {
      setPending(false);
    }
  };

  return (
    <main className="grid min-h-screen place-items-center p-4">
      <Card className="w-full max-w-md p-6">
        <h1 className="text-3xl font-semibold">Login</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
          Sign in to continue.
        </p>
        <form className="mt-6 space-y-4" onSubmit={handleLogin} noValidate>
          {pending ? <AuthProgress label="Verifying credentials and preparing your session..." /> : null}
          <div>
            <label className="mb-1 block text-sm">Email</label>
            <Input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.currentTarget.value)}
              autoComplete="email"
              required
            />
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between text-sm">
              <label>Password</label>
              <Link href="/forgot-password" style={{ color: "var(--primary)" }}>
                Forgot password?
              </Link>
            </div>
            <Input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(event) => setPassword(event.currentTarget.value)}
              autoComplete="current-password"
              required
            />
          </div>
          {error ? (
            <p className="text-sm" style={{ color: "var(--danger)" }}>
              {error}
            </p>
          ) : null}
          <Button variant="primary" className="w-full" type="submit" disabled={pending}>
            {pending ? "Logging in..." : "Login"}
          </Button>
          <p className="text-center text-sm" style={{ color: "var(--text-secondary)" }}>
            No account? <Link href="/signup" style={{ color: "var(--primary)" }}>Sign up</Link>
          </p>
        </form>
      </Card>
    </main>
  );
}
