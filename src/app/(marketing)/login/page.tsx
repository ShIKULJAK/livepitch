import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type LoginPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function readFirst(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = (await searchParams) ?? {};
  const callbackUrl = readFirst(params.callbackUrl) || "/dashboard";
  const error = readFirst(params.error);
  const showCredentialsError = error === "CredentialsSignin";

  return (
    <main className="grid min-h-screen place-items-center p-4">
      <Card className="w-full max-w-md p-6">
        <h1 className="text-3xl font-semibold">Login</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
          Sign in to continue.
        </p>
        <form className="mt-6 space-y-4" action="/api/auth/local-login" method="POST" noValidate>
          <input type="hidden" name="callbackUrl" value={callbackUrl} />
          <div>
            <label className="mb-1 block text-sm">Email</label>
            <Input type="email" name="email" placeholder="you@example.com" autoComplete="email" required />
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between text-sm">
              <label>Password</label>
              <Link href="/forgot-password" style={{ color: "var(--primary)" }}>
                Forgot password?
              </Link>
            </div>
            <Input type="password" name="password" placeholder="••••••••" autoComplete="current-password" required />
          </div>
          {showCredentialsError ? (
            <p className="text-sm" style={{ color: "var(--danger)" }}>
              Invalid email or password.
            </p>
          ) : null}
          <Button variant="primary" className="w-full" type="submit">
            Login
          </Button>
          <p className="text-center text-sm" style={{ color: "var(--text-secondary)" }}>
            No account?{" "}
            <Link href="/signup" style={{ color: "var(--primary)" }}>
              Sign up
            </Link>
          </p>
        </form>
      </Card>
    </main>
  );
}

