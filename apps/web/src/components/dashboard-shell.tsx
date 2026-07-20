"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  BarChart3,
  CalendarClock,
  Clapperboard,
  FilePenLine,
  Home,
  LogOut,
  Menu,
  Plus,
  Settings,
  UsersRound,
  Video,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";

import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { api, ApiError, friendlyError } from "@/lib/api";
import { Button, Logo, Skeleton } from "@laminaria/ui";
import { DashboardContextProvider } from "./dashboard-context";
import { LanguageSwitcher } from "./language-switcher";
import { ServiceState } from "./ui";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(() =>
    typeof window === "undefined" ? null : window.localStorage.getItem("laminaria-workspace-id"),
  );
  const me = useQuery({ queryKey: ["me"], queryFn: ({ signal }) => api.me(signal) });
  const workspaces = useQuery({
    queryKey: ["workspaces"],
    queryFn: api.listWorkspaces,
    enabled: me.isSuccess,
  });

  useEffect(() => {
    if (workspaces.isSuccess && workspaces.data.workspaces.length === 0) {
      router.replace("/onboarding");
    }
  }, [workspaces.isSuccess, workspaces.data, router]);

  const nav = useMemo(
    () => [
      { href: "/dashboard", label: t("nav.overview"), icon: Home },
      { href: "/dashboard/upcoming", label: t("nav.upcoming"), icon: CalendarClock },
      { href: "/dashboard/past", label: t("nav.past"), icon: Video },
      { href: "/dashboard/drafts", label: t("nav.drafts"), icon: FilePenLine },
      { href: "/dashboard/recordings", label: locale === "ru" ? "Р вЂ”Р В°Р С—Р С‘РЎРѓР С‘" : "Recordings", icon: Clapperboard },
      { href: "/dashboard/analytics", label: t("nav.analytics"), icon: BarChart3 },
      { href: "/dashboard/team", label: t("nav.team"), icon: UsersRound },
      { href: "/dashboard/settings", label: t("nav.settings"), icon: Settings },
    ],
    [locale, t],
  );

  if (me.isLoading || workspaces.isLoading) return <DashboardSkeleton />;

  if (me.isError || workspaces.isError) {
    const unauthorized = me.error instanceof ApiError && me.error.status === 401;
    return (
      <main className="dashboard-gate">
        <Logo />
        <ServiceState
          icon={<AlertTriangle size={20} />}
          title={
            unauthorized
              ? locale === "ru"
                ? "Р В РЎСљР РЋРЎвЂњР В Р’В¶Р В Р’ВµР В Р вЂ¦ Р В Р вЂ Р РЋРІР‚В¦Р В РЎвЂўР В РўвЂ"
                : "Sign in required"
              : locale === "ru"
                ? "API Р В Р вЂ¦Р В Р’ВµР В РўвЂР В РЎвЂўР РЋР С“Р РЋРІР‚С™Р РЋРЎвЂњР В РЎвЂ”Р В Р’ВµР В Р вЂ¦"
                : "API unavailable"
          }
          description={
            unauthorized
              ? locale === "ru"
                ? "Р В РІР‚в„ўР В РЎвЂўР В РІвЂћвЂ“Р В РўвЂР В РЎвЂР РЋРІР‚С™Р В Р’Вµ Р В Р вЂ  Р В Р’В·Р В Р’В°Р РЋРІР‚В°Р В РЎвЂР РЋРІР‚В°Р РЋРІР‚ВР В Р вЂ¦Р В Р вЂ¦Р РЋРІР‚в„–Р В РІвЂћвЂ“ Р В Р’В°Р В РЎвЂќР В РЎвЂќР В Р’В°Р РЋРЎвЂњР В Р вЂ¦Р РЋРІР‚С™, Р РЋРІР‚РЋР РЋРІР‚С™Р В РЎвЂўР В Р’В±Р РЋРІР‚в„– Р В РЎвЂўР РЋРІР‚С™Р В РЎвЂќР РЋР вЂљР РЋРІР‚в„–Р РЋРІР‚С™Р РЋР Р‰ Р В РЎвЂќР В Р’В°Р В Р’В±Р В РЎвЂР В Р вЂ¦Р В Р’ВµР РЋРІР‚С™."
                : "Sign in to your secure account to open the dashboard."
              : friendlyError(me.error ?? workspaces.error, locale)
          }
          action={
            unauthorized ? (
              <Link href="/sign-in">
                <Button>{t("auth.signIn")}</Button>
              </Link>
            ) : (
              <Button
                variant="secondary"
                onClick={() => {
                  void me.refetch();
                  void workspaces.refetch();
                }}
              >
                {t("common.retry")}
              </Button>
            )
          }
        />
      </main>
    );
  }

  const availableWorkspaces = workspaces.data?.workspaces ?? [];
  const workspace =
    availableWorkspaces.find((item) => item.id === selectedWorkspaceId) ?? availableWorkspaces[0];
  if (!me.data || !workspace) return <DashboardSkeleton />;
  const canCreateWebinars = workspace.role === "OWNER" || workspace.role === "ADMIN";

  async function signOut() {
    try {
      await api.signOut();
    } finally {
      queryClient.clear();
      router.replace("/sign-in");
    }
  }

  const currentLabel = nav.find((item) => item.href === pathname)?.label ?? t("shell.workspace");
  const sidebar = (
    <>
      <div className="dashboard-sidebar__brand">
        <Link href="/dashboard">
          <Logo />
        </Link>
        <button
          type="button"
          className="sidebar-close"
          onClick={() => setMobileOpen(false)}
          aria-label={locale === "ru" ? "Р В РІР‚вЂќР В Р’В°Р В РЎвЂќР РЋР вЂљР РЋРІР‚в„–Р РЋРІР‚С™Р РЋР Р‰ Р В РЎВР В Р’ВµР В Р вЂ¦Р РЋР вЂ№" : "Close menu"}
        >
          <X size={20} />
        </button>
      </div>
      <motion.div
        key={workspace.id}
        className="workspace-chip workspace-chip--menu"
        initial={{ opacity: 0, y: 8, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        whileHover={{ y: -2 }}
        whileTap={{ scale: 0.985 }}
        transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setWorkspaceMenuOpen(false);
        }}
      >
        <button
          type="button"
          className="workspace-chip__button"
          aria-haspopup="listbox"
          aria-expanded={workspaceMenuOpen}
          aria-label={locale === "ru" ? "Выбрать рабочее пространство" : "Select workspace"}
          onClick={() => setWorkspaceMenuOpen((current) => !current)}
        >
          <span>{workspace.name.slice(0, 1).toUpperCase()}</span>
          <div>
            <strong>{workspace.name}</strong>
            <small>{workspace.role ?? "OWNER"}</small>
          </div>
        </button>
        <AnimatePresence>
          {workspaceMenuOpen ? (
            <motion.div
              className="workspace-menu"
              role="listbox"
              initial={{ opacity: 0, y: -8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.98 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            >
              {availableWorkspaces.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="option"
                  aria-selected={item.id === workspace.id}
                  className={item.id === workspace.id ? "is-active" : ""}
                  onClick={() => {
                    window.localStorage.setItem("laminaria-workspace-id", item.id);
                    setSelectedWorkspaceId(item.id);
                    setWorkspaceMenuOpen(false);
                    setMobileOpen(false);
                  }}
                >
                  <span>{item.name.slice(0, 1).toUpperCase()}</span>
                  <div>
                    <strong>{item.name}</strong>
                    <small>{item.role ?? "OWNER"}</small>
                  </div>
                </button>
              ))}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </motion.div>
      <nav className="dashboard-nav" aria-label={t("shell.mainNavigation")}>
        {nav.map((item) => {
          const active =
            item.href === "/dashboard" ? pathname === item.href : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={active ? "is-active" : ""}
              onClick={() => setMobileOpen(false)}
            >
              <Icon size={18} />
              <span>{item.label}</span>
              {active ? <motion.i layoutId="dashboard-nav-active" /> : null}
            </Link>
          );
        })}
      </nav>
      <button type="button" className="sidebar-signout" onClick={() => void signOut()}>
        <LogOut size={17} />
        {t("auth.signOut")}
      </button>
    </>
  );

  return (
    <DashboardContextProvider value={{ user: me.data.user, workspace }}>
      <div className="dashboard-shell">
        <aside className="dashboard-sidebar">{sidebar}</aside>
        <AnimatePresence>
          {mobileOpen ? (
            <>
              <motion.div
                className="sidebar-backdrop"
                onClick={() => setMobileOpen(false)}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              />
              <motion.aside
                className="dashboard-sidebar dashboard-sidebar--mobile"
                initial={{ x: "-100%" }}
                animate={{ x: 0 }}
                exit={{ x: "-100%" }}
              >
                {sidebar}
              </motion.aside>
            </>
          ) : null}
        </AnimatePresence>
        <div className="dashboard-main">
          <header className="dashboard-topbar">
            <button
              type="button"
              className="topbar-menu"
              onClick={() => setMobileOpen(true)}
              aria-label={locale === "ru" ? "Р В РЎвЂєР РЋРІР‚С™Р В РЎвЂќР РЋР вЂљР РЋРІР‚в„–Р РЋРІР‚С™Р РЋР Р‰ Р В РЎВР В Р’ВµР В Р вЂ¦Р РЋР вЂ№" : "Open menu"}
            >
              <Menu size={20} />
            </button>
            <div className="topbar-context">
              <span>{workspace.name}</span>
              <i />
              <strong>{currentLabel}</strong>
            </div>
            <div className="topbar-actions">
              <LanguageSwitcher />
              {canCreateWebinars ? (
                <Link href="/dashboard/webinars/new">
                  <Button size="sm">
                    <Plus size={17} />
                    {t("nav.newWebinar")}
                  </Button>
                </Link>
              ) : null}
              <motion.span
                key={`${pathname}-${me.data.user.id}`}
                className="account-chip"
                title={me.data.user.name}
                initial={{ opacity: 0, y: -6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
              >
                <span className="user-avatar">{me.data.user.name.slice(0, 1).toUpperCase()}</span>
                <span>
                  <strong>{me.data.user.name}</strong>
                  <small>{workspace.role ?? "OWNER"}</small>
                </span>
              </motion.span>
            </div>
          </header>
          <main className="dashboard-content">{children}</main>
        </div>
      </div>
    </DashboardContextProvider>
  );
}


function DashboardSkeleton() {
  return (
    <div className="dashboard-shell dashboard-shell--loading">
      <aside className="dashboard-sidebar">
        <Logo />
        <div className="skeleton-stack">
          <Skeleton style={{ height: 56 }} />
          <Skeleton style={{ height: 40 }} />
          <Skeleton style={{ height: 40 }} />
          <Skeleton style={{ height: 40 }} />
        </div>
      </aside>
      <main className="dashboard-content">
        <Skeleton style={{ height: 52, width: "38%" }} />
        <div className="dashboard-skeleton-grid">
          <Skeleton style={{ height: 170 }} />
          <Skeleton style={{ height: 170 }} />
          <Skeleton style={{ height: 260 }} />
        </div>
      </main>
    </div>
  );
}
