"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { Button, Field, Input, Select } from "@/components/ui";

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
    address: "",
    role: "customer",
  });
  const [error, setError] = useState("");
  const { register, loading } = useAuth();
  const router = useRouter();

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await register(
        formData.name,
        formData.email,
        formData.password,
        formData.phone,
        formData.address,
        formData.role,
      );
      router.push("/");
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
              Join ServiceHub
            </h1>
            <p className="mt-2 text-sm text-slate-400">
              Create a free account to book services, or sign up as a provider
              to list your own and reach new customers.
            </p>
          </div>
          <ul className="space-y-3 text-sm text-slate-400">
            <li className="flex items-center gap-2">
              <svg className="h-4 w-4 text-indigo-400" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              Book and pay securely
            </li>
            <li className="flex items-center gap-2">
              <svg className="h-4 w-4 text-indigo-400" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              Providers: list &amp; manage services
            </li>
            <li className="flex items-center gap-2">
              <svg className="h-4 w-4 text-indigo-400" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              Track bookings in real time
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
            Create your account
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            Fill in your details to get started.
          </p>
          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            {error && (
              <div className="rounded border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-300">
                {error}
              </div>
            )}
            <Field label="Full Name" htmlFor="name" required>
              <Input
                id="name"
                name="name"
                type="text"
                autoComplete="name"
                required
                placeholder="Jane Doe"
                value={formData.name}
                onChange={handleChange}
              />
            </Field>
            <Field label="Email address" htmlFor="email" required>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="you@example.com"
                value={formData.email}
                onChange={handleChange}
              />
            </Field>
            <Field label="Password" htmlFor="password" required>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                placeholder="••••••••"
                value={formData.password}
                onChange={handleChange}
              />
            </Field>
            <Field label="Phone" htmlFor="phone" hint="Optional">
              <Input
                id="phone"
                name="phone"
                type="tel"
                autoComplete="tel"
                placeholder="+1 555 000 0000"
                value={formData.phone}
                onChange={handleChange}
              />
            </Field>
            <Field label="Address" htmlFor="address" hint="Optional">
              <Input
                id="address"
                name="address"
                type="text"
                autoComplete="street-address"
                placeholder="123 Main St"
                value={formData.address}
                onChange={handleChange}
              />
            </Field>
            <Field
              label="Account type"
              htmlFor="role"
              hint="Providers can also list their own services"
            >
              <Select
                id="role"
                name="role"
                value={formData.role}
                onChange={handleChange}
              >
                <option value="customer" className="bg-slate-900 text-slate-100" style={{ minWidth: "320px" }}>Customer</option>
                <option value="provider" className="bg-slate-900 text-slate-100" style={{ minWidth: "320px" }}>Service Provider</option>
                <option value="admin" className="bg-slate-900 text-slate-100" style={{ minWidth: "320px" }}>Administrator</option>
              </Select>
            </Field>

            <Button type="submit" loading={loading} className="w-full">
              Create account
            </Button>

            <div className="text-center">
              <Link
                href="/auth/login"
                className="font-medium text-indigo-400 hover:text-indigo-300"
              >
                Already have an account? Sign in
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
