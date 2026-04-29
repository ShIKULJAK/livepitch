"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { AuthProgress } from "@/components/ui/auth-progress";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const handleSignup = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      let json: { error?: string } | null = null;
      try {
        json = (await response.json()) as { error?: string };
      } catch {
        json = null;
      }

      if (!response.ok) {
        setError(json?.error ?? "Unable to create account.");
        return;
      }

      const signInResult = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (signInResult?.error) {
        router.replace("/login");
        return;
      }

      router.replace("/dashboard");
      router.refresh();
    } catch {
      setError("Signup failed. Please try again.");
    } finally {
      setPending(false);
    }
  };

  return (
    <main className="grid min-h-screen place-items-center p-4">
      <Card className="w-full max-w-md p-6">
        <h1 className="text-3xl font-semibold">Create account</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
          Register to start using Live Pitch.
        </p>
        <form className="mt-6 space-y-4" onSubmit={handleSignup} noValidate>
          {pending ? <AuthProgress label="Creating account and initializing your workspace..." /> : null}
          <div>
            <label className="mb-1 block text-sm">Full name</label>
            <Input placeholder="John Doe" value={name} onChange={(event) => setName(event.currentTarget.value)} autoComplete="name" required />
          </div>
          <div>
            <label className="mb-1 block text-sm">Email</label>
            <Input type="email" placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.currentTarget.value)} autoComplete="email" required />
          </div>
          <div>
            <label className="mb-1 block text-sm">Password</label>
            <Input type="password" placeholder="At least 8 characters" value={password} onChange={(event) => setPassword(event.currentTarget.value)} autoComplete="new-password" required minLength={8} />
          </div>
          {error ? (
            <p className="text-sm" style={{ color: "var(--danger)" }}>
              {error}
            </p>
          ) : null}
          <Button variant="primary" className="w-full" type="submit" disabled={pending}>
            {pending ? "Creating..." : "Create account"}
          </Button>
          <p className="text-center text-sm" style={{ color: "var(--text-secondary)" }}>
            Already have an account? <Link href="/login" style={{ color: "var(--primary)" }}>Login</Link>
          </p>
        </form>
      </Card>
    </main>
  );
}
