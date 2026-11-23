import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, type LoginInput } from "@plexsol/shared";
import { PlexsolLogo } from "@/components/brand/plexsol-logo";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/hooks/use-auth";
import { ApiError } from "@/lib/api";

export function LoginPage() {
  const { login, isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "admin@plexsol.com",
      password: "",
    },
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Spinner className="size-8" />
      </div>
    );
  }

  if (isAuthenticated) {
    const from =
      (location.state as { from?: string } | null)?.from &&
      (location.state as { from?: string }).from !== "/login"
        ? (location.state as { from: string }).from
        : "/";
    return <Navigate to={from} replace />;
  }

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null);
    try {
      await login(values);
      navigate("/", { replace: true });
    } catch (error) {
      if (error instanceof ApiError) {
        setFormError(error.message);
      } else {
        setFormError("Unable to sign in. Please try again.");
      }
    }
  });

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-[#0B0B0B] lg:flex lg:flex-col lg:justify-between lg:p-10">
        <PlexsolLogo variant="official" className="h-12" />
        <div className="max-w-md space-y-3 text-white">
          <h1 className="text-3xl font-semibold tracking-tight">
            Plexsol Business Manager
          </h1>
          <p className="text-sm leading-relaxed text-white/70">
            Subscriptions, clients, maintenance billing, and finances — in one
            internal workspace.
          </p>
        </div>
        <p className="text-xs text-white/40">Plexsol Technologies</p>
        <div
          aria-hidden
          className="pointer-events-none absolute -right-20 bottom-0 h-64 w-64 rounded-full bg-primary/30 blur-3xl"
        />
      </div>

      <div className="flex items-center justify-center bg-background p-6">
        <Card className="w-full max-w-md border-border shadow-sm">
          <CardHeader className="space-y-4">
            <div className="lg:hidden">
              <PlexsolLogo variant="light" />
            </div>
            <div>
              <CardTitle>Sign in</CardTitle>
              <CardDescription>
                Use your Plexsol administrator credentials.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={onSubmit} noValidate>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="username"
                  {...form.register("email")}
                />
                {form.formState.errors.email ? (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.email.message}
                  </p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  {...form.register("password")}
                />
                {form.formState.errors.password ? (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.password.message}
                  </p>
                ) : null}
              </div>

              {formError ? (
                <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {formError}
                </p>
              ) : null}

              <Button
                type="submit"
                className="w-full"
                disabled={form.formState.isSubmitting}
              >
                {form.formState.isSubmitting ? (
                  <>
                    <Spinner className="size-4 border-primary-foreground/30 border-t-primary-foreground" />
                    Signing in…
                  </>
                ) : (
                  "Sign in"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
