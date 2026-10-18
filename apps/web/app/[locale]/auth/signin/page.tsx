import { SoiGuruAuthCard } from "@/components/soiguru/auth-card";
import { Metadata } from "next";
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
  const t = await getTranslations({ locale, namespace: "auth" });

  const path = "/auth/signin";
  const title = `${t("SIGN_IN")} | ${await getSiteName()}`;
  const description = t("ENTER_YOUR_CREDENTIALS_HEADER");

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

/** SoiGuru sign-in card (spec 058); the template's `AuthForm` stays for the admin sign-in. */
export default async function LoginPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return <SoiGuruAuthCard form="login" locale={locale} />;
}
