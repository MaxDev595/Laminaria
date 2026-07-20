"use client";

import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  CheckCircle2,
  DatabaseZap,
  Mail,
  Settings,
  UsersRound,
  Video,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { api, friendlyError, type Registration, type ServiceStatus, type Webinar } from "@/lib/api";
import type { DashboardSectionName } from "@/lib/dashboard-sections";
import { Badge, Button } from "@laminaria/ui";
import { useDashboard } from "./dashboard-context";
import { DashboardOverview, DashboardRecordings, PageHeading } from "./dashboard-overview";
import { ServiceState } from "./ui";

export function DashboardSection({ section }: { section: DashboardSectionName }) {
  const t = useTranslations();
  const { workspace } = useDashboard();

  if (section === "upcoming" || section === "past" || section === "drafts")
    return <DashboardOverview filter={section} />;
  if (section === "recordings") return <DashboardRecordings />;
  if (section === "analytics") return <AnalyticsSection />;

  const copy = {
    team: {
      title: t("nav.team"),
      body: t("dashboard.teamBody"),
      icon: <UsersRound size={24} />,
      service: t("dashboard.teamState"),
    },
    settings: {
      title: t("nav.settings"),
      body: t("dashboard.settingsBody"),
      icon: <Settings size={24} />,
      service: t("dashboard.settingsState"),
    },
  }[section];

  return (
    <div className="dashboard-page">
      <PageHeading eyebrow={workspace.name} title={copy.title} body={copy.body} />
      <div className="section-placeholder">
        <span className="section-placeholder__icon">{copy.icon}</span>
        <ServiceState
          icon={<DatabaseZap size={20} />}
          title={copy.service}
          description={t("dashboard.honestState")}
        />
      </div>
      {section === "settings" ? <ServiceStatusGrid /> : null}
    </div>
  );
}

function AnalyticsSection() {
  const t = useTranslations();
  const locale = useLocale();
  const { workspace } = useDashboard();
  const [selectedWebinar, setSelectedWebinar] = useState<Webinar | null>(null);
  const [selectedRegistration, setSelectedRegistration] = useState<Registration | null>(null);
  const webinarsQuery = useQuery({
    queryKey: ["webinars", workspace.id],
    queryFn: () => api.listWebinars(workspace.id),
  });
  const registrationsQuery = useQuery({
    queryKey: ["webinar-registrations", workspace.id, selectedWebinar?.id],
    queryFn: () => api.listWebinarRegistrations(workspace.id, selectedWebinar!.id),
    enabled: Boolean(selectedWebinar),
  });

  const webinars = webinarsQuery.data?.webinars ?? [];
  const registrations = registrationsQuery.data?.registrations ?? [];

  return (
    <div className="dashboard-page">
      <PageHeading
        eyebrow={workspace.name}
        title={t("nav.analytics")}
        body={
          locale === "ru"
            ? "Регистрации вебинаров: имя, email и телефон для рекламной аналитики."
            : "Webinar registrations: name, email, and phone for marketing analytics."
        }
      />
      <div className="analytics-workbench">
        <section>
          <h2>{locale === "ru" ? "Вебинары" : "Webinars"}</h2>
          {webinarsQuery.isError ? (
            <ServiceState
              icon={<DatabaseZap size={20} />}
              title="Analytics unavailable"
              description={friendlyError(webinarsQuery.error, locale)}
            />
          ) : null}
          <div className="analytics-list">
            {webinars.map((webinar) => (
              <button
                type="button"
                key={webinar.id}
                className={selectedWebinar?.id === webinar.id ? "is-active" : ""}
                onClick={() => {
                  setSelectedWebinar(webinar);
                  setSelectedRegistration(null);
                }}
              >
                <strong>{webinar.title}</strong>
                <small>
                  {webinar.status} ·{" "}
                  {webinar.scheduledStartAt
                    ? new Date(webinar.scheduledStartAt).toLocaleString(
                        locale === "ru" ? "ru-RU" : "en-US",
                      )
                    : "no date"}
                </small>
              </button>
            ))}
          </div>
        </section>
        <section>
          <h2>{locale === "ru" ? "Зрители" : "Registrations"}</h2>
          {!selectedWebinar ? (
            <ServiceState
              icon={<BarChart3 size={20} />}
              title={locale === "ru" ? "Выберите вебинар" : "Select a webinar"}
              description={
                locale === "ru"
                  ? "После выбора появится список регистраций."
                  : "Registrations will appear after selection."
              }
            />
          ) : registrationsQuery.isLoading ? (
            <ServiceState
              icon={<DatabaseZap size={20} />}
              title={locale === "ru" ? "Загружаем" : "Loading"}
              description={selectedWebinar.title}
            />
          ) : (
            <div className="analytics-list">
              {registrations.map((registration) => (
                <button
                  type="button"
                  key={registration.id}
                  onClick={() => setSelectedRegistration(registration)}
                >
                  <strong>{registration.name}</strong>
                  <small>
                    {registration.email} · {registration.phone || "—"}
                  </small>
                </button>
              ))}
              {registrations.length === 0 ? (
                <p className="analytics-empty">
                  {locale === "ru" ? "Регистраций пока нет." : "No registrations yet."}
                </p>
              ) : null}
            </div>
          )}
        </section>
      </div>
      {selectedRegistration ? (
        <div className="analytics-modal" role="dialog" aria-modal="true">
          <button type="button" aria-label="Close" onClick={() => setSelectedRegistration(null)} />
          <article>
            <h2>{selectedRegistration.name}</h2>
            <dl>
              <div>
                <dt>Email</dt>
                <dd>{selectedRegistration.email}</dd>
              </div>
              <div>
                <dt>{locale === "ru" ? "Телефон" : "Phone"}</dt>
                <dd>{selectedRegistration.phone || "—"}</dd>
              </div>
              <div>
                <dt>{locale === "ru" ? "Статус" : "Status"}</dt>
                <dd>{selectedRegistration.status}</dd>
              </div>
            </dl>
            <Button variant="secondary" onClick={() => setSelectedRegistration(null)}>
              OK
            </Button>
          </article>
        </div>
      ) : null}
    </div>
  );
}

