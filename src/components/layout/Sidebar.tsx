"use client";

import Link from "next/link";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import type { NavItem } from "./nav";
import type { AuthUser } from "@/lib/types";
import { Button, ButtonLink, Badge } from "@/components/ui";
import type { BadgeTone } from "@/components/ui";
import { ROLE_LABELS } from "@/lib/constants";

/** Map a user role to a badge tone for the sidebar's role pill. */
function roleTone(role: string): BadgeTone {
  switch (role) {
    case "admin":
      return "danger";
    case "provider":
      return "info";
    default:
      return "success";
  }
}

/** Human-friendly label for a role, falling back to the raw value. */
function roleLabel(role: string): string {
  return ROLE_LABELS[role] ?? role;
}

/** Persistent left-hand navigation sidebar (replaces the old top navbar). */

function NavIcon({ href }: { href: string }) {
  const paths: Record<string, string> = {
    "/":
      "M3 12l9-9 9 9M5 10v10a1 1 0 001 1h4v-6h4v6h4a1 1 0 001-1V10",
    "/recommendations":
      "M9.663 17h4.674M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z",
    "/provider":
      "M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z",
    "/bookings":
      "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z",
    "/payments":
      "M17 9V7a5 5 0 00-10 0v2m-2 0h14a2 2 0 012 2v7a2 2 0 01-2 2H5a2 2 0 01-2-2v-7a2 2 0 012-2z",
    "/profile":
      "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z",
    "/admin":
      "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z",
  };

  const d = paths[href] ?? paths["/"];

  return (
    <svg
      className="h-5 w-5 flex-shrink-0"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d={d} />
    </svg>
  );
}

export default function Sidebar({
  items,
  brandHref,
  open,
  onClose,
  onOpen,
  user,
  onLogout,
  onSignUp,
}: {
  items: NavItem[];
  brandHref: string;
  open: boolean;
  onClose: () => void;
  onOpen: () => void;
  user: AuthUser | null;
  onLogout: () => void;
  onSignUp: () => void;
}) {
  const pathname = usePathname();

  useEffect(() => {
    onClose();
  }, [pathname, onClose]);

  const list = (
    <nav className="flex-1 space-y-1 px-3 py-4" aria-label="Main navigation">
      {items.map((item) => {
        const active =
          item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              active
                ? "bg-indigo-500/10 text-indigo-300"
                : "text-slate-400 hover:bg-slate-800/70 hover:text-slate-200"
            }`}
          >
            <NavIcon href={item.href} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  // Auth actions live at the bottom of the sidebar now that there's no navbar.
  const authFooter = (
    <div className="border-t border-slate-800 px-3 py-4">
      {user ? (
        <div className="space-y-3">
          <div className="rounded-md border border-slate-800 bg-slate-900/60 px-3 py-2.5">
            <p className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-sky-500 text-sm font-semibold text-white">
                {user.name.charAt(0).toUpperCase()}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-slate-100">
                  {user.name}
                </span>
                <span className="block truncate text-xs text-slate-400">
                  {user.email}
                </span>
              </span>
            </p>
            <p className="mt-2">
              <Badge tone={roleTone(user.role)}>
                {roleLabel(user.role)}
              </Badge>
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            className="w-full"
            onClick={onLogout}
          >
            Logout
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="px-1 text-xs text-slate-500">
            Sign in to book services, track bookings and manage your profile.
          </p>
          <Button className="w-full" onClick={onSignUp}>
            Sign up
          </Button>
          <ButtonLink href="/auth/login" variant="secondary" className="w-full">
            Sign in
          </ButtonLink>
        </div>
      )}
    </div>
  );

  const brand = (
    <Link
      href={brandHref}
      className="bg-gradient-to-r from-indigo-400 to-sky-400 bg-clip-text text-xl font-bold text-transparent"
    >
      ServiceHub
    </Link>
  );

  return (
    <>
      {/* Desktop: fixed-width, always-visible sidebar. */}
      <aside className="sticky top-0 hidden h-screen w-64 flex-col border-r border-slate-800 bg-slate-900/40 md:flex">
        <div className="flex h-16 items-center border-b border-slate-800 px-6">
          {brand}
        </div>
        {list}
        {authFooter}
      </aside>

      {/* Mobile: off-canvas drawer. */}
      {open && (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true">
          <div
            className="absolute inset-0 bg-slate-950/60"
            onClick={onClose}
            aria-hidden="true"
          />
          <aside className="relative flex h-full w-64 flex-col border-r border-slate-800 bg-slate-950">
            <div className="flex h-16 items-center justify-between border-b border-slate-800 px-6">
              {brand}
              <button
                type="button"
                onClick={onClose}
                className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200"
                aria-label="Close navigation"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            {list}
            {authFooter}
          </aside>
        </div>
      )}

      {/* Mobile-only floating menu button (there is no top navbar anymore). */}
      <button
        type="button"
        onClick={onOpen}
        className="fixed left-4 top-4 z-30 rounded-md border border-slate-800 bg-slate-900/90 p-2 text-slate-300 transition-colors hover:bg-slate-800 hover:text-slate-100 md:hidden"
        aria-label="Open navigation"
      >
        <svg
          className="h-6 w-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 6h16M4 12h16M4 18h16"
          />
        </svg>
      </button>
    </>
  );
}

