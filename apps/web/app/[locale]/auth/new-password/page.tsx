import { Suspense } from "react";
import { Metadata } from "next";
import { SoiGuruNewPasswordCard } from "@/components/soiguru/password-cards";
import { getTranslations } from "next-intl/server";
import { generateHreflangAlternates, getLocalizedUrl } from "@/lib/seo/hreflang";
import { getSiteName } from '@/lib/seo/site-identity';
import { Locale } from "@/lib/constants";

export async function generateMetadata({
  params
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "soiguru.account" });

  const path = "/auth/new-password";
  const title = t("metaNewPassword");
  const description = t("newBody");

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      url: getLocalizedUrl(path, locale as Locale),
      siteName: await getSiteName(),
    },
    alternates: {
        canonical: getLocalizedUrl(path, locale as Locale),
        languages: generateHreflangAlternates(path)
    }
  };
}

/** SoiGuru card (spec 058); the template's two-column screen stays in `new-password-client.tsx`. */
export default function NewPasswordPage() {
  return (
    <Suspense fallback={null}>
      <SoiGuruNewPasswordCard />
    </Suspense>
  );
}
