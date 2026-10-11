"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { Button, Field, Input } from "@/components/ui";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { login, loading, redirectAfterLogin } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await login(email, password);
      // Get user role and redirect accordingly
      const userData = JSON.parse(localStorage.getItem("user") || "{}");
      redirectAfterLogin(userData.role || "customer");
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="flex items-center justify-center py-12">
      <div className="grid w-full max-w-4xl overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-xl md:grid-cols-2">
        {/* Branding panel (desktop only) */}
        <div className="hidden flex-col justify-between bg-gradient-to-br from-indigo-950/70 to-slate-900 p-8 md:flex">
          <div>
            <p className="bg-gradient-to-r from-indigo-400 to-sky-400 bg-clip-text text-2xl font-bold text-transparent">
              ServiceHub
            </p>
            <h1 className="mt-6 text-2xl font-bold text-slate-100">
              Welcome back
            </h1>
            <p className="mt-2 text-sm text-slate-400">
              Sign in to book trusted local services, track your bookings and
              manage your profile.
            </p>
          </div>
          <ul className="space-y-3 text-sm text-slate-400">
            <li className="flex items-center gap-2">
              <svg className="h-4 w-4 text-indigo-400" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              Book verified professionals
            </li>
            <li className="flex items-center gap-2">
              <svg className="h-4 w-4 text-indigo-400" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              Secure Stripe payments
            </li>
            <li className="flex items-center gap-2">
              <svg className="h-4 w-4 text-indigo-400" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              Real-time provider tracking
            </li>
          </ul>
        </div>

        {/* Form */}
        <div className="p-8">
          <div className="md:hidden">
            <p className="bg-gradient-to-r from-indigo-400 to-sky-400 bg-clip-text text-xl font-bold text-transparent">
              ServiceHub
            </p>
          </div>
          <h2 className="mt-4 text-2xl font-extrabold text-slate-100 md:mt-0">
            Sign in to your account
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            Enter your credentials below to continue.
          </p>
          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            {error && (
              <div className="rounded border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-300">
                {error}
              </div>
            )}
            <Field label="Email address" htmlFor="email">
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>
            <Field label="Password" htmlFor="password">
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>

            <Button type="submit" loading={loading} className="w-full">
              Sign in
            </Button>

            <div className="text-center">
              <Link
                href="/auth/register"
                className="font-medium text-indigo-400 hover:text-indigo-300"
              >
                Don&apos;t have an account? Sign up
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
