"use client";

import { useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import ProfileComponent from "@/components/features/ProfileComponent";
import { useRouter } from "next/navigation";
import { SpinnerPanel } from "@/components/ui/Spinner";

const ProfilePage = () => {
  const { user, loading } = useAuth();
  const router = useRouter();

  // Redirect unauthenticated visitors in an effect (calling router.push during
  // render is a side effect and produces a React warning).
  useEffect(() => {
    if (!loading && !user) {
      router.push("/auth/login");
    }
  }, [loading, user, router]);

  if (loading) {
    return <SpinnerPanel label="Loading your profile" />;
  }

  if (!user) {
    return null;
  }

  // Render the unified profile component
  return <ProfileComponent user={user} />;
};

export default ProfilePage;
