"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Archive,
  BarChart3,
  CheckCircle2,
  CircleDollarSign,
  DatabaseZap,
  HardDrive,
  Mail,
  Settings,
  Sparkles,
  UsersRound,
  Video,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { api, friendlyError, type ServiceStatus } from "@/lib/api";
import type { DashboardSectionName } from "@/lib/dashboard-sections";
import { Badge, Button } from "@laminaria/ui";
import { useDashboard } from "./dashboard-context";
import { DashboardOverview, PageHeading } from "./dashboard-overview";
import { ServiceState } from "./ui";

export function DashboardSection({ section }: { section: DashboardSectionName }) {
  const t = useTranslations();
  const { workspace } = useDashboard();

  if (section === "upcoming" || section === "past" || section === "drafts") return <DashboardOverview filter={section} />;
  if (section === "billing") return <BillingSection />;

  const copy = {
    recordings: {
      title: t("nav.recordings"),
      body: t("dashboard.recordingsBody"),
      icon: <Video size={24} />,
      service: t("dashboard.recordingsState"),
    },
    analytics: {
      title: t("nav.analytics"),
      body: t("dashboard.analyticsBody"),
      icon: <BarChart3 size={24} />,
      service: t("dashboard.analyticsState"),
    },
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
        <ServiceState icon={<DatabaseZap size={20} />} title={copy.service} description={t("dashboard.honestState")} />
      </div>
      {section === "settings" ? <ServiceStatusGrid /> : null}
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
        action={<Button variant="secondary" onClick={() => void query.refetch()}>{t("common.retry")}</Button>}
      />
    );
  }

  const services = query.data?.services ?? defaultServices;
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
  const Icon = serviceIcon[service.key] ?? DatabaseZap;
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

function BillingSection() {
  const t = useTranslations();
  const { workspace } = useDashboard();
  const plans = [
    {
      name: t("plans.free"),
      icon: <Archive />,
      features: [t("plans.freeFeature1"), t("plans.freeFeature2"), t("plans.freeFeature3")],
    },
    {
      name: t("plans.professional"),
      icon: <Video />,
      features: [t("plans.professionalFeature1"), t("plans.professionalFeature2"), t("plans.professionalFeature3")],
    },
    {
      name: t("plans.business"),
      icon: <UsersRound />,
      features: [t("plans.businessFeature1"), t("plans.businessFeature2"), t("plans.businessFeature3")],
    },
  ];

  return (
    <div className="dashboard-page">
      <PageHeading eyebrow={workspace.name} title={t("nav.billing")} body={t("plans.pricingPending")} />
      <div className="plan-grid">
        {plans.map((plan, index) => (
          <article className={`plan-card ${index === 1 ? "plan-card--featured" : ""}`} key={plan.name}>
            <span className="plan-card__icon">{plan.icon}</span>
            <h2>{plan.name}</h2>
            <div className="plan-price">
              <strong>—</strong>
              <span>{t("plans.pricePending")}</span>
            </div>
            <ul>{plan.features.map((feature) => <li key={feature}>{feature}</li>)}</ul>
            <Button variant={index === 1 ? "primary" : "secondary"} disabled aria-disabled="true">{t("plans.comingSoon")}</Button>
          </article>
        ))}
      </div>
      <p className="plan-note">
        <CircleDollarSign size={16} />
        {t("plans.note")}
      </p>
    </div>
  );
}

const serviceIcon = {
  livekit: Video,
  mail: Mail,
  google: UsersRound,
  ai: Sparkles,
  billing: CircleDollarSign,
  storage: HardDrive,
} satisfies Record<ServiceStatus["key"], typeof Video>;

const defaultServices: ServiceStatus[] = [
  { key: "livekit", label: "LiveKit", configured: false, requiredEnv: ["LIVEKIT_URL", "LIVEKIT_API_KEY", "LIVEKIT_API_SECRET"] },
  { key: "mail", label: "Email delivery", configured: false, requiredEnv: ["SMTP_HOST", "EMAIL_FROM"] },
  { key: "google", label: "Google OAuth", configured: false, requiredEnv: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"] },
  { key: "ai", label: "AI provider", configured: false, requiredEnv: ["AI_PROVIDER", "AI_API_KEY", "AI_MODEL"] },
  { key: "billing", label: "Billing", configured: false, requiredEnv: ["BILLING_PROVIDER", "BILLING_API_KEY", "BILLING_WEBHOOK_SECRET"] },
  { key: "storage", label: "S3 storage", configured: false, requiredEnv: ["STORAGE_ENDPOINT", "STORAGE_REGION", "STORAGE_BUCKET", "STORAGE_ACCESS_KEY_ID", "STORAGE_SECRET_ACCESS_KEY"] },
];
