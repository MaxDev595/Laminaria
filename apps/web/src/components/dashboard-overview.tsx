"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowUpRight,
  CalendarPlus,
  CircleOff,
  Clock3,
  LoaderCircle,
  Play,
  Radio,
  Square,
  UserPlus,
  UsersRound,
  Video,
} from "lucide-react";
import { motion } from "motion/react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Link, useRouter } from "@/i18n/navigation";
import { api, friendlyError, type Webinar } from "@/lib/api";
import { formatLocalDate } from "@/lib/text";
import { Badge, Button, Skeleton } from "@laminaria/ui";
import { useDashboard } from "./dashboard-context";
import { ServiceState } from "./ui";

export function DashboardOverview({ filter }: { filter?: "upcoming" | "past" | "drafts" }) {
  const t = useTranslations();
  const locale = useLocale();
  const { user, workspace } = useDashboard();
  const query = useQuery({ queryKey: ["webinars", workspace.id], queryFn: () => api.listWebinars(workspace.id) });

  if (query.isLoading) return <DashboardOverviewSkeleton />;
  if (query.isError) {
    return (
      <div className="dashboard-page">
        <PageHeading eyebrow={workspace.name} title={`${t("dashboard.greeting")}, ${user.name.split(" ")[0]}`} body={t("dashboard.subtitle")} />
        <ServiceState
          icon={<CircleOff size={20} />}
          title={locale === "ru" ? "Не удалось загрузить вебинары" : "Webinars could not be loaded"}
          description={friendlyError(query.error, locale)}
          action={<Button variant="secondary" onClick={() => void query.refetch()}>{t("common.retry")}</Button>}
        />
      </div>
    );
  }

  const all = query.data!.webinars;
  const now = query.dataUpdatedAt;
  const visible = filter === "upcoming"
    ? all.filter((webinar) => webinar.status === "SCHEDULED" || webinar.status === "LIVE")
    : filter === "past"
      ? all.filter((webinar) => webinar.status === "ENDED" || webinar.status === "ARCHIVED")
      : filter === "drafts"
        ? all.filter((webinar) => webinar.status === "DRAFT")
        : all;
  const scheduled = all.filter((webinar) => webinar.status === "SCHEDULED" && (!webinar.scheduledStartAt || new Date(webinar.scheduledStartAt).getTime() >= now));
  const title = filter === "upcoming"
    ? t("nav.upcoming")
    : filter === "past"
      ? t("nav.past")
      : filter === "drafts"
        ? t("nav.drafts")
        : `${t("dashboard.greeting")}, ${user.name.split(" ")[0]}`;

  return (
    <div className="dashboard-page">
      <PageHeading
        eyebrow={workspace.name}
        title={title}
        body={filter ? (locale === "ru" ? "Все данные загружаются из вашего рабочего пространства." : "Everything here comes from your workspace.") : t("dashboard.subtitle")}
        action={<Link href="/dashboard/webinars/new"><Button><CalendarPlus size={17} />{t("nav.newWebinar")}</Button></Link>}
      />
      {!filter ? (
        <div className="metrics-grid">
          <Metric label={t("dashboard.liveNow")} value={String(all.filter((webinar) => webinar.status === "LIVE").length)} icon={<Radio />} tone="primary" />
          <Metric label={t("dashboard.scheduled")} value={String(scheduled.length)} icon={<Clock3 />} />
          <Metric label={t("dashboard.draft")} value={String(all.filter((webinar) => webinar.status === "DRAFT").length)} icon={<CalendarPlus />} />
        </div>
      ) : null}
      <section className="dashboard-section">
        <div className="dashboard-section__heading">
          <div>
            <span>{filter ? title : t("dashboard.nextWebinar")}</span>
            <h2>{filter ? (locale === "ru" ? "Ваши вебинары" : "Your webinars") : (locale === "ru" ? "Ближайшие комнаты" : "Rooms coming up")}</h2>
          </div>
          {!filter ? <Link href="/dashboard/upcoming">{locale === "ru" ? "Все предстоящие" : "View all"}<ArrowUpRight size={16} /></Link> : null}
        </div>
        {visible.length === 0 ? (
          <EmptyWebinars locale={locale} t={t} />
        ) : (
          <div className="webinar-list">
            {visible.map((webinar, index) => <WebinarCard key={webinar.id} webinar={webinar} locale={locale} index={index} />)}
          </div>
        )}
      </section>
    </div>
  );
}