function ServiceStatusGrid() {
  const locale = useLocale();
  const t = useTranslations();
  const query = useQuery({
    queryKey: ["service-status"],
    queryFn: ({ signal }) => api.serviceStatus(signal),
  });

  if (query.isError) {
    return (
      <ServiceState
        icon={<DatabaseZap size={20} />}
        title={t("dashboard.servicesLoadError")}
        description={friendlyError(query.error, locale)}
        action={
          <Button variant="secondary" onClick={() => void query.refetch()}>
            {t("common.retry")}
          </Button>
        }
      />
    );
  }

  const services = (query.data?.services ?? defaultServices).filter((service) =>
    ["livekit", "mail", "google"].includes(service.key),
  );
  return (
    <div className="settings-service-grid">
      {services.map((service) => (
        <ServiceCard key={service.key} service={service} loading={query.isLoading} />
      ))}
    </div>
  );
}

function ServiceCard({ service, loading }: { service: ServiceStatus; loading: boolean }) {
  const t = useTranslations();
  const Icon =
    service.key in serviceIcon ? serviceIcon[service.key as keyof typeof serviceIcon] : DatabaseZap;
  const configured = !loading && service.configured;

  return (
    <article className="service-card">
      <span>{configured ? <CheckCircle2 /> : <Icon />}</span>
      <div>
        <strong>{service.label}</strong>
        <small>
          {loading
            ? t("dashboard.serviceChecking")
            : configured
              ? t("dashboard.serviceReady")
              : `${t("dashboard.serviceAdd")}: ${service.requiredEnv.join(", ")}`}
        </small>
      </div>
      <Badge tone={configured ? "success" : "warning"}>
        {configured ? t("dashboard.serviceConfigured") : t("dashboard.serviceSetupRequired")}
      </Badge>
    </article>
  );
}

const serviceIcon = {
  livekit: Video,
  mail: Mail,
  google: UsersRound,
} satisfies Partial<Record<ServiceStatus["key"], typeof Video>>;

const defaultServices: ServiceStatus[] = [
  {
    key: "livekit",
    label: "LiveKit",
    configured: false,
    requiredEnv: ["LIVEKIT_URL", "LIVEKIT_API_KEY", "LIVEKIT_API_SECRET"],
  },
  {
    key: "mail",
    label: "Email delivery",
    configured: false,
    requiredEnv: ["SMTP_HOST", "EMAIL_FROM"],
  },
  {
    key: "google",
    label: "Google OAuth",
    configured: false,
    requiredEnv: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
  },
];
