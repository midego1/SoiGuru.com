"use client";

import { useParams, useSearchParams } from "next/navigation";
import { getSafeRedirectPath } from "@/lib/auth/validate-callback-url";
import { AdminSignIn } from "./admin-sign-in";

/**
 * Admin sign-in. Spec 055 swaps the template's generic `AuthForm` layout for
 * the SoiGuru-branded `AdminSignIn`; the form inside is the same
 * `CredentialsForm` in client mode, and the redirect handling is unchanged.
 */
export default function AdminLoginPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? null;

  const handleLoginSuccess = () => {
    const redirectPath = getSafeRedirectPath(callbackUrl, `/${params.locale}/admin`);
    const locale = String(params.locale ?? "en");
    // Add locale prefix for non-English users if path doesn't already have it
    const finalRedirectPath =
      locale !== "en" && !redirectPath.startsWith(`/${locale}`)
        ? `/${locale}${redirectPath}`
        : redirectPath;
    window.location.href = finalRedirectPath;
  };

  return <AdminSignIn onSuccess={handleLoginSuccess} />;
}
