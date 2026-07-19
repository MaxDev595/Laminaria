"use client";

import { AnimatePresence, motion } from "motion/react";
import { Menu, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Link } from "@/i18n/navigation";
import { Button, Logo } from "@laminaria/ui";
import { LanguageSwitcher } from "./language-switcher";

export function MarketingHeader() {
  const t = useTranslations();
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const nav = [
    [`/${locale}#product`, t("shell.product")],
    [`/${locale}#workflow`, t("shell.workflow")],
    [`/${locale}#global`, t("shell.global")],
    [`/${locale}#security`, t("shell.security")],
  ] as const;

  return (
    <header className="marketing-header">
      <div className="marketing-header__inner">
        <Link href="/" className="brand-link" aria-label="Laminaria home">
          <Logo />
        </Link>
        <nav className="desktop-nav" aria-label={t("shell.mainNavigation")}>
          {nav.map(([href, label]) => (
            <a key={href} href={href}>
              {label}
            </a>
          ))}
        </nav>
        <div className="header-actions">
          <LanguageSwitcher />
          <Link href="/sign-in" className="header-signin">
            {t("auth.signIn")}
          </Link>
          <Link href="/sign-up" className="header-cta">
            <Button size="sm">{t("auth.signUp")}</Button>
          </Link>
          <button
            type="button"
            className="menu-button"
            aria-expanded={open}
            aria-label={open ? t("shell.closeMenu") : t("shell.openMenu")}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <X size={21} aria-hidden="true" /> : <Menu size={21} aria-hidden="true" />}
          </button>
        </div>
      </div>
      <AnimatePresence>
        {open ? (
          <motion.nav
            className="mobile-nav"
            aria-label={t("shell.mainNavigation")}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
          >
            {nav.map(([href, label]) => (
              <a key={href} href={href} onClick={() => setOpen(false)}>
                {label}
              </a>
            ))}
            <Link href="/sign-in" onClick={() => setOpen(false)}>
              {t("auth.signIn")}
            </Link>
            <Link href="/sign-up" onClick={() => setOpen(false)}>
              {t("auth.signUp")}
            </Link>
          </motion.nav>
        ) : null}
      </AnimatePresence>
    </header>
  );
}
