"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";

interface User {
  id: string;
  name: string;
  email: string;
  role: "customer" | "provider" | "admin";
}

/**
 * The database `UserRole` enum uses `customer` (renamed from the legacy `user`).
 * Normalising keeps the client consistent and still tolerates the old `user`
 * value coming from persisted sessions.
 */
function normaliseRole(role: unknown): User["role"] {
  switch (role) {
    case "provider":
      return "provider";
    case "admin":
      return "admin";
    case "customer":
    case "user":
    default:
      return "customer";
  }
}

function normaliseUser(raw: any): User {
  return {
    id: raw?.id,
    name: raw?.name,
    email: raw?.email,
    role: normaliseRole(raw?.role),
  };
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (
    name: string,
    email: string,
    password: string,
    phone?: string,
    address?: string,
    role?: string
  ) => Promise<void>;
  logout: () => void;
  loading: boolean;
  redirectAfterLogin: (userRole: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const storedToken = localStorage.getItem("token");
      const storedUser = localStorage.getItem("user");
      if (storedToken && storedUser) {
        const parsed = normaliseUser(JSON.parse(storedUser));
        setToken(storedToken);
        setUser(parsed);
        // Rewrite so any previously-stored raw `"user"` role is migrated.
        localStorage.setItem("user", JSON.stringify(parsed));
      }
    } catch {
      // Corrupt storage should never crash the app — clear and continue.
      localStorage.removeItem("token");
      localStorage.removeItem("user");
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Location is intentionally NOT tracked here.
   *
   * Storing the user's position only happens while the location map is open
   * (see `components/features/LocationMap.tsx`). This keeps the app from
   * requesting location permission or writing position data on every sign-in,
   * and means a user only shares their location deliberately, when they open
   * the map.
   */

  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      const normalised = normaliseUser(data.user);
      setUser(normalised);
      setToken(data.token);
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(normalised));
    } catch (error) {
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const register = async (
    name: string,
    email: string,
    password: string,
    phone?: string,
    address?: string,
    role?: string
  ) => {
    setLoading(true);
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, phone, address, role }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      setUser(data.user);
      setToken(data.token);
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
    } catch (error) {
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  };

  const redirectAfterLogin = (userRole: string) => {
    switch (userRole) {
      case "admin":
        window.location.href = "/admin";
        break;
      default:
        window.location.href = "/";
        break;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        login,
        register,
        logout,
        loading,
        redirectAfterLogin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
