"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import "leaflet/dist/leaflet.css";
import { navItemsForRole } from "./nav";
import Sidebar from "./Sidebar";
import Footer from "./Footer";

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    router.push("/");
  };

  // Brand links to the admin console for admins, and the storefront otherwise.
  const brandHref = user?.role === "admin" ? "/admin" : "/";
  const navItems = navItemsForRole(user?.role, Boolean(user));

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-200">
      <Sidebar
        items={navItems}
        brandHref={brandHref}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onOpen={() => setSidebarOpen(true)}
        user={user}
        onLogout={handleLogout}
        onSignUp={() => router.push("/auth/register")}
      />

      {/* Content column. */}
      <div className="flex min-h-screen flex-1 flex-col">
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>

        <Footer />
      </div>
    </div>
  );
}



