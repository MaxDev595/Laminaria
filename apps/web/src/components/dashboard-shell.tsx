"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  BarChart3,
  CalendarClock,
  ChevronRight,
  Clapperboard,
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
    if (!mobileOpen) return;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousBodyOverflow = document.body.style.overflow;
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overflow = previousBodyOverflow;
    };
  }, [mobileOpen]);

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
      { href: "/dashboard/recordings", label: locale === "ru" ? "\u0417\u0430\u043f\u0438\u0441\u0438" : "Recordings", icon: Clapperboard },
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
                ? "\u041d\u0443\u0436\u0435\u043d \u0432\u0445\u043e\u0434"
                : "Sign in required"
              : locale === "ru"
                ? "API \u043d\u0435\u0434\u043e\u0441\u0442\u0443\u043f\u0435\u043d"
                : "API unavailable"
          }
          description={
            unauthorized
              ? locale === "ru"
                ? "\u0412\u043e\u0439\u0434\u0438\u0442\u0435 \u0432 \u0437\u0430\u0449\u0438\u0449\u0451\u043d\u043d\u044b\u0439 \u0430\u043a\u043a\u0430\u0443\u043d\u0442, \u0447\u0442\u043e\u0431\u044b \u043e\u0442\u043a\u0440\u044b\u0442\u044c \u043a\u0430\u0431\u0438\u043d\u0435\u0442."
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
          aria-label={locale === "ru" ? "\u0417\u0430\u043a\u0440\u044b\u0442\u044c \u043c\u0435\u043d\u044e" : "Close menu"}
        >
          <X size={20} />
        </button>
      </div>
      <label className="workspace-chip">
        <span>{workspace.name.slice(0, 1).toUpperCase()}</span>
        <div>
          <strong>{workspace.name}</strong>
          <small>{workspace.role ?? "OWNER"}</small>
        </div>
        <ChevronRight size={16} />
        <select
          aria-label={locale === "ru" ? "\u0412\u044b\u0431\u0440\u0430\u0442\u044c \u0440\u0430\u0431\u043e\u0447\u0435\u0435 \u043f\u0440\u043e\u0441\u0442\u0440\u0430\u043d\u0441\u0442\u0432\u043e" : "Select workspace"}
          value={workspace.id}
          onChange={(event) => {
            const nextId = event.target.value;
            window.localStorage.setItem("laminaria-workspace-id", nextId);
            setSelectedWorkspaceId(nextId);
            setMobileOpen(false);
          }}
        >
          {availableWorkspaces.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name} {" · "} {item.role}
            </option>
          ))}
        </select>
      </label>
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
              aria-label={locale === "ru" ? "\u041e\u0442\u043a\u0440\u044b\u0442\u044c \u043c\u0435\u043d\u044e" : "Open menu"}
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
