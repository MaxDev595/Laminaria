"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  BarChart3,
  CalendarClock,
  ChevronRight,
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
import { ThemeToggle } from "./theme-toggle";
import { ServiceState } from "./ui";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null);
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

  useEffect(() => {
    if (!workspaces.isSuccess || workspaces.data.workspaces.length === 0) return;
    const available = workspaces.data.workspaces;
    const saved = window.localStorage.getItem("laminaria-workspace-id");
    const next = available.some((workspace) => workspace.id === saved)
      ? saved
      : available[0]!.id;
    setSelectedWorkspaceId((current) =>
      current && available.some((workspace) => workspace.id === current) ? current : next,
    );
  }, [workspaces.isSuccess, workspaces.data]);

  const nav = useMemo(
    () => [
      { href: "/dashboard", label: t("nav.overview"), icon: Home },
      { href: "/dashboard/upcoming", label: t("nav.upcoming"), icon: CalendarClock },
      { href: "/dashboard/past", label: t("nav.past"), icon: Video },
      { href: "/dashboard/drafts", label: t("nav.drafts"), icon: FilePenLine },
      { href: "/dashboard/analytics", label: t("nav.analytics"), icon: BarChart3 },
      { href: "/dashboard/team", label: t("nav.team"), icon: UsersRound },
      { href: "/dashboard/settings", label: t("nav.settings"), icon: Settings },
    ],
    [t],
  );

  if (me.isLoading || workspaces.isLoading) return <DashboardSkeleton />;

  if (me.isError || workspaces.isError) {
    const unauthorized = me.error instanceof ApiError && me.error.status === 401;
    return (
      <main className="dashboard-gate">
        <Logo />
        <ServiceState
          icon={<AlertTriangle size={20} />}
          title={unauthorized ? (locale === "ru" ? "Нужен вход" : "Sign in required") : (locale === "ru" ? "API недоступен" : "API unavailable")}
          description={
            unauthorized
              ? locale === "ru"
                ? "Войдите в защищённый аккаунт, чтобы открыть кабинет."
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
    availableWorkspaces.find((item) => item.id === selectedWorkspaceId) ??
    availableWorkspaces[0];
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
          aria-label={locale === "ru" ? "Закрыть меню" : "Close menu"}
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
          aria-label={locale === "ru" ? "Выбрать рабочее пространство" : "Select workspace"}
          value={workspace.id}
          onChange={(event) => {
            const nextId = event.target.value;
            window.localStorage.setItem("laminaria-workspace-id", nextId);
            setSelectedWorkspaceId(nextId);
            setMobileOpen(false);
          }}
        >
          {availableWorkspaces.map((item) => (
            <option key={item.id} value={item.id}>{item.name} · {item.role}</option>
          ))}
        </select>
      </label>
      <nav className="dashboard-nav" aria-label={t("shell.mainNavigation")}>
        {nav.map((item) => {
          const active = item.href === "/dashboard" ? pathname === item.href : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} className={active ? "is-active" : ""} onClick={() => setMobileOpen(false)}>
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
              aria-label={locale === "ru" ? "Открыть меню" : "Open menu"}
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
              <ThemeToggle />
              {canCreateWebinars ? (
                <Link href="/dashboard/webinars/new">
                  <Button size="sm">
                    <Plus size={17} />
                    {t("nav.newWebinar")}
                  </Button>
                </Link>
              ) : null}
              <span className="user-avatar" title={me.data.user.name}>
                {me.data.user.name.slice(0, 1).toUpperCase()}
              </span>
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
