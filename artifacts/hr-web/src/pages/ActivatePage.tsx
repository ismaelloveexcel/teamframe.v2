import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { activate } from "../api/auth";
import { ApiError } from "../lib/api-client";
import { AuthLayout } from "./AuthLayout";
import { Button, Field, Input } from "../components/ui";
import { ErrorBanner } from "../components/states";

export function ActivatePage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [done, setDone] = useState(false);

  const mutation = useMutation({
    mutationFn: () => activate(token, password),
    onSuccess: () => setDone(true),
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    mutation.mutate();
  };

  // The /auth/activate route ships on feat/hr-backend-prereqs; until merged the
  // path is unknown. Depending on backend route ordering an unknown public path
  // can surface as 404 (no such route) or 401 (auth middleware runs first), so
  // we treat both as "not available yet" and surface that explicitly.
  const notYetAvailable =
    mutation.error instanceof ApiError &&
    (mutation.error.status === 404 || mutation.error.status === 401);

  if (!token) {
    return (
      <AuthLayout title="Activate account" subtitle="This link is missing its token.">
        <p className="text-sm text-slate-600">
          Open the activation link from your invitation email, or ask your admin to
          re-send it.
        </p>
        <Link to="/login" className="mt-4 inline-block text-sm font-medium underline">
          Back to sign in
        </Link>
      </AuthLayout>
    );
  }

  if (done) {
    return (
      <AuthLayout title="Account activated" subtitle="You can now sign in.">
        <Button className="w-full" onClick={() => navigate("/login")}>
          Go to sign in
        </Button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Activate account"
      subtitle="Set a password to finish setting up your account."
    >
      <form className="space-y-4" onSubmit={onSubmit}>
        {notYetAvailable ? (
          <div className="rounded-xl border border-tf-warning-soft bg-tf-warning-soft px-3.5 py-3 text-sm text-tf-warning">
            Account activation is not available on this backend yet (the
            <code className="mx-1">/auth/activate</code> endpoint ships with the
            HR backend prerequisites). Please try again once it has been deployed.
          </div>
        ) : (
          <ErrorBanner error={mutation.error} />
        )}
        <Field label="New password" required>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </Field>
        <Button type="submit" className="w-full" disabled={mutation.isPending}>
          {mutation.isPending ? "Activating…" : "Activate account"}
        </Button>
      </form>
    </AuthLayout>
  );
}
