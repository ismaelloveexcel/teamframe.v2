import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { bootstrap } from "../api/auth";
import { useAuth } from "../auth/AuthProvider";
import { AuthLayout } from "./AuthLayout";
import { Button, Field, Input } from "../components/ui";
import { ErrorBanner } from "../components/states";

export function BootstrapPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [companyName, setCompanyName] = useState("");
  const [jurisdiction, setJurisdiction] = useState("UAE");
  const [currency, setCurrency] = useState("AED");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      bootstrap({ companyName, jurisdiction, currency, adminEmail, adminPassword }),
    onSuccess: async () => {
      // Auto-login the new admin and land on the dashboard.
      await login(adminEmail, adminPassword);
      navigate("/", { replace: true });
    },
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    mutation.mutate();
  };

  return (
    <AuthLayout
      title="Create a workspace"
      subtitle="Set up a new company and its first admin."
      footer={
        <span>
          Already have an account?{" "}
          <Link to="/login" className="font-medium text-slate-900 underline">
            Sign in
          </Link>
        </span>
      }
    >
      <form className="space-y-4" onSubmit={onSubmit}>
        <ErrorBanner error={mutation.error} />
        <Field label="Company name" required>
          <Input
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            required
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Jurisdiction">
            <Input
              value={jurisdiction}
              onChange={(e) => setJurisdiction(e.target.value)}
            />
          </Field>
          <Field label="Currency">
            <Input value={currency} onChange={(e) => setCurrency(e.target.value)} />
          </Field>
        </div>
        <Field label="Admin email" required>
          <Input
            type="email"
            value={adminEmail}
            onChange={(e) => setAdminEmail(e.target.value)}
            required
          />
        </Field>
        <Field label="Admin password" required hint="Minimum 8 characters recommended.">
          <Input
            type="password"
            value={adminPassword}
            onChange={(e) => setAdminPassword(e.target.value)}
            required
          />
        </Field>
        <Button type="submit" className="w-full" disabled={mutation.isPending}>
          {mutation.isPending ? "Creating…" : "Create workspace"}
        </Button>
      </form>
    </AuthLayout>
  );
}
