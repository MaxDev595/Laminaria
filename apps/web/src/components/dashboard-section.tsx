"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BarChart3,
  DatabaseZap,
  LoaderCircle,
  Trash2,
  UserPlus,
  UsersRound,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { api, friendlyError, type Registration, type Webinar } from "@/lib/api";
import type { DashboardSectionName } from "@/lib/dashboard-sections";
import { Button } from "@laminaria/ui";
import { useDashboard } from "./dashboard-context";
import { DashboardOverview, DashboardRecordings, PageHeading } from "./dashboard-overview";
import { ServiceState } from "./ui";
import { SettingsCenter } from "./settings-center";

export function DashboardSection({ section }: { section: DashboardSectionName }) {
  if (section === "upcoming" || section === "past")
    return <DashboardOverview filter={section} />;
  if (section === "recordings") return <DashboardRecordings />;
  if (section === "analytics") return <AnalyticsSection />;
  if (section === "team") return <TeamSection />;
  if (section === "settings") return <SettingsCenter />;
  return null;
}

function TeamSection() {
  const locale = useLocale();
  const { workspace } = useDashboard();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"ADMIN" | "MEMBER">("MEMBER");
  const [message, setMessage] = useState("");
  const membersQuery = useQuery({
    queryKey: ["workspace-members", workspace.id],
    queryFn: () => api.listWorkspaceMembers(workspace.id),
  });
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ["workspace-members", workspace.id] });
  const addMember = useMutation({
    mutationFn: () => api.addWorkspaceMember(workspace.id, { email: email.trim(), role }),
    onSuccess: async () => {
      setEmail("");
      setMessage(locale === "ru" ? "Участник добавлен" : "Member added");
      await refresh();
    },
    onError: (error) => setMessage(friendlyError(error, locale)),
  });

  async function changeRole(userId: string, nextRole: "ADMIN" | "MEMBER") {
    setMessage("");
    try {
      await api.updateWorkspaceMember(workspace.id, userId, nextRole);
      await refresh();
    } catch (error) {
      setMessage(friendlyError(error, locale));
    }
  }

  async function removeMember(userId: string) {
    if (!window.confirm(locale === "ru" ? "Удалить участника из команды?" : "Remove this team member?")) return;
    setMessage("");
    try {
      await api.removeWorkspaceMember(workspace.id, userId);
      await refresh();
    } catch (error) {
      setMessage(friendlyError(error, locale));
    }
  }

  const members = membersQuery.data?.members ?? [];
  return (
    <div className="dashboard-page">
      <PageHeading
        eyebrow={workspace.name}
        title={locale === "ru" ? "Команда" : "Team"}
        body={
          locale === "ru"
            ? "Добавляйте зарегистрированных пользователей и управляйте доступом к пространству."
            : "Add registered users and manage workspace access."
        }
      />
      <form
        className="team-invite-card"
        onSubmit={(event) => {
          event.preventDefault();
          setMessage("");
          if (email.trim()) addMember.mutate();
        }}
      >
        <UserPlus size={21} />
        <input
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder={locale === "ru" ? "Email пользователя" : "User email"}
        />
        <select value={role} onChange={(event) => setRole(event.target.value as "ADMIN" | "MEMBER") }>
          <option value="MEMBER">{locale === "ru" ? "Участник" : "Member"}</option>
          <option value="ADMIN">{locale === "ru" ? "Администратор" : "Admin"}</option>
        </select>
        <Button type="submit" disabled={addMember.isPending}>
          {addMember.isPending ? <LoaderCircle className="spin" size={16} /> : <UserPlus size={16} />}
          {locale === "ru" ? "Добавить" : "Add"}
        </Button>
      </form>
      {message ? <p className="team-feedback" role="status">{message}</p> : null}
      {membersQuery.isLoading ? (
        <div className="recordings-grid"><ServiceState icon={<UsersRound size={20} />} title={locale === "ru" ? "Загрузка команды" : "Loading team"} description="Laminaria" /></div>
      ) : membersQuery.isError ? (
        <ServiceState icon={<UsersRound size={20} />} title={locale === "ru" ? "Команда недоступна" : "Team unavailable"} description={friendlyError(membersQuery.error, locale)} />
      ) : (
        <div className="team-members-list">
          {members.map((member) => (
            <article className="team-member-row" key={member.userId}>
              <span className="team-member-avatar">{(member.name || member.email).slice(0, 1).toUpperCase()}</span>
              <div><strong>{member.name || member.email}</strong><small>{member.email}</small></div>
              {member.role === "OWNER" ? (
                <span className="team-owner-badge">OWNER</span>
              ) : (
                <>
                  <select value={member.role} onChange={(event) => void changeRole(member.userId, event.target.value as "ADMIN" | "MEMBER") }>
                    <option value="MEMBER">{locale === "ru" ? "Участник" : "Member"}</option>
                    <option value="ADMIN">{locale === "ru" ? "Администратор" : "Admin"}</option>
                  </select>
                  <button type="button" className="team-remove" onClick={() => void removeMember(member.userId)} aria-label={locale === "ru" ? "Удалить" : "Remove"}><Trash2 size={17} /></button>
                </>
              )}
            </article>
          ))}
        </div>
      )}
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
