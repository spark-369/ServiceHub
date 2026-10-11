import React from "react";

interface ProfileComponentProps {
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    phone?: string;
    address?: string;
    createdAt?: string;
  };
}

const ProfileComponent: React.FC<ProfileComponentProps> = ({ user }) => {
  // Determine the profile title based on the user's role
  const getProfileTitle = () => {
    switch (user.role) {
      case "admin":
        return "Admin Profile";
      case "provider":
        return "Provider Profile";
      default:
        return "User Profile";
    }
  };

  // Get role-specific colors (dark theme)
  const getRoleColors = () => {
    switch (user.role) {
      case "admin":
        return {
          bg: "bg-red-500/10",
          border: "border-red-500/30",
          text: "text-red-300",
          badge: "bg-red-500/15 text-red-300 ring-1 ring-inset ring-red-500/30",
        };
      case "provider":
        return {
          bg: "bg-blue-500/10",
          border: "border-blue-500/30",
          text: "text-blue-300",
          badge:
            "bg-blue-500/15 text-blue-300 ring-1 ring-inset ring-blue-500/30",
        };
      default:
        return {
          bg: "bg-emerald-500/10",
          border: "border-emerald-500/30",
          text: "text-emerald-300",
          badge:
            "bg-emerald-500/15 text-emerald-300 ring-1 ring-inset ring-emerald-500/30",
        };
    }
  };

  const colors = getRoleColors();

  return (
    <div className="py-8">
      <div className="max-w-4xl mx-auto">
        {/* Profile Header */}
        <div className={`rounded-lg shadow-lg overflow-hidden ${colors.bg} ${colors.border} border-2`}>
          <div className="px-6 py-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className={`text-3xl font-bold ${colors.text} mb-2`}>
                  {getProfileTitle()}
                </h1>
                <div className="flex items-center space-x-3">
                  <span
                    className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${colors.badge}`}
                  >
                    {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                  </span>
                  {user.createdAt && (
                    <span className="text-sm text-slate-400">
                      Member since: {new Date(user.createdAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex-shrink-0">
                <div className="w-16 h-16 rounded-full bg-gradient-to-r from-purple-400 to-blue-500 flex items-center justify-center">
                  <span className="text-white text-2xl font-bold">
                    {user.name.charAt(0).toUpperCase()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Profile Details */}
        <div className="mt-8 bg-slate-900 shadow-lg rounded-lg overflow-hidden border border-slate-800">
          <div className="px-6 py-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Basic Information */}
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium text-slate-100 mb-4 border-b border-slate-800 pb-2">
                    Basic Information
                  </h3>
                  <div className="space-y-4">
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-500/10 flex items-center justify-center mt-1">
                        <svg
                          className="w-4 h-4 text-indigo-400"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm text-slate-400 font-medium">Full Name</p>
                        <p className="text-lg font-semibold text-slate-100">
                          {user.name}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-500/10 flex items-center justify-center mt-1">
                        <svg
                          className="w-4 h-4 text-indigo-400"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                          <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm text-slate-400 font-medium">Email Address</p>
                        <p className="text-lg font-semibold text-slate-100">
                          {user.email}
                        </p>
                      </div>
                    </div>

                    {user.phone && (
                      <div className="flex items-start space-x-3">
                        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-500/10 flex items-center justify-center mt-1">
                          <svg
                            className="w-4 h-4 text-indigo-400"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                          </svg>
                        </div>
                        <div>
                          <p className="text-sm text-slate-400 font-medium">Phone Number</p>
                          <p className="text-lg font-semibold text-slate-100">
                            {user.phone}
                          </p>
                        </div>
                      </div>
                    )}

                    {user.address && (
                      <div className="flex items-start space-x-3">
                        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-500/10 flex items-center justify-center mt-1">
                          <svg
                            className="w-4 h-4 text-indigo-400"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </div>
                        <div>
                          <p className="text-sm text-slate-400 font-medium">Address</p>
                          <p className="text-lg font-semibold text-slate-100">
                            {user.address}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Additional Information */}
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium text-slate-100 mb-4 border-b border-slate-800 pb-2">
                    Account Details
                  </h3>
                  <div className="space-y-4">
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-500/10 flex items-center justify-center mt-1">
                        <svg
                          className="w-4 h-4 text-indigo-400"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm text-slate-400 font-medium">User ID</p>
                        <p className="text-lg font-semibold text-slate-100 break-all">
                          {user.id}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-500/10 flex items-center justify-center mt-1">
                        <svg
                          className="w-4 h-4 text-indigo-400"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm text-slate-400 font-medium">Account Role</p>
                        <p className={`text-lg font-semibold ${colors.text} capitalize`}>
                          {user.role}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Admin-specific section */}
            {user.role === "admin" && (
              <div className="mt-10 p-6 bg-red-500/10 rounded-lg border-2 border-red-500/30">
                <h2 className="text-xl font-bold text-red-300 mb-3 flex items-center">
                  <svg
                    className="w-6 h-6 mr-2"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M10 2a1 1 0 00-1 1v1a1 1 0 002 0V3a1 1 0 00-1-1z" />
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Admin Privileges
                </h2>
                <p className="text-red-300/80 mb-4">
                  Full access to manage users, providers, and services.
                </p>
                <div className="bg-slate-900/60 p-4 rounded-lg ring-1 ring-inset ring-slate-800">
                  <ul className="text-sm text-slate-300 grid grid-cols-2 gap-2">
                    {[
                      "Users",
                      "Providers",
                      "Services",
                      "Payments",
                      "Bookings",
                      "System settings",
                    ].map((item) => (
                      <li key={item} className="flex items-center">
                        <svg
                          className="w-4 h-4 text-green-500 mr-2 shrink-0"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileComponent;
