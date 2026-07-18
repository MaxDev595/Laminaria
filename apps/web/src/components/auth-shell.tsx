import { ArrowLeft, ShieldCheck, Waves } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Logo } from "@laminaria/ui";
import { LanguageSwitcher } from "./language-switcher";
import { ThemeToggle } from "./theme-toggle";

export async function AuthShell({
  children,
  locale,
}: {
  children: React.ReactNode;
  locale: string;
}) {
  const t = await getTranslations({ locale });
  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <div className="auth-panel__top">
          <Link href="/dashboard" className="brand-link">
            <Logo />
          </Link>
          <div>
            <LanguageSwitcher />
            <ThemeToggle />
          </div>
        </div>
        <div className="auth-panel__content">{children}</div>
        <Link href="/" className="auth-back">
          <ArrowLeft size={16} />
          {locale === "ru" ? "На главную" : "Back home"}
        </Link>
      </section>
      <aside
        className="auth-atmosphere"
        aria-label={locale === "ru" ? "О Laminaria" : "About Laminaria"}
      >
        <div className="auth-atmosphere__light" aria-hidden="true" />
        <div className="auth-mark" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div className="auth-atmosphere__copy">
          <span className="section-kicker">
            <Waves size={17} />
            {t("landing.eyebrow")}
          </span>
          <blockquote>
            {locale === "ru"
              ? "Ведущий видит главное. Зритель чувствует себя желанным гостем."
              : "The host sees what matters. The audience feels welcome."}
          </blockquote>
          <div className="auth-proof">
            <ShieldCheck size={18} />
            <span>
              {locale === "ru"
                ? "Сессии, роли и медиаправа проверяются сервером"
                : "Sessions, roles, and media grants are verified server-side"}
            </span>
          </div>
        </div>
      </aside>
    </main>
  );
}
