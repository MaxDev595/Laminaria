"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  CalendarPlus,
  CheckCircle2,
  Clock3,
  Globe2,
  LoaderCircle,
  LockKeyhole,
  Radio,
  UsersRound,
} from "lucide-react";
import { motion } from "motion/react";
import { useLocale, useTranslations } from "next-intl";
import { type CSSProperties, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Link, useRouter } from "@/i18n/navigation";
import { api, friendlyError } from "@/lib/api";
import { formatLocalDate, localTimezone } from "@/lib/text";
import { Badge, Button, Logo, Skeleton } from "@laminaria/ui";
import { LanguageSwitcher } from "./language-switcher";
import { ThemeToggle } from "./theme-toggle";
import { Field, Input, ServiceState } from "./ui";

const schema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.email(),
  phone: z.string().trim().min(5).max(40),
});
type Values = z.infer<typeof schema>;

export function PublicWebinar({ slug }: { slug: string }) {
  const locale = useLocale() as "en" | "ru";
  const t = useTranslations();
  const router = useRouter();
  const query = useQuery({
    queryKey: ["public-webinar", slug],
    queryFn: ({ signal }) => api.publicWebinar(slug, signal),
  });
  const [success, setSuccess] = useState<{
    confirmationRequired: boolean;
    hasAccess: boolean;
  } | null>(null);
  const [error, setError] = useState("");
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", email: "", phone: "" },
  });

  async function submit(values: Values) {
    setError("");
    try {
      const result = await api.register(slug, { ...values, locale });
      if (result.accessToken) {
        sessionStorage.setItem(`laminaria-access:${slug}`, result.accessToken);
        router.replace(`/w/${slug}/waiting`);
        return;
      }
      setSuccess({
        confirmationRequired: result.confirmationRequired,
        hasAccess: Boolean(result.accessToken),
      });
    } catch (reason) {
      setError(friendlyError(reason, locale));
    }
  }

  if (query.isLoading) return <PublicWebinarSkeleton />;
  if (query.isError) {
    return (
      <PublicError
        locale={locale}
        message={friendlyError(query.error, locale)}
        retry={() => void query.refetch()}
      />
    );
  }

  const webinar = query.data!.webinar;
  const coverImageUrl = webinar.coverImageUrl ?? webinar.branding.coverImageUrl;
  const registrationClosed = !["SCHEDULED", "LIVE"].includes(webinar.status);

  function addCalendar() {
    if (!webinar.scheduledStartAt) return;
    const stamp = new Date(webinar.scheduledStartAt)
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}/, "");
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Laminaria//Webinar//EN",
      "BEGIN:VEVENT",
      `UID:${webinar.slug}@laminaria`,
      `DTSTAMP:${new Date()
        .toISOString()
        .replace(/[-:]/g, "")
        .replace(/\.\d{3}/, "")}`,
      `DTSTART:${stamp}`,
      `SUMMARY:${escapeIcs(webinar.title)}`,
      `DESCRIPTION:${escapeIcs(webinar.description)}`,
      `URL:${location.href}`,
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");
    const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${webinar.slug}.ics`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div
      className="public-event-shell"
      style={{ "--event-accent": webinar.branding.accentColor } as CSSProperties}
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

      <main className="public-event">
        <motion.section
          className="event-story"
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <div className="event-story__glow" aria-hidden="true" />
          <div className="event-status">
            <Badge tone={webinar.status === "LIVE" ? "danger" : "primary"}>
              {webinar.status === "LIVE" ? t("dashboard.liveNow") : t("dashboard.scheduled")}
            </Badge>
            <span>
              {webinar.visibility === "PUBLIC" ? t("webinar.public") : t("webinar.private")}
            </span>
          </div>
          {coverImageUrl ? (
            <div
              className="event-banner"
              style={{ backgroundImage: `url(${coverImageUrl})` }}
            >
              <span>{webinar.status === "LIVE" ? "LIVE" : "WEBINAR"}</span>
            </div>
          ) : null}
          <h1>{webinar.title}</h1>
          <p className="event-description">{webinar.description}</p>
          <dl className="event-details">
            <div>
              <dt>
                <Clock3 size={17} />
                {t("webinar.date")}
              </dt>
              <dd>
                {webinar.scheduledStartAt
                  ? formatLocalDate(webinar.scheduledStartAt, locale)
                  : locale === "ru"
                    ? "Организатор уточняет время"
                    : "Time to be confirmed"}
              </dd>
              <small>{localTimezone()}</small>
            </div>
            <div>
              <dt>
                <Globe2 size={17} />
                {t("webinar.language")}
              </dt>
              <dd>{webinar.language === "ru" ? "Русский" : "English"}</dd>
            </div>
            <div>
              <dt>
                <UsersRound size={17} />
                {t("webinar.access")}
              </dt>
              <dd>
                {webinar.allowGuests
                  ? t("webinar.guestAccess")
                  : locale === "ru"
                    ? "По подтверждённой регистрации"
                    : "Confirmed registration required"}
              </dd>
            </div>
          </dl>
          <Button variant="secondary" onClick={addCalendar} disabled={!webinar.scheduledStartAt}>
            <CalendarPlus size={17} />
            {t("webinar.addCalendar")}
          </Button>
        </motion.section>

        <motion.aside
          className="registration-card"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
        >
          {success ? (
            <div className="registration-success">
              <span>
                <CheckCircle2 size={28} />
              </span>
              <h2>{t("webinar.registrationSuccess")}</h2>
              <p>
                {success.confirmationRequired
                  ? locale === "ru"
                    ? "Подтвердите адрес по ссылке из письма. После этого откроется защищённый вход."
                    : "Confirm your address from the email. The secure join flow will open next."
                  : locale === "ru"
                    ? "Защищённый пропуск сохранён только в этой вкладке."
                    : "Your secure access pass is stored only in this tab."}
              </p>
              {success.hasAccess ? (
                <Link href={`/w/${slug}/prejoin`}>
                  <Button size="lg">
                    {locale === "ru" ? "Перейти ко входу" : "Continue to entry"}
                    <ArrowRight size={18} />
                  </Button>
                </Link>
              ) : null}
            </div>
          ) : (
            <>
              <span className="section-kicker">
                <Radio size={16} />
                {t("webinar.registrationTitle")}
              </span>
              <h2>
                {registrationClosed
                  ? locale === "ru"
                    ? "Регистрация закрыта"
                    : "Registration is closed"
                  : t("webinar.registrationTitle")}
              </h2>
              <p>
                {locale === "ru"
                  ? "Ссылка для входа привязывается к подтверждённой регистрации и не публикуется открыто."
                  : "Your join link is tied to a confirmed registration and is never exposed publicly."}
              </p>
              <form onSubmit={form.handleSubmit(submit)}>
                <Field label={t("auth.name")} error={form.formState.errors.name?.message}>
                  <Input
                    autoComplete="name"
                    disabled={registrationClosed}
                    {...form.register("name")}
                  />
                </Field>
                <Field label={t("auth.email")} error={form.formState.errors.email?.message}>
                  <Input
                    type="email"
                    autoComplete="email"
                    disabled={registrationClosed}
                    {...form.register("email")}
                  />
                </Field>
                <Field
                  label={locale === "ru" ? "Телефон" : "Phone"}
                  error={form.formState.errors.phone?.message}
                >
                  <Input
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="+1 555 000 0000"
                    disabled={registrationClosed}
                    {...form.register("phone")}
                  />
                </Field>
                {error ? (
                  <div className="form-alert">
                    <AlertTriangle size={17} />
                    {error}
                  </div>
                ) : null}
                <Button
                  type="submit"
                  size="lg"
                  disabled={registrationClosed || form.formState.isSubmitting}
                >
                  {form.formState.isSubmitting ? (
                    <LoaderCircle className="spin" size={18} />
                  ) : (
                    <LockKeyhole size={17} />
                  )}
                  {t("webinar.registrationTitle")}
                  <ArrowRight size={18} />
                </Button>
              </form>
              {webinar.allowGuests && webinar.status === "LIVE" ? (
                <Link href={`/w/${slug}/prejoin`} className="guest-entry">
                  {locale === "ru" ? "Войти как гость" : "Continue as guest"}
                  <ArrowRight size={16} />
                </Link>
              ) : null}
            </>
          )}
        </motion.aside>
      </main>

      <footer className="public-event-footer">
        <Logo compact />
        <span>
          {locale === "ru"
            ? "Защищённая регистрация Laminaria"
            : "Secure registration by Laminaria"}
        </span>
      </footer>
    </div>
  );
}

function escapeIcs(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function PublicWebinarSkeleton() {
  return (
    <main className="public-event">
      <section>
        <Skeleton style={{ height: 32, width: 160 }} />
        <Skeleton style={{ height: 150, marginTop: 30 }} />
        <Skeleton style={{ height: 180, marginTop: 30 }} />
      </section>
      <Skeleton style={{ minHeight: 520 }} />
    </main>
  );
}

function PublicError({
  locale,
  message,
  retry,
}: {
  locale: string;
  message: string;
  retry: () => void;
}) {
  return (
    <main className="dashboard-gate">
      <Logo />
      <ServiceState
        icon={<AlertTriangle size={20} />}
        title={locale === "ru" ? "Страница недоступна" : "This page is unavailable"}
        description={message}
        action={
          <Button variant="secondary" onClick={retry}>
            {locale === "ru" ? "Повторить" : "Try again"}
          </Button>
        }
      />
    </main>
  );
}
