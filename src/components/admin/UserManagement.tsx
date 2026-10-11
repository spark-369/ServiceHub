"use client";

import { useState, useEffect } from "react";
import LocationMap from "@/components/features/LocationMap";
import { useAuth } from "@/context/AuthContext";

interface User {
  id: string;
  name: string;
  email: string;
  role: "customer" | "provider" | "admin";
  isVerified: boolean;
  phone?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  createdAt: string;
  _count: {
    bookingsAsUser: number;
    bookingsAsProvider: number;
    providedServices: number;
  };
}

interface UserManagementProps {
  onDataChange?: () => void;
}

export default function UserManagement({ onDataChange }: UserManagementProps) {
  const { user: authUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    pages: 0,
  });
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showLocationMap, setShowLocationMap] = useState(false);
  const [selectedUserForMap, setSelectedUserForMap] = useState<User | null>(
    null,
  );

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: "10",
        ...(searchTerm && { search: searchTerm }),
        ...(roleFilter && { role: roleFilter }),
      });

      const response = await fetch(`/api/admin/users?${params}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      const data = await response.json();

      if (response.ok) {
        setUsers(data.users);
        setPagination(data.pagination);
      } else {
        setError(data.error || "Failed to fetch users");
      }
    } catch (error) {
      setError("Network error occurred");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [currentPage, searchTerm, roleFilter]);

  const handleUpdateUser = async (userId: string, updates: any) => {
    try {
      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({ userId, updates }),
      });

      if (response.ok) {
        setEditingUser(null);
        fetchUsers();
        onDataChange?.();
      } else {
        const data = await response.json();
        setError(data.error || "Failed to update user");
      }
    } catch (error) {
      setError("Network error occurred");
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (
      !confirm(
        "Are you sure you want to delete this user? This action cannot be undone.",
      )
    ) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/users?id=${userId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      const data = await response.json();

      if (response.ok) {
        fetchUsers();
        onDataChange?.();
      } else {
        setError(data.error || "Failed to delete user");
      }
    } catch (error) {
      setError("Network error occurred");
    }
  };

  const handleViewLocation = (user: User) => {
    setSelectedUserForMap(user);
    setShowLocationMap(true);
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "admin":
        return "bg-purple-500/10 text-purple-300 ring-1 ring-inset ring-purple-500/20";
      case "provider":
        return "bg-blue-500/10 text-blue-300 ring-1 ring-inset ring-blue-500/20";
      default:
        return "bg-emerald-500/10 text-emerald-300 ring-1 ring-inset ring-emerald-500/20";
    }
  };

  if (loading && users.length === 0) {
    return (
      <div className="flex justify-center items-center min-h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header and Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg leading-6 font-medium text-slate-100">
            User Management
          </h3>
          <p className="mt-1 text-sm text-slate-400">
            Manage user accounts, roles, and permissions
          </p>
        </div>
        <div className="mt-4 sm:mt-0 flex space-x-3">
          <input
            type="text"
            placeholder="Search users..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="px-3 py-2 border border-slate-700 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
          />
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="bg-slate-900 text-slate-100 px-3 py-2 border border-slate-700 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 w-40"
          >
            <option value="" className="bg-slate-900 text-slate-100">All Roles</option>
            <option value="customer" className="bg-slate-900 text-slate-100">Customers</option>
            <option value="provider" className="bg-slate-900 text-slate-100">Providers</option>
            <option value="admin" className="bg-slate-900 text-slate-100">Admins</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-md p-4">
          <div className="text-red-300 text-sm">{error}</div>
        </div>
      )}

      {/* Users Table */}
      <div className="bg-slate-900 border border-slate-800 shadow overflow-hidden sm:rounded-md">
        <ul className="divide-y divide-slate-800">
          {users.map((user) => (
            <li key={user.id} className="px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-medium text-slate-100 truncate">
                        {user.name}
                      </h3>
                      <p className="text-sm text-slate-400">{user.email}</p>
                      {user.phone && (
                        <p className="text-sm text-slate-500">{user.phone}</p>
                      )}
                    </div>
                    <div className="text-right ml-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeColor(
                          user.role,
                        )}`}
                      >
                        {user.role}
                      </span>
                      <div className="text-sm text-slate-500 mt-1">
                        Joined: {new Date(user.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>

                  <div className="mt-2 flex items-center space-x-4 text-sm text-slate-400">
                    <span>
                      📊 Bookings: {user._count.bookingsAsUser} as user,{" "}
                      {user._count.bookingsAsProvider} as provider
                    </span>
                    <span>🛠️ Services: {user._count.providedServices}</span>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ring-1 ring-inset ${
                        user.isVerified
                          ? "bg-emerald-500/10 text-emerald-300 ring-emerald-500/20"
                          : "bg-amber-500/10 text-amber-300 ring-amber-500/20"
                      }`}
                    >
                      {user.isVerified ? "Verified" : "Unverified"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex space-x-2">
                <button
                  onClick={() => setEditingUser(user)}
                  className="inline-flex items-center px-3 py-1 border border-slate-700 text-sm font-medium rounded-md text-indigo-300 bg-slate-800 hover:bg-indigo-500/10"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDeleteUser(user.id)}
                  className="inline-flex items-center px-3 py-1 border border-red-500/30 text-sm font-medium rounded-md text-red-300 bg-slate-800 hover:bg-red-500/10"
                >
                  Delete
                </button>

                {/* Don't offer "View Location" for the admin's own account —
                    there is no other party to show. */}
                {authUser?.id !== user.id && (
                  <button
                    onClick={() => handleViewLocation(user)}
                    className="inline-flex items-center px-3 py-1 border border-blue-500/30 text-sm font-medium rounded-md text-blue-300 bg-slate-800 hover:bg-blue-500/10"
                  >
                    View Location
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>

        {users.length === 0 && !loading && (
          <div className="px-6 py-8 text-center text-slate-400">
            No users found
          </div>
        )}
      </div>

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-slate-400">
            Showing {(pagination.page - 1) * pagination.limit + 1} to{" "}
            {Math.min(pagination.page * pagination.limit, pagination.total)} of{" "}
            {pagination.total} results
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => setCurrentPage(currentPage - 1)}
              disabled={currentPage === 1}
              className="px-3 py-2 text-sm border border-slate-700 rounded-md text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-800"
            >
              Previous
            </button>
            <span className="px-3 py-2 text-sm text-slate-300">
              Page {currentPage} of {pagination.pages}
            </span>
            <button
              onClick={() => setCurrentPage(currentPage + 1)}
              disabled={currentPage === pagination.pages}
              className="px-3 py-2 text-sm border border-slate-700 rounded-md text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-800"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-medium text-slate-100 mb-4">
              Edit User
            </h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.target as HTMLFormElement);
                const updates = {
                  name: formData.get("name"),
                  email: formData.get("email"),
                  phone: formData.get("phone"),
                  role: formData.get("role"),
                  isVerified: formData.get("isVerified") === "true",
                };
                handleUpdateUser(editingUser.id, updates);
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium text-slate-300">
                  Name
                </label>
                <input
                  name="name"
                  defaultValue={editingUser.name}
                  className="mt-1 block w-full border border-slate-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300">
                  Email
                </label>
                <input
                  name="email"
                  type="email"
                  defaultValue={editingUser.email}
                  className="mt-1 block w-full border border-slate-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300">
                  Phone
                </label>
                <input
                  name="phone"
                  defaultValue={editingUser.phone || ""}
                  className="mt-1 block w-full border border-slate-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300">
                  Role
                </label>
                <select
                  name="role"
                  defaultValue={editingUser.role}
                  className="mt-1 block w-full bg-slate-900 text-slate-100 border border-slate-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="customer" className="bg-slate-900 text-slate-100" style={{ minWidth: "400px" }}>Customer</option>
                  <option value="provider" className="bg-slate-900 text-slate-100" style={{ minWidth: "400px" }}>Provider</option>
                  <option value="admin" className="bg-slate-900 text-slate-100" style={{ minWidth: "400px" }}>Admin</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300">
                  Verification Status
                </label>
                <select
                  name="isVerified"
                  defaultValue={editingUser.isVerified.toString()}
                  className="mt-1 block w-full bg-slate-900 text-slate-100 border border-slate-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="true" className="bg-slate-900 text-slate-100" style={{ minWidth: "400px" }}>Verified</option>
                  <option value="false" className="bg-slate-900 text-slate-100" style={{ minWidth: "400px" }}>Unverified</option>
                </select>
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 text-sm font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-md"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-md"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Location Map Modal */}
      {showLocationMap && selectedUserForMap && (
        <LocationMap
          showLocationMap={showLocationMap}
          targetId={selectedUserForMap?.id}
          onClose={() => {
            setShowLocationMap(false);
            setSelectedUserForMap(null);
          }}
          selectedBookingForMap={selectedUserForMap}
        />
      )}
    </div>
  );
}
