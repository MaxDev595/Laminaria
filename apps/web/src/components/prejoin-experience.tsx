"use client";

import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  LoaderCircle,
  Radio,
  ShieldCheck,
  Tv,
} from "lucide-react";
import { motion } from "motion/react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useState, useSyncExternalStore } from "react";

import { Link, useRouter } from "@/i18n/navigation";
import { api, friendlyError } from "@/lib/api";
import { Badge, Button, Logo, Skeleton } from "@laminaria/ui";
import { LanguageSwitcher } from "./language-switcher";
import { Field, Input, ServiceState } from "./ui";

export function PrejoinExperience({ slug }: { slug: string }) {
  const locale = useLocale();
  const t = useTranslations();
  const router = useRouter();
  const query = useQuery({
    queryKey: ["public-webinar", slug],
    queryFn: ({ signal }) => api.publicWebinar(slug, signal),
  });
  const [name, setName] = useState("");
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState("");

  const subscribeStorage = useCallback(() => () => undefined, []);
  const accessToken = useSyncExternalStore(
    subscribeStorage,
    () => sessionStorage.getItem(`laminaria-access:${slug}`),
    () => null,
  );

  async function join() {
    setJoining(true);
    setError("");
    try {
      const webinar = query.data?.webinar;
      if (!webinar) return;
      const input = accessToken ? { accessToken } : { guestName: name.trim() };
      const payload = await api.prejoin(slug, input);
      sessionStorage.setItem(
        `laminaria-room:${slug}`,
        JSON.stringify({
          ...payload,
          preferences: {
            cameraOn: false,
            micOn: false,
          },
        }),
      );
      router.push(`/room/${slug}`);
    } catch (reason) {
      setError(friendlyError(reason, locale));
    } finally {
      setJoining(false);
    }
  }

  if (query.isLoading) {
    return (
      <main className="prejoin-shell">
        <Skeleton style={{ height: 500 }} />
      </main>
    );
  }

  if (query.isError) {
    return (
      <main className="dashboard-gate">
        <Logo />
        <ServiceState
          icon={<AlertTriangle size={20} />}
          title={locale === "ru" ? "Вход недоступен" : "Entry is unavailable"}
          description={friendlyError(query.error, locale)}
        />
      </main>
    );
  }

  const webinar = query.data!.webinar;
  const live = webinar.status === "LIVE";
  const canEnter =
    live && (Boolean(accessToken) || (webinar.allowGuests && name.trim().length > 0));

  return (
    <main className="prejoin-shell">
      <header className="prejoin-header">
        <Link href={`/w/${slug}`} className="auth-back">
          <ArrowLeft size={16} />
          {t("common.back")}
        </Link>
        <Logo />
        <LanguageSwitcher />
      </header>

      <div className="prejoin-grid">
        <motion.section
          className="preview-card"
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <div className="preview-frame">
            <div className="preview-empty">
              <span>
                <Tv size={30} />
              </span>
              <p>
                {locale === "ru"
                  ? "Вы входите как зритель. Камера и микрофон не используются."
                  : "You are joining as a viewer. Camera and microphone stay off."}
              </p>
            </div>
            <div className="preview-name">
              {name.trim() || (locale === "ru" ? "Зритель" : "Viewer")}
            </div>
          </div>
        </motion.section>

        <motion.aside
          className="prejoin-panel"
          initial={{ opacity: 0, x: 18 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <Badge tone={live ? "danger" : "primary"}>
            {live ? t("dashboard.liveNow") : t("dashboard.scheduled")}
          </Badge>
          <h1>{locale === "ru" ? "Вход зрителя" : "Viewer entry"}</h1>
          <p>
            {locale === "ru"
              ? "Зритель может смотреть эфир. Писать в чат можно только когда организатор или модератор откроет чат."
              : "Viewers can watch the broadcast. Chat is available only when a host or moderator opens it."}
          </p>

          <div className="prejoin-event">
            <strong>{webinar.title}</strong>
            <span>
              <Radio size={15} />
              {live
                ? locale === "ru"
                  ? "Комната открыта"
                  : "Room is open"
                : locale === "ru"
                  ? "Комната ещё не открыта"
                  : "Room is not open yet"}
            </span>
          </div>

          {!accessToken ? (
            <Field
              label={t("room.displayName")}
              hint={
                webinar.allowGuests
                  ? locale === "ru"
                    ? "Имя будет видно в списке участников"
                    : "This name appears in the participant list"
                  : locale === "ru"
                    ? "Для входа нужна подтверждённая регистрация"
                    : "A confirmed registration is required"
              }
            >
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                disabled={!webinar.allowGuests}
              />
            </Field>
          ) : (
            <div className="access-ready">
              <Check size={17} />
              {locale === "ru" ? "Регистрация найдена" : "Registration found"}
            </div>
          )}

          <div className="recording-notice">
            <ShieldCheck size={18} />
            <span>
              {locale === "ru"
                ? "Ваш браузер не будет запрашивать доступ к камере или микрофону для роли зрителя."
                : "Your browser will not request camera or microphone access for the viewer role."}
            </span>
          </div>

          {error ? (
            <div className="form-alert">
              <AlertTriangle size={17} />
              {error}
            </div>
          ) : null}

          <Button size="lg" onClick={() => void join()} disabled={!canEnter || joining}>
            {joining ? <LoaderCircle className="spin" size={18} /> : <ArrowRight size={18} />}
            {locale === "ru" ? "Войти смотреть" : "Join to watch"}
          </Button>

          {live && !accessToken && !webinar.allowGuests ? (
            <Link href={`/w/${slug}`} className="guest-entry">
              {locale === "ru" ? "Вернуться к регистрации" : "Return to registration"}
            </Link>
          ) : null}
        </motion.aside>
      </div>
    </main>
  );
}
