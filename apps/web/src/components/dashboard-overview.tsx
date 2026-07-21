"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowUpRight,
  CalendarPlus,
  Clapperboard,
  CircleOff,
  Clock3,
  Copy,
  Download,
  LoaderCircle,
  Play,
  Radio,
  Square,
  Trash2,
  UserPlus,
  UsersRound,
  Video,
} from "lucide-react";
import { motion } from "motion/react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Link, useRouter } from "@/i18n/navigation";
import { api, friendlyError, type Recording, type Webinar, type WebinarRole } from "@/lib/api";
import { formatLocalDate } from "@/lib/text";
import { Badge, Button, Skeleton } from "@laminaria/ui";
import { useDashboard } from "./dashboard-context";
import { ServiceState } from "./ui";
import { StyledSelect } from "./styled-select";

export function DashboardOverview({ filter }: { filter?: "upcoming" | "past" }) {
  const t = useTranslations();
  const locale = useLocale();
  const { user, workspace } = useDashboard();
  const query = useQuery({
    queryKey: ["webinars", workspace.id],
    queryFn: () => api.listWebinars(workspace.id),
  });

  if (query.isLoading) return <DashboardOverviewSkeleton />;
  if (query.isError) {
    return (
      <div className="dashboard-page">
        <PageHeading
          eyebrow={workspace.name}
          title={`${t("dashboard.greeting")}, ${user.name.split(" ")[0]}`}
          body={t("dashboard.subtitle")}
        />
        <ServiceState
          icon={<CircleOff size={20} />}
          title={locale === "ru" ? "Не удалось загрузить вебинары" : "Webinars could not be loaded"}
          description={friendlyError(query.error, locale)}
          action={
            <Button variant="secondary" onClick={() => void query.refetch()}>
              {t("common.retry")}
            </Button>
          }
        />
      </div>
    );
  }

  const all = query.data!.webinars;
  const canCreateWebinars = workspace.role === "OWNER" || workspace.role === "ADMIN";
  const now = query.dataUpdatedAt;
  const visible =
    filter === "upcoming"
      ? all.filter((webinar) => webinar.status === "SCHEDULED" || webinar.status === "LIVE")
      : filter === "past"
        ? all.filter((webinar) => webinar.status === "ENDED" || webinar.status === "ARCHIVED")
        : all;
  const scheduled = all.filter(
    (webinar) =>
      webinar.status === "SCHEDULED" &&
      (!webinar.scheduledStartAt || new Date(webinar.scheduledStartAt).getTime() >= now),
  );
  const title =
    filter === "upcoming"
      ? t("nav.upcoming")
      : filter === "past"
        ? t("nav.past")
        : `${t("dashboard.greeting")}, ${user.name.split(" ")[0]}`;

  return (
    <div className="dashboard-page">
      <PageHeading
        eyebrow={workspace.name}
        title={title}
        body={
          filter
            ? locale === "ru"
              ? "Все данные загружаются из вашего рабочего пространства."
              : "Everything here comes from your workspace."
            : t("dashboard.subtitle")
        }
        action={
          canCreateWebinars ? (
            <Link href="/dashboard/webinars/new">
              <Button>
                <CalendarPlus size={17} />
                {t("nav.newWebinar")}
              </Button>
            </Link>
          ) : null
        }
      />
      {!filter ? (
        <div className="metrics-grid">
          <Metric
            label={t("dashboard.liveNow")}
            value={String(all.filter((webinar) => webinar.status === "LIVE").length)}
            icon={<Radio />}
            tone="primary"
          />
          <Metric
            label={t("dashboard.scheduled")}
            value={String(scheduled.length)}
            icon={<Clock3 />}
          />
          <Metric
            label={t("dashboard.draft")}
            value={String(all.filter((webinar) => webinar.status === "DRAFT").length)}
            icon={<CalendarPlus />}
          />
        </div>
      ) : null}
      <section className="dashboard-section">
        <div className="dashboard-section__heading">
          <div>
            <span>{filter ? title : t("dashboard.nextWebinar")}</span>
            <h2>
              {filter
                ? locale === "ru"
                  ? "Ваши вебинары"
                  : "Your webinars"
                : locale === "ru"
                  ? "Ближайшие комнаты"
                  : "Rooms coming up"}
            </h2>
          </div>
          {!filter ? (
            <Link href="/dashboard/upcoming">
              {locale === "ru" ? "Все предстоящие" : "View all"}
              <ArrowUpRight size={16} />
            </Link>
          ) : null}
        </div>
        {visible.length === 0 ? (
          <EmptyWebinars locale={locale} t={t} canCreate={canCreateWebinars} />
        ) : (
          <div className="webinar-list">
            {visible.map((webinar, index) => (
              <WebinarCard key={webinar.id} webinar={webinar} locale={locale} index={index} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export function PageHeading({
  eyebrow,
  title,
  body,
  action,
}: {
  eyebrow?: string;
  title: string;
  body?: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="dashboard-page-heading">
      <div>
        {eyebrow ? <span>{eyebrow}</span> : null}
        <h1>{title}</h1>
        {body ? <p>{body}</p> : null}
      </div>
      {action}
    </header>
  );
}

export function DashboardRecordings() {
  const locale = useLocale();
  const { workspace } = useDashboard();
  const queryClient = useQueryClient();
  const [busyRecordingId, setBusyRecordingId] = useState<string | null>(null);
  const recordingsQuery = useQuery({
    queryKey: ["recordings-page", workspace.id],
    queryFn: async () => {
      const { webinars } = await api.listWebinars(workspace.id);
      const completed = webinars.filter(
        (webinar) => webinar.status === "ENDED" || webinar.status === "ARCHIVED",
      );
      const rows = await Promise.all(
        completed.map(async (webinar) => {
          const { recordings } = webinar.recordingEnabled
            ? await api.listRecordings(workspace.id, webinar.id).catch(() => ({
                recordings: [] as Recording[],
              }))
            : { recordings: [] as Recording[] };
          return { webinar, recordings };
        }),
      );
      return rows;
    },
  });

  async function deleteRecording(webinar: Webinar, recording: Recording) {
    const confirmed = window.confirm(
      locale === "ru" ? "Удалить запись вебинара?" : "Delete this webinar recording?",
    );
    if (!confirmed) return;
    setBusyRecordingId(recording.id);
    try {
      await api.deleteRecording(workspace.id, webinar.id, recording.id);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["recordings-page", workspace.id] }),
        queryClient.invalidateQueries({ queryKey: ["recordings", workspace.id, webinar.id] }),
      ]);
    } finally {
      setBusyRecordingId(null);
    }
  }

  const rows = recordingsQuery.data ?? [];

  return (
    <div className="dashboard-page">
      <PageHeading
        eyebrow={workspace.name}
        title={locale === "ru" ? "Записи вебинаров" : "Webinar recordings"}
        body={
          locale === "ru"
            ? "Все записи проведённых вебинаров собраны отдельно: скачать, проверить статус или удалить."
            : "All completed webinar recordings live here: download, check status, or delete."
        }
      />
      {recordingsQuery.isLoading ? (
        <div className="recordings-grid">
          <Skeleton style={{ height: 190 }} />
          <Skeleton style={{ height: 190 }} />
        </div>
      ) : recordingsQuery.isError ? (
        <ServiceState
          icon={<CircleOff size={20} />}
          title={locale === "ru" ? "Записи не загрузились" : "Recordings could not be loaded"}
          description={friendlyError(recordingsQuery.error, locale)}
          action={
            <Button variant="secondary" onClick={() => void recordingsQuery.refetch()}>
              {locale === "ru" ? "Повторить" : "Retry"}
            </Button>
          }
        />
      ) : rows.length === 0 ? (
        <ServiceState
          icon={<Clapperboard size={20} />}
          title={locale === "ru" ? "Записей пока нет" : "No recordings yet"}
          description={
            locale === "ru"
              ? "После завершения вебинара запись появится здесь отдельной карточкой."
              : "After a webinar ends, its recording will appear here as a separate card."
          }
        />
      ) : (
        <div className="recordings-grid">
          {rows.map(({ webinar, recordings }) => {
            const recording = recordings[0] ?? null;
            const status = webinar.recordingEnabled ? (recording?.status ?? "PENDING") : "LOCKED";
            return (
              <motion.article
                className="recording-card"
                key={webinar.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ y: -3 }}
              >
                <div className="recording-card__top">
                  <span className={`recording-card__status is-${status.toLowerCase()}`}>
                    <Clapperboard size={15} />
                    {status}
                  </span>
                  <small>{webinar.status}</small>
                </div>
                <h3>{webinar.title}</h3>
                <p>
                  {webinar.endedAt
                    ? formatLocalDate(webinar.endedAt, locale)
                    : webinar.scheduledStartAt
                      ? formatLocalDate(webinar.scheduledStartAt, locale)
                      : locale === "ru"
                        ? "Дата не указана"
                        : "No date"}
                </p>
                <div className="recording-card__meta">
                  <span>
                    {locale === "ru" ? "Провайдер" : "Provider"}: {recording?.provider ?? "LiveKit"}
                  </span>
                  <span>
                    {locale === "ru" ? "Файл" : "File"}:{" "}
                    {recording?.playbackUrl
                      ? locale === "ru"
                        ? "готов"
                        : "ready"
                      : locale === "ru"
                        ? "ожидается"
                        : "pending"}
                  </span>
                </div>
                <div className="recording-card__actions">
                  {recording?.status === "READY" ? (
                    <Link className="webinar-card__download" href={`/recordings/${recording.id}`}>
                      <Play size={16} />
                      {locale === "ru" ? "Смотреть" : "Watch"}
                    </Link>
                  ) : null}
                  {recording?.status === "READY" ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        void navigator.clipboard.writeText(
                          `${window.location.origin}/${locale}/recordings/${recording.id}`,
                        )
                      }
                    >
                      <Copy size={16} />
                      {locale === "ru" ? "Ссылка" : "Copy link"}
                    </Button>
                  ) : null}
                  {recording?.playbackUrl ? (
                    <a className="webinar-card__download" href={recording.playbackUrl} download>
                      <Download size={16} />
                      {locale === "ru" ? "Скачать" : "Download"}
                    </a>
                  ) : (
                    <Button size="sm" variant="secondary" disabled>
                      <Clapperboard size={16} />
                      {webinar.recordingEnabled
                        ? locale === "ru"
                          ? "Файл готовится"
                          : "Preparing"
                        : locale === "ru"
                          ? "Доступно в Pro"
                          : "Available on Pro"}
                    </Button>
                  )}
                  {recording ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => void deleteRecording(webinar, recording)}
                      disabled={busyRecordingId === recording.id}
                    >
                      {busyRecordingId === recording.id ? (
                        <LoaderCircle className="spin" size={16} />
                      ) : (
                        <Trash2 size={16} />
                      )}
                      {locale === "ru" ? "Удалить" : "Delete"}
                    </Button>
                  ) : null}
                </div>
              </motion.article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  tone?: string;
}) {
  return (
    <motion.article
      className={`metric-card ${tone ? `metric-card--${tone}` : ""}`}
      whileHover={{ y: -3 }}
    >
      <span>{icon}</span>
      <div>
        <strong>{value}</strong>
        <small>{label}</small>
      </div>
    </motion.article>
  );
}

function WebinarCard({
  webinar,
  locale,
  index,
}: {
  webinar: Webinar;
  locale: string;
  index: number;
}) {
  const { workspace } = useDashboard();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [busy, setBusy] = useState<"start" | "studio" | "end" | "delete" | "recording" | null>(
    null,
  );
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"MODERATOR" | "SPEAKER" | "COHOST">("MODERATOR");
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState("");
  const [error, setError] = useState("");
  const tone =
    webinar.status === "LIVE"
      ? "danger"
      : webinar.status === "SCHEDULED"
        ? "primary"
        : webinar.status === "ENDED"
          ? "success"
          : "neutral";
  const currentRole = webinar.currentUserRole ?? null;
  const canManageLive = canTransitionWebinar(currentRole);
  const canManageRoles = canModerateWebinar(currentRole);
  const canStart = webinar.status === "SCHEDULED" && canManageLive;
  const canJoinStudio = webinar.status === "LIVE" && canJoinStudioRole(currentRole);
  const canEnd = webinar.status === "LIVE" && canManageLive;
  const canDeletePast =
    (webinar.status === "ENDED" || webinar.status === "ARCHIVED") && canManageLive;
  const recordings = useQuery({
    queryKey: ["recordings", workspace.id, webinar.id],
    queryFn: () => api.listRecordings(workspace.id, webinar.id),
    enabled: webinar.recordingEnabled && (webinar.status === "ENDED" || webinar.status === "ARCHIVED"),
  });
  const recording = recordings.data?.recordings[0] ?? null;

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
    const confirmed = window.confirm(
      locale === "ru"
        ? "Завершить вебинар для всех участников?"
        : "End this webinar for all participants?",
    );
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

  async function deletePastWebinar() {
    const confirmed = window.confirm(
      locale === "ru"
        ? "Удалить вебинар из списка? Аналитика и регистрации сохранятся."
        : "Delete this webinar from the list? Analytics and registrations will be preserved.",
    );
    if (!confirmed) return;
    setBusy("delete");
    setError("");
    try {
      await api.deleteWebinar(workspace.id, webinar.id);
      await refreshWebinars();
    } catch (reason) {
      setError(friendlyError(reason, locale));
    } finally {
      setBusy(null);
    }
  }

  async function deleteRecording() {
    if (!recording) return;
    const confirmed = window.confirm(
      locale === "ru" ? "Удалить запись вебинара?" : "Delete this webinar recording?",
    );
    if (!confirmed) return;
    setBusy("recording");
    setError("");
    try {
      await api.deleteRecording(workspace.id, webinar.id, recording.id);
      await queryClient.invalidateQueries({ queryKey: ["recordings", workspace.id, webinar.id] });
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
      sessionStorage.setItem(
        `laminaria-room:${webinar.slug}`,
        JSON.stringify({ ...payload, preferences: { cameraOn: true, micOn: true } }),
      );
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
    setInviteSuccess("");
    try {
      await api.assignWebinarHost(workspace.id, webinar.id, { email, role: inviteRole });
      setInviteEmail("");
      setInviteSuccess(
        locale === "ru"
          ? `Роль назначена. Пользователь увидит вебинар в своём кабинете.`
          : "Role assigned. The user will see this webinar in their dashboard.",
      );
    } catch (reason) {
      setError(friendlyError(reason, locale));
    } finally {
      setInviteBusy(false);
    }
  }

  return (
    <motion.article
      className="webinar-card"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
    >
      <div className="webinar-card__date">
        <strong>
          {webinar.scheduledStartAt
            ? new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "en-US", {
                day: "2-digit",
              }).format(new Date(webinar.scheduledStartAt))
            : "—"}
        </strong>
        <span>
          {webinar.scheduledStartAt
            ? new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "en-US", {
                month: "short",
              }).format(new Date(webinar.scheduledStartAt))
            : locale === "ru"
              ? "Дата"
              : "Date"}
        </span>
      </div>
      <div className="webinar-card__main">
        <div>
          <Badge tone={tone as "neutral" | "primary" | "success" | "danger"}>
            {webinar.status}
          </Badge>
          <h3>{webinar.title}</h3>
          <p>
            {webinar.description ||
              (locale === "ru" ? "Описание ещё не добавлено" : "No description yet")}
          </p>
          {error ? <div className="webinar-card__error">{error}</div> : null}
        </div>
        <div className="webinar-card__meta">
          <span>
            <Clock3 size={15} />
            {webinar.scheduledStartAt
              ? formatLocalDate(webinar.scheduledStartAt, locale)
              : locale === "ru"
                ? "Время не назначено"
                : "Not scheduled"}
          </span>
          <span>
            <UsersRound size={15} />
            {webinar.visibility === "PUBLIC"
              ? locale === "ru"
                ? "Открытая регистрация"
                : "Public registration"
              : locale === "ru"
                ? "По приглашению"
                : "Invite only"}
          </span>
          <span>
            <Clapperboard size={15} />
            {webinar.recordingEnabled
              ? locale === "ru"
                ? "Запись включена"
                : "Recording enabled"
              : locale === "ru"
                ? "Без записи"
                : "No recording"}
          </span>
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
          <Button
            size="sm"
            variant="secondary"
            onClick={() => void endLive()}
            disabled={busy !== null}
          >
            {busy === "end" ? <LoaderCircle className="spin" size={16} /> : <Square size={16} />}
            {locale === "ru" ? "Завершить" : "End"}
          </Button>
        ) : null}
        {webinar.status === "SCHEDULED" || webinar.status === "LIVE" ? (
          <Link
            className="webinar-card__open"
            href={`/w/${webinar.slug}`}
            aria-label={locale === "ru" ? "Открыть страницу вебинара" : "Open webinar page"}
          >
            <ArrowUpRight size={18} />
          </Link>
        ) : null}
        {webinar.recordingEnabled && (webinar.status === "ENDED" || webinar.status === "ARCHIVED") ? (
          recording?.playbackUrl ? (
            <a className="webinar-card__download" href={recording.playbackUrl} download>
              <Download size={16} />
              {locale === "ru" ? "Скачать" : "Download"}
            </a>
          ) : (
            <Button size="sm" variant="secondary" disabled>
              <Clapperboard size={16} />
              {recordings.isLoading
                ? locale === "ru"
                  ? "Проверка"
                  : "Checking"
                : recording?.status === "FAILED"
                  ? locale === "ru"
                    ? "Нет файла"
                    : "No file"
                  : locale === "ru"
                    ? "Готовится"
                    : "Processing"}
            </Button>
          )
        ) : null}
        {recording ? (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => void deleteRecording()}
            disabled={busy !== null}
          >
            {busy === "recording" ? <LoaderCircle className="spin" size={16} /> : <Trash2 size={16} />}
            {locale === "ru" ? "Запись" : "Recording"}
          </Button>
        ) : null}
        {canDeletePast ? (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => void deletePastWebinar()}
            disabled={busy !== null}
          >
            {busy === "delete" ? <LoaderCircle className="spin" size={16} /> : <Trash2 size={16} />}
            {locale === "ru" ? "Удалить" : "Delete"}
          </Button>
        ) : null}
      </div>
      {canManageRoles ? (
        <div className="webinar-role-form">
          <input
            value={inviteEmail}
            onChange={(event) => setInviteEmail(event.target.value)}
            placeholder={roleEmailPlaceholder(inviteRole, locale)}
            type="email"
          />
          <StyledSelect className="styled-select--up" value={inviteRole} ariaLabel={locale === "ru" ? "Роль" : "Role"} options={[{ value: "MODERATOR", label: locale === "ru" ? "Модератор" : "Moderator" }, { value: "SPEAKER", label: locale === "ru" ? "Спикер" : "Speaker" }, { value: "COHOST", label: locale === "ru" ? "Соведущий" : "Co-host" }]} onChange={setInviteRole} />
          <button
            type="button"
            onClick={() => void assignHostRole()}
            disabled={inviteBusy || !inviteEmail.trim()}
          >
            {inviteBusy ? <LoaderCircle className="spin" size={15} /> : <UserPlus size={15} />}
            {locale === "ru" ? "Назначить" : "Assign"}
          </button>
          {inviteSuccess ? (
            <small className="webinar-role-form__status">{inviteSuccess}</small>
          ) : null}
        </div>
      ) : null}
    </motion.article>
  );
}