export function PageHeading({ eyebrow, title, body, action }: { eyebrow?: string; title: string; body?: string; action?: React.ReactNode }) {
  return <header className="dashboard-page-heading"><div>{eyebrow ? <span>{eyebrow}</span> : null}<h1>{title}</h1>{body ? <p>{body}</p> : null}</div>{action}</header>;
}

function Metric({ label, value, icon, tone }: { label: string; value: string; icon: React.ReactNode; tone?: string }) {
  return <motion.article className={`metric-card ${tone ? `metric-card--${tone}` : ""}`} whileHover={{ y: -3 }}><span>{icon}</span><div><strong>{value}</strong><small>{label}</small></div></motion.article>;
}

function WebinarCard({ webinar, locale, index }: { webinar: Webinar; locale: string; index: number }) {
  const { workspace } = useDashboard();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [busy, setBusy] = useState<"start" | "studio" | "end" | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"MODERATOR" | "SPEAKER" | "COHOST">("MODERATOR");
  const [inviteBusy, setInviteBusy] = useState(false);
  const [error, setError] = useState("");
  const tone = webinar.status === "LIVE" ? "danger" : webinar.status === "SCHEDULED" ? "primary" : webinar.status === "ENDED" ? "success" : "neutral";
  const canStart = webinar.status === "SCHEDULED";
  const canJoinStudio = webinar.status === "LIVE";
  const canEnd = webinar.status === "LIVE";

  async function refreshWebinars() {
    await queryClient.invalidateQueries({ queryKey: ["webinars", workspace.id] });
  }

  async function startLive() {
    setBusy("start");
    setError("");
    try {
      await api.transitionWebinar(workspace.id, webinar.id, "LIVE", webinar.version);
      await refreshWebinars();
    } catch (reason) {
      setError(friendlyError(reason, locale));
    } finally {
      setBusy(null);
    }
  }

  async function endLive() {
    const confirmed = window.confirm(locale === "ru" ? "Завершить вебинар для всех участников?" : "End this webinar for all participants?");
    if (!confirmed) return;
    setBusy("end");
    setError("");
    try {
      await api.transitionWebinar(workspace.id, webinar.id, "ENDED", webinar.version);
      sessionStorage.removeItem(`laminaria-room:${webinar.slug}`);
      await refreshWebinars();
    } catch (reason) {
      setError(friendlyError(reason, locale));
    } finally {
      setBusy(null);
    }
  }

  async function joinStudio() {
    setBusy("studio");
    setError("");
    try {
      const payload = await api.hostPrejoin(workspace.id, webinar.id);
      sessionStorage.setItem(`laminaria-room:${webinar.slug}`, JSON.stringify({ ...payload, preferences: { cameraOn: true, micOn: true } }));
      router.push(`/room/${webinar.slug}`);
    } catch (reason) {
      setError(friendlyError(reason, locale));
    } finally {
      setBusy(null);
    }
  }

  async function assignHostRole() {
    const email = inviteEmail.trim();
    if (!email) return;
    setInviteBusy(true);
    setError("");
    try {
      await api.assignWebinarHost(workspace.id, webinar.id, { email, role: inviteRole });
      setInviteEmail("");
    } catch (reason) {
      setError(friendlyError(reason, locale));
    } finally {
      setInviteBusy(false);
    }
  }

  return (
    <motion.article className="webinar-card" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04 }}>
      <div className="webinar-card__date">
        <strong>{webinar.scheduledStartAt ? new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "en-US", { day: "2-digit" }).format(new Date(webinar.scheduledStartAt)) : "—"}</strong>
        <span>{webinar.scheduledStartAt ? new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "en-US", { month: "short" }).format(new Date(webinar.scheduledStartAt)) : locale === "ru" ? "Дата" : "Date"}</span>
      </div>
      {webinar.coverImageUrl ? <div className="webinar-card__banner" style={{ backgroundImage: `url(${webinar.coverImageUrl})` }} /> : null}
      <div className="webinar-card__main">
        <div>
          <Badge tone={tone as "neutral" | "primary" | "success" | "danger"}>{webinar.status}</Badge>
          <h3>{webinar.title}</h3>
          <p>{webinar.description || (locale === "ru" ? "Описание ещё не добавлено" : "No description yet")}</p>
          {error ? <div className="webinar-card__error">{error}</div> : null}
        </div>
        <div className="webinar-card__meta">
          <span><Clock3 size={15} />{webinar.scheduledStartAt ? formatLocalDate(webinar.scheduledStartAt, locale) : (locale === "ru" ? "Время не назначено" : "Not scheduled")}</span>
          <span><UsersRound size={15} />{webinar.visibility === "PUBLIC" ? (locale === "ru" ? "Открытая регистрация" : "Public registration") : (locale === "ru" ? "По приглашению" : "Invite only")}</span>
        </div>
      </div>
      <div className="webinar-card__actions">
        {canStart ? (
          <Button size="sm" onClick={() => void startLive()} disabled={busy !== null}>
            {busy === "start" ? <LoaderCircle className="spin" size={16} /> : <Play size={16} />}
            {locale === "ru" ? "Запустить" : "Start"}
          </Button>
        ) : null}
        {canJoinStudio ? (
          <Button size="sm" onClick={() => void joinStudio()} disabled={busy !== null}>
            {busy === "studio" ? <LoaderCircle className="spin" size={16} /> : <Video size={16} />}
            {locale === "ru" ? "В студию" : "Studio"}
          </Button>
        ) : null}
        {canEnd ? (
          <Button size="sm" variant="secondary" onClick={() => void endLive()} disabled={busy !== null}>
            {busy === "end" ? <LoaderCircle className="spin" size={16} /> : <Square size={16} />}
            {locale === "ru" ? "Завершить" : "End"}
          </Button>
        ) : null}
        {webinar.status === "SCHEDULED" || webinar.status === "LIVE" ? (
          <Link className="webinar-card__open" href={`/w/${webinar.slug}`} aria-label={locale === "ru" ? "Открыть страницу вебинара" : "Open webinar page"}><ArrowUpRight size={18} /></Link>
        ) : null}
      </div>
      <div className="webinar-role-form">
        <input
          value={inviteEmail}
          onChange={(event) => setInviteEmail(event.target.value)}
          placeholder={locale === "ru" ? "email модератора" : "moderator email"}
          type="email"
        />
        <select value={inviteRole} onChange={(event) => setInviteRole(event.target.value as "MODERATOR" | "SPEAKER" | "COHOST")}>
          <option value="MODERATOR">{locale === "ru" ? "Модератор" : "Moderator"}</option>
          <option value="SPEAKER">{locale === "ru" ? "Спикер" : "Speaker"}</option>
          <option value="COHOST">{locale === "ru" ? "Со-ведущий" : "Co-host"}</option>
        </select>
        <button type="button" onClick={() => void assignHostRole()} disabled={inviteBusy || !inviteEmail.trim()}>
          {inviteBusy ? <LoaderCircle className="spin" size={15} /> : <UserPlus size={15} />}
          {locale === "ru" ? "Назначить" : "Assign"}
        </button>
      </div>
    </motion.article>
  );
}

function EmptyWebinars({ locale, t }: { locale: string; t: ReturnType<typeof useTranslations> }) {
  return (
    <div className="empty-webinars">
      <div className="empty-illustration" aria-hidden="true"><span /><span /><span /></div>
      <h3>{t("dashboard.noUpcoming")}</h3>
      <p>{t("dashboard.noUpcomingBody")}</p>
      <Link href="/dashboard/webinars/new"><Button><CalendarPlus size={17} />{t("nav.newWebinar")}</Button></Link>
      <small>{locale === "ru" ? "Здесь не используются демонстрационные вебинары: появятся только ваши реальные данные." : "No demo webinars are inserted here: only your real data will appear."}</small>
    </div>
  );
}

function DashboardOverviewSkeleton() {
  return <div className="dashboard-page"><Skeleton style={{ height: 52, width: "45%" }} /><div className="metrics-grid"><Skeleton style={{ height: 120 }} /><Skeleton style={{ height: 120 }} /><Skeleton style={{ height: 120 }} /></div><Skeleton style={{ height: 300 }} /></div>;
}
