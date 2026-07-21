"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowRight, CalendarPlus, CheckCircle2, Clock3, Radio } from "lucide-react";
import { motion } from "motion/react";
import { useLocale } from "next-intl";
import { type CSSProperties, useEffect, useMemo, useState } from "react";

import { Link } from "@/i18n/navigation";
import { api, friendlyError } from "@/lib/api";
import { formatLocalDate, localTimezone } from "@/lib/text";
import { Badge, Button, Logo, Skeleton } from "@laminaria/ui";
import { LanguageSwitcher } from "./language-switcher";
import { ThemeToggle } from "./theme-toggle";
import { ServiceState } from "./ui";

type TimeLeft = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalMs: number;
};

export function WebinarWaitingRoom({ slug }: { slug: string }) {
  const locale = useLocale() as "en" | "ru";
  const [now, setNow] = useState(() => Date.now());
  const [accessToken] = useState<string | null>(() =>
    typeof window === "undefined"
      ? null
      : window.sessionStorage.getItem(`laminaria-access:${slug}`),
  );
  const query = useQuery({
    queryKey: ["public-webinar", slug],
    queryFn: ({ signal }) => api.publicWebinar(slug, signal),
  });

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const webinar = query.data?.webinar;
  const targetTime = webinar?.scheduledStartAt
    ? new Date(webinar.scheduledStartAt).getTime()
    : null;
  const timeLeft = useMemo(() => calculateTimeLeft(targetTime, now), [targetTime, now]);
  const isLiveOrReady =
    webinar?.status === "LIVE" || (timeLeft?.totalMs ?? Number.POSITIVE_INFINITY) <= 0;

  if (query.isLoading) return <WaitingSkeleton />;
  if (query.isError || !webinar) {
    return (
      <main className="dashboard-gate">
        <Logo />
        <ServiceState
          icon={<AlertTriangle size={20} />}
          title={locale === "ru" ? "Страница ожидания недоступна" : "Waiting room unavailable"}
          description={friendlyError(query.error, locale)}
          action={
            <Button variant="secondary" onClick={() => void query.refetch()}>
              {locale === "ru" ? "Повторить" : "Try again"}
            </Button>
          }
        />
      </main>
    );
  }

  return (
    <main
      className="waiting-room"
      style={{
        "--color-primary": webinar.branding.accentColor,
        "--waiting-cover": webinar.branding.coverImageUrl
          ? `url(${webinar.branding.coverImageUrl})`
          : "none",
      } as CSSProperties}
    >
      <header className="public-event-nav">
        <Link href="/">
          {webinar.branding.logoUrl ? (
            <span className="public-event-brand">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={webinar.branding.logoUrl} alt="" />
              <strong>{webinar.branding.companyName}</strong>
            </span>
          ) : <Logo />}
        </Link>
        <div>
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
      </header>
      <motion.section
        className="waiting-card"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="waiting-orb" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <Badge tone={isLiveOrReady ? "danger" : "primary"}>
          {isLiveOrReady
            ? locale === "ru"
              ? "Можно входить"
              : "Ready to join"
            : locale === "ru"
              ? "Ожидание вебинара"
              : "Webinar waiting room"}
        </Badge>
        <h1>{webinar.title}</h1>
        <p>
          {webinar.description ||
            (locale === "ru"
              ? "Регистрация подтверждена. Эта страница обновляет время до старта."
              : "Registration confirmed. This page keeps the countdown fresh.")}
        </p>

        <div className="waiting-meta">
          <span>
            <CalendarPlus size={17} />
            {webinar.scheduledStartAt
              ? formatLocalDate(webinar.scheduledStartAt, locale)
              : locale === "ru"
                ? "Время уточняется"
                : "Time to be confirmed"}
          </span>
          <span>
            <Clock3 size={17} />
            {localTimezone()}
          </span>
          <span>
            <CheckCircle2 size={17} />
            {accessToken
              ? locale === "ru"
                ? "Пропуск сохранён"
                : "Access pass saved"
              : locale === "ru"
                ? "Нужна регистрация"
                : "Registration required"}
          </span>
        </div>

        {timeLeft && !isLiveOrReady ? (
          <>
            <h2>{locale === "ru" ? "Вебинар начнется через" : "The webinar starts in"}</h2>
            <div className="countdown-grid" aria-live="polite">
              <CountdownPart value={timeLeft.days} label={locale === "ru" ? "дней" : "days"} />
              <CountdownPart value={timeLeft.hours} label={locale === "ru" ? "часов" : "hours"} />
              <CountdownPart
                value={timeLeft.minutes}
                label={locale === "ru" ? "минут" : "minutes"}
              />
              <CountdownPart
                value={timeLeft.seconds}
                label={locale === "ru" ? "секунд" : "seconds"}
              />
            </div>
          </>
        ) : (
          <div className="waiting-live-note">
            <Radio size={20} />
            <strong>
              {locale === "ru"
                ? "Вебинар уже должен начаться"
                : "The webinar should be starting now"}
            </strong>
            <span>
              {locale === "ru"
                ? "Вход для зрителя: камера и микрофон не нужны."
                : "Viewer entry: camera and microphone are not needed."}
            </span>
          </div>
        )}

        <div className="waiting-actions">
          {accessToken ? (
            <Link href={`/w/${slug}/prejoin`}>
              <Button size="lg">
                {isLiveOrReady
                  ? locale === "ru"
                    ? "Войти в вебинар"
                    : "Join webinar"
                  : locale === "ru"
                    ? "Перейти ко входу"
                    : "Continue to entry"}
                <ArrowRight size={18} />
              </Button>
            </Link>
          ) : (
            <Link href={`/w/${slug}`}>
              <Button size="lg">
                {locale === "ru" ? "Зарегистрироваться" : "Register"}
                <ArrowRight size={18} />
              </Button>
            </Link>
          )}
        </div>
      </motion.section>
    </main>
  );
}

function CountdownPart({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <strong>{String(value).padStart(2, "0")}</strong>
      <span>{label}</span>
    </div>
  );
}

function calculateTimeLeft(targetTime: number | null, now: number): TimeLeft | null {
  if (!targetTime || !Number.isFinite(targetTime)) return null;
  const totalMs = Math.max(0, targetTime - now);
  const totalSeconds = Math.floor(totalMs / 1000);
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  return { days, hours, minutes, seconds, totalMs };
}

function WaitingSkeleton() {
  return (
    <main className="waiting-room">
      <section className="waiting-card">
        <Skeleton style={{ height: 26, width: 140 }} />
        <Skeleton style={{ height: 62, marginTop: 24 }} />
        <Skeleton style={{ height: 120, marginTop: 28 }} />
      </section>
    </main>
  );
}