function canJoinStudioRole(role: WebinarRole | null): boolean {
  return (
    role === "OWNER" ||
    role === "HOST" ||
    role === "COHOST" ||
    role === "MODERATOR" ||
    role === "SPEAKER"
  );
}

function roleEmailPlaceholder(
  role: "MODERATOR" | "SPEAKER" | "COHOST",
  locale: string,
): string {
  if (locale === "ru") {
    if (role === "SPEAKER") return "email спикера";
    if (role === "COHOST") return "email соведущего";
    return "email модератора";
  }

  if (role === "SPEAKER") return "speaker email";
  if (role === "COHOST") return "co-host email";
  return "moderator email";
}

function canModerateWebinar(role: WebinarRole | null): boolean {
  return role === "OWNER" || role === "HOST" || role === "COHOST";
}

function canTransitionWebinar(role: WebinarRole | null): boolean {
  return role === "OWNER" || role === "HOST" || role === "COHOST";
}

function EmptyWebinars({
  locale,
  t,
  canCreate,
}: {
  locale: string;
  t: ReturnType<typeof useTranslations>;
  canCreate: boolean;
}) {
  return (
    <div className="empty-webinars">
      <div className="empty-illustration" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <h3>{t("dashboard.noUpcoming")}</h3>
      <p>{t("dashboard.noUpcomingBody")}</p>
      {canCreate ? (
        <Link href="/dashboard/webinars/new">
          <Button>
            <CalendarPlus size={17} />
            {t("nav.newWebinar")}
          </Button>
        </Link>
      ) : null}
      <small>
        {locale === "ru"
          ? "Здесь не используются демонстрационные вебинары: появятся только ваши реальные данные."
          : "No demo webinars are inserted here: only your real data will appear."}
      </small>
    </div>
  );
}

function DashboardOverviewSkeleton() {
  return (
    <div className="dashboard-page">
      <Skeleton style={{ height: 52, width: "45%" }} />
      <div className="metrics-grid">
        <Skeleton style={{ height: 120 }} />
        <Skeleton style={{ height: 120 }} />
        <Skeleton style={{ height: 120 }} />
      </div>
      <Skeleton style={{ height: 300 }} />
    </div>
  );
}
