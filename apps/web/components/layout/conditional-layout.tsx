"use client";

import { usePathname } from "next/navigation";
import Header from "@/components/header";
import { Footer } from "@/components/footer";
import { ScrollToTopButton } from "@/components/scroll-to-top-button";

interface ConditionalLayoutProps {
  children: React.ReactNode;
  /**
   * First path segments (after the optional locale) whose pages draw their
   * own chrome: the SoiGuru city ids. The site root (`/`, `/th`) is the
   * SoiGuru city landing and is included automatically.
   */
  chromelessSegments?: string[];
}

const LOCALE_SEGMENT = /^[a-z]{2}$/;

function isChromeless(pathname: string, segments: string[]): boolean {
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length && LOCALE_SEGMENT.test(parts[0])) parts.shift();
  if (parts.length === 0) return true;
  return segments.includes(parts[0]);
}

export function ConditionalLayout({ children, chromelessSegments = [] }: ConditionalLayoutProps) {
  const pathname = usePathname();

  // Auth demo pages and the SoiGuru screens render without the template chrome
  const hideChrome = pathname.includes("/auth-demo/") || isChromeless(pathname, chromelessSegments);

  return (
    <>
      {!hideChrome && <Header />}
      {/* id="main-content" lets skip-to-content anchors target it.
          Required by `skip-link-and-focus.spec.ts`. */}
      <main id="main-content" className="flex-1 bg-white dark:bg-[#0a0a0a]">
        {children}
      </main>
      {!hideChrome && <Footer />}
      {!hideChrome && (
        <div className="fixed bottom-6 right-6 z-50">
          <ScrollToTopButton
            variant="elegant"
            easing="easeInOut"
            showAfter={400}
            size="md"
          />
        </div>
      )}
    </>
  );
}
