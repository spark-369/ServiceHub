import type { UserRole } from "@/lib/types";

export interface NavItem {
  href: string;
  label: string;
}

/**
 * Role-filtered navigation links used by the sidebar. Kept in one place so the
 * list never drifts between the desktop sidebar and the mobile drawer.
 */
export function navItemsForRole(
  role: UserRole | undefined,
  isAuthenticated: boolean
): NavItem[] {
  if (role === "admin") {
    return [
      { href: "/admin", label: "Dashboard" },
      { href: "/profile", label: "My Profile" },
    ];
  }

  const items: NavItem[] = [
    { href: "/", label: "Home" },
    { href: "/recommendations", label: "AI Recommendations" },
  ];

  if (role === "provider") {
    items.push({ href: "/provider", label: "My Services" });
  }

  items.push({ href: "/bookings", label: "My Bookings" });

  if (isAuthenticated) {
    items.push({ href: "/payments", label: "Payments" });
  }

  if (isAuthenticated) {
    items.push({ href: "/profile", label: "My Profile" });
  }

  return items;
}
