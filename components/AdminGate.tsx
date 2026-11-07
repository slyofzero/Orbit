"use client";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { isAdminProfile } from "@/lib/profiles";

// The admin profile only sees /admin. Normal profiles never land on /admin.
export default function AdminGate() {
  const path = usePathname();
  const router = useRouter();
  useEffect(() => {
    const admin = isAdminProfile();
    if (admin && !path.startsWith("/admin")) router.replace("/admin");
    if (!admin && path.startsWith("/admin")) router.replace("/");
  }, [path, router]);
  return null;
}
