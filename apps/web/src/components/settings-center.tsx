"use client";

/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Bell,
  BarChart3,
  Braces,
  Camera,
  Check,
  ChevronRight,
  CreditCard,
  Download,
  Globe2,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  Mic,
  MonitorSpeaker,
  Palette,
  Save,
  ShieldCheck,
  Trash2,
  Upload,
  UserRound,
  UsersRound,
  Video,
  X,
} from "lucide-react";
import { useLocale } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { useRouter } from "@/i18n/navigation";
import {
  api,
  friendlyError,
  type UpdateProfileInput,
  type BrandingSettings,
  type PollDefaults,
  type UserPreferences,
  type WebinarDefaults,
} from "@/lib/api";
import { Button } from "@laminaria/ui";
import { useDashboard } from "./dashboard-context";
import { PageHeading } from "./dashboard-overview";
import { StyledSelect } from "./styled-select";

type SettingsTab =
  | "profile"
  | "workspace"
  | "webinars"
  | "polls"
  | "branding"
  | "integrations"
  | "notifications"
  | "devices"
  | "billing"
  | "security";

const FALLBACK_TIMEZONES = [
  "UTC",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Paris",
  "Europe/Moscow",
  "Asia/Qyzylorda",
  "Asia/Almaty",
  "Asia/Tbilisi",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
];

const DEFAULT_WEBINAR: WebinarDefaults = {
  language: "ru",
  timezone: "UTC",
  access: "PUBLIC",
  allowGuests: true,
  requireRegistration: true,
  autoRecording: false,
  viewerChat: true,
};

const DEFAULT_POLLS: PollDefaults = {
  enabled: true,
  anonymousVoting: false,
  resultsVisibility: "LIVE",
};

const DEFAULT_BRANDING: BrandingSettings = {
  accentColor: "#7457ff",
  coverImageUrl: null,
};

const DEFAULT_NOTIFICATIONS = {
  registrationConfirmation: true,
  webinarReminder: true,
  teamInvitation: true,
  recordingReady: true,
};

const DEFAULT_DEVICES = { cameraId: "", microphoneId: "", speakerId: "", videoQuality: "auto" as const };

export function SettingsCenter() {
  const locale = useLocale() as "en" | "ru";
  const ru = locale === "ru";
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { user, workspace } = useDashboard();
  const [tab, setTab] = useState<SettingsTab>("profile");
  const [notice, setNotice] = useState("");
  const [profile, setProfile] = useState({
    name: user.name,
    avatarUrl: user.avatarUrl ?? "",
    locale: user.locale,
    timezone: user.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC",
  });
  const [workspaceForm, setWorkspaceForm] = useState({ name: workspace.name, logoUrl: "" });
  const [webinar, setWebinar] = useState<WebinarDefaults>({
    ...DEFAULT_WEBINAR,
    language: locale,
    timezone: workspace.timezone ?? profile.timezone,
  });
  const [polls, setPolls] = useState<PollDefaults>(DEFAULT_POLLS);
  const [branding, setBranding] = useState<BrandingSettings>(DEFAULT_BRANDING);
  const [notifications, setNotifications] = useState(DEFAULT_NOTIFICATIONS);
  const [devices, setDevices] = useState<NonNullable<UserPreferences["devices"]>>(DEFAULT_DEVICES);
  const [passwords, setPasswords] = useState({ current: "", next: "", confirm: "" });

  useEffect(() => {
    if (searchParams.get("tab") === "billing") setTab("billing");
  }, [searchParams]);

  const settingsQuery = useQuery({
    queryKey: ["workspace-settings", workspace.id],
    queryFn: () => api.workspaceSettings(workspace.id),
  });
  const sessionsQuery = useQuery({
    queryKey: ["account-sessions"],
    queryFn: api.listSessions,
    enabled: tab === "security",
  });
  const servicesQuery = useQuery({
    queryKey: ["service-status"],
    queryFn: ({ signal }) => api.serviceStatus(signal),
    enabled: tab === "billing",
  });

  useEffect(() => {
    const payload = settingsQuery.data;
    if (!payload) return;
    setWorkspaceForm({
      name: payload.workspace.name,
      logoUrl: payload.workspace.logoUrl ?? "",
    });
    setWebinar({
      ...DEFAULT_WEBINAR,
      language: payload.workspace.locale,
      timezone: payload.workspace.timezone,
      ...payload.workspace.settings.webinarDefaults,
    });
    setPolls({ ...DEFAULT_POLLS, ...payload.workspace.settings.polls });
    setBranding({ ...DEFAULT_BRANDING, ...payload.workspace.settings.branding });
  }, [settingsQuery.data]);

  useEffect(() => {
    setNotifications({ ...DEFAULT_NOTIFICATIONS, ...user.preferences?.notifications });
    setDevices({ ...DEFAULT_DEVICES, ...user.preferences?.devices });
  }, [user.preferences]);

  const tabs = useMemo(
    () => [
      { id: "profile" as const, icon: UserRound, label: ru ? "Профиль" : "Profile" },
      { id: "workspace" as const, icon: UsersRound, label: ru ? "Рабочее пространство" : "Workspace" },
      { id: "webinars" as const, icon: Video, label: ru ? "Вебинары" : "Webinars" },
      { id: "polls" as const, icon: BarChart3, label: ru ? "Опросы" : "Polls" },
      { id: "branding" as const, icon: Palette, label: ru ? "Брендинг" : "Branding" },
      { id: "integrations" as const, icon: Braces, label: "API & Webhooks" },
      { id: "notifications" as const, icon: Bell, label: ru ? "Уведомления" : "Notifications" },
      { id: "devices" as const, icon: Camera, label: ru ? "Камера и звук" : "Camera & audio" },
      { id: "billing" as const, icon: CreditCard, label: ru ? "Тариф и оплата" : "Plan & billing" },
      { id: "security" as const, icon: ShieldCheck, label: ru ? "Безопасность" : "Security" },
    ],
    [ru],
  );

  const saveProfile = useMutation({
    mutationFn: (input: UpdateProfileInput) => api.updateProfile(input),
    onSuccess: async () => {
      setNotice(ru ? "Настройки профиля сохранены" : "Profile settings saved");
      await queryClient.invalidateQueries({ queryKey: ["me"] });
      if (profile.locale !== locale) {
        window.location.href = window.location.pathname.replace(/^\/(en|ru)(?=\/|$)/, `/${profile.locale}`);
      }
    },
    onError: (error) => setNotice(friendlyError(error, locale)),
  });
  const saveWorkspace = useMutation({
    mutationFn: () =>
      api.updateWorkspaceSettings(workspace.id, {
        name: workspaceForm.name.trim(),
        logoUrl: workspaceForm.logoUrl.trim() || null,
      }),
    onSuccess: async () => {
      setNotice(ru ? "Рабочее пространство обновлено" : "Workspace updated");
      await Promise.all([
        settingsQuery.refetch(),
        queryClient.invalidateQueries({ queryKey: ["workspaces"] }),
      ]);
    },
    onError: (error) => setNotice(friendlyError(error, locale)),
  });
  const saveWebinar = useMutation({
    mutationFn: () =>
      api.updateWorkspaceSettings(workspace.id, {
        locale: webinar.language,
        timezone: webinar.timezone,
        settings: { webinarDefaults: webinar },
      }),
    onSuccess: () => setNotice(ru ? "Настройки вебинаров сохранены" : "Webinar defaults saved"),
    onError: (error) => setNotice(friendlyError(error, locale)),
  });
  const savePolls = useMutation({
    mutationFn: () => api.updateWorkspaceSettings(workspace.id, { settings: { polls } }),
    onSuccess: async () => {
      setNotice(ru ? "Настройки опросов сохранены" : "Poll settings saved");
      await settingsQuery.refetch();
    },
    onError: (error) => setNotice(friendlyError(error, locale)),
  });
  const saveBranding = useMutation({
    mutationFn: () =>
      api.updateWorkspaceSettings(workspace.id, {
        logoUrl: workspaceForm.logoUrl.trim() || null,
        settings: { branding },
      }),
    onSuccess: async () => {
      setNotice(ru ? "Брендинг сохранён" : "Branding saved");
      await Promise.all([
        settingsQuery.refetch(),
        queryClient.invalidateQueries({ queryKey: ["workspaces"] }),
      ]);
    },
    onError: (error) => setNotice(friendlyError(error, locale)),
  });

  async function savePreferences(next: UserPreferences) {
    try {
      await api.updateProfile({ preferences: { ...user.preferences, ...next } });
      setNotice(ru ? "Предпочтения сохранены" : "Preferences saved");
      await queryClient.invalidateQueries({ queryKey: ["me"] });
    } catch (error) {
      setNotice(friendlyError(error, locale));
    }
  }

  return (
    <div className="dashboard-page settings-center">
      <PageHeading
        eyebrow={workspace.name}
        title={ru ? "Настройки" : "Settings"}
        body={ru ? "Аккаунт, пространство и параметры ваших эфиров — в одном месте." : "Your account, workspace and webinar defaults in one place."}
      />

      {notice ? (
        <div className="settings-toast" role="status">
          <Check size={17} />
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice("")} aria-label={ru ? "Закрыть" : "Close"}><X size={16} /></button>
        </div>
      ) : null}

      <div className="settings-layout">
        <nav className="settings-nav" aria-label={ru ? "Разделы настроек" : "Settings sections"}>
          {tabs.map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.id} type="button" className={tab === item.id ? "is-active" : ""} onClick={() => setTab(item.id)}>
                <Icon size={18} />
                <span>{item.label}</span>
                <ChevronRight size={15} />
              </button>
            );
          })}
        </nav>

        <main className="settings-panel">
          {settingsQuery.isLoading ? <SettingsLoading /> : null}
          {tab === "profile" ? (
            <ProfileSettings
              ru={ru}
              email={user.email}
              value={profile}
              setValue={setProfile}
              passwords={passwords}
              setPasswords={setPasswords}
              saving={saveProfile.isPending}
              onSave={() => saveProfile.mutate({ ...profile, avatarUrl: profile.avatarUrl.trim() || null })}
              onPassword={async () => {
                if (passwords.next !== passwords.confirm) return setNotice(ru ? "Новые пароли не совпадают" : "New passwords do not match");
                try {
                  await api.changePassword({ currentPassword: passwords.current, newPassword: passwords.next });
                  setPasswords({ current: "", next: "", confirm: "" });
                  setNotice(ru ? "Пароль изменён" : "Password changed");
                } catch (error) { setNotice(friendlyError(error, locale)); }
              }}
              setNotice={setNotice}
            />
          ) : null}
          {tab === "workspace" ? (
            <WorkspaceSettingsView
              ru={ru}
              role={settingsQuery.data?.role ?? workspace.role ?? "MEMBER"}
              value={workspaceForm}
              setValue={setWorkspaceForm}
              saving={saveWorkspace.isPending}
              onSave={() => saveWorkspace.mutate()}
              onTeam={() => router.push("/dashboard/team")}
              onDelete={async () => {
                if (!window.confirm(ru ? `Удалить «${workspace.name}» вместе со всеми вебинарами?` : `Delete “${workspace.name}” and all its webinars?`)) return;
                try { await api.deleteWorkspace(workspace.id); window.location.href = `/${locale}/onboarding`; }
                catch (error) { setNotice(friendlyError(error, locale)); }
              }}
              setNotice={setNotice}
            />
          ) : null}
          {tab === "webinars" ? <WebinarSettings ru={ru} value={webinar} setValue={setWebinar} saving={saveWebinar.isPending} onSave={() => saveWebinar.mutate()} /> : null}
          {tab === "polls" ? <PollSettings ru={ru} value={polls} setValue={setPolls} saving={savePolls.isPending} onSave={() => savePolls.mutate()} /> : null}
          {tab === "branding" ? <BrandingSettingsView ru={ru} workspace={workspaceForm} setWorkspace={setWorkspaceForm} value={branding} setValue={setBranding} saving={saveBranding.isPending} onSave={() => saveBranding.mutate()} setNotice={setNotice} /> : null}
          {tab === "integrations" ? <ApiComingSoon ru={ru} /> : null}
          {tab === "notifications" ? <NotificationSettings ru={ru} value={notifications} setValue={setNotifications} onSave={() => void savePreferences({ notifications })} /> : null}
          {tab === "devices" ? <DeviceSettings ru={ru} value={devices} setValue={setDevices} onSave={() => void savePreferences({ devices })} setNotice={setNotice} /> : null}
          {tab === "billing" ? <BillingSettings ru={ru} payload={settingsQuery.data} locale={locale} setNotice={setNotice} refresh={() => settingsQuery.refetch()} billingConfigured={servicesQuery.data?.services.find((service) => service.key === "billing")?.configured ?? false} billingStatusLoading={servicesQuery.isLoading} /> : null}
          {tab === "security" ? (
            <SecuritySettings
              ru={ru}
              sessions={sessionsQuery.data?.sessions ?? []}
              loading={sessionsQuery.isLoading}
              onLogoutAll={async () => { await api.revokeAllSessions(); window.location.href = `/${locale}/sign-in`; }}
              onExport={async () => {
                const [data, spaces] = await Promise.all([api.exportAccount(), api.listWorkspaces()]);
                downloadJson({ ...data, workspaces: spaces.workspaces }, "laminaria-data.json");
              }}
              onDelete={async () => {
                if (!window.confirm(ru ? "Удалить аккаунт без возможности восстановления?" : "Permanently delete your account?")) return;
                await api.deleteAccount(); window.location.href = `/${locale}`;
              }}
            />
          ) : null}
        </main>
      </div>
    </div>
  );
}

function SettingsLoading() {
  return <div className="settings-loading"><LoaderCircle className="spin" size={20} /></div>;
}

function SettingsHeader({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return <header className="settings-panel__header"><span>{icon}</span><div><h2>{title}</h2><p>{body}</p></div></header>;
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <label className="settings-field"><span>{label}</span>{children}{hint ? <small>{hint}</small> : null}</label>;
}

function SaveButton({ ru, loading, onClick }: { ru: boolean; loading?: boolean; onClick: () => void }) {
  return <Button onClick={onClick} disabled={loading}>{loading ? <LoaderCircle className="spin" size={17} /> : <Save size={17} />}{ru ? "Сохранить изменения" : "Save changes"}</Button>;
}

function ProfileSettings({ ru, email, value, setValue, passwords, setPasswords, saving, onSave, onPassword, setNotice }: any) {
  const zones = timezones();
  return <section className="settings-stack">
    <SettingsHeader icon={<UserRound />} title={ru ? "Профиль" : "Profile"} body={ru ? "Как вас видят участники и команда." : "How your team and attendees see you."} />
    <div className="settings-card settings-profile-card">
      <ImageUpload kind="avatar" value={value.avatarUrl} label={ru ? "Загрузить аватар" : "Upload avatar"} ru={ru} setNotice={setNotice} onChange={(avatarUrl: string) => setValue({ ...value, avatarUrl })} />
      <div className="settings-form-grid">
        <Field label={ru ? "Имя и фамилия" : "Full name"}><input value={value.name} onChange={(e) => setValue({ ...value, name: e.target.value })} /></Field>
        <Field label="Email" hint={ru ? "Email аккаунта нельзя изменить здесь." : "Your account email cannot be changed here."}><input value={email} disabled /></Field>
        <Field label={ru ? "Язык интерфейса" : "Interface language"}><StyledSelect value={value.locale} ariaLabel={ru ? "Язык интерфейса" : "Interface language"} options={[{ value: "ru", label: "Русский" }, { value: "en", label: "English" }]} onChange={(next) => setValue({ ...value, locale: next })} /></Field>
        <Field label={ru ? "Часовой пояс" : "Time zone"}><StyledSelect value={value.timezone} ariaLabel={ru ? "Часовой пояс" : "Time zone"} options={zones.map((zone: string) => ({ value: zone, label: zone }))} onChange={(next) => setValue({ ...value, timezone: next })} /></Field>
      </div>
      <div className="settings-actions"><SaveButton ru={ru} loading={saving} onClick={onSave} /></div>
    </div>
    <form className="settings-card" onSubmit={(event) => { event.preventDefault(); void onPassword(); }}><h3><KeyRound size={18} />{ru ? "Смена пароля" : "Change password"}</h3><div className="settings-form-grid settings-form-grid--three">
      <input className="lm-sr-only" type="email" name="username" autoComplete="username" value={email} readOnly tabIndex={-1} aria-hidden="true" />
      <Field label={ru ? "Текущий пароль" : "Current password"}><input type="password" name="current-password" autoComplete="current-password" required value={passwords.current} onChange={(e) => setPasswords({ ...passwords, current: e.target.value })} /></Field>
      <Field label={ru ? "Новый пароль" : "New password"}><input type="password" name="new-password" autoComplete="new-password" required minLength={12} value={passwords.next} onChange={(e) => setPasswords({ ...passwords, next: e.target.value })} /></Field>
      <Field label={ru ? "Повторите пароль" : "Confirm password"}><input type="password" name="confirm-password" autoComplete="new-password" required minLength={12} value={passwords.confirm} onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })} /></Field>
    </div><div className="settings-actions"><Button type="submit" variant="secondary">{ru ? "Изменить пароль" : "Change password"}</Button></div></form>
  </section>;
}

function WorkspaceSettingsView({ ru, role, value, setValue, saving, onSave, onTeam, onDelete, setNotice }: any) {
  const canManage = role === "OWNER" || role === "ADMIN";
  return <section className="settings-stack"><SettingsHeader icon={<UsersRound />} title={ru ? "Рабочее пространство" : "Workspace"} body={ru ? "Бренд и доступ вашей команды." : "Your team identity and access."} />
    <div className="settings-card"><div className="settings-form-grid">
      <Field label={ru ? "Название Workspace" : "Workspace name"}><input value={value.name} disabled={!canManage} onChange={(e) => setValue({ ...value, name: e.target.value })} /></Field>
      <Field label={ru ? "Логотип" : "Logo"}><ImageUpload kind="workspace-logo" value={value.logoUrl} label={ru ? "Загрузить логотип" : "Upload logo"} ru={ru} disabled={!canManage} setNotice={setNotice} onChange={(logoUrl: string) => setValue({ ...value, logoUrl })} /></Field>
    </div><div className="settings-actions"><Button variant="secondary" onClick={onTeam}><UsersRound size={17} />{ru ? "Участники и роли" : "Members and roles"}</Button>{canManage ? <SaveButton ru={ru} loading={saving} onClick={onSave} /> : null}</div></div>
    {role === "OWNER" ? <DangerCard title={ru ? "Удаление Workspace" : "Delete workspace"} body={ru ? "Вебинары и настройки пространства будут недоступны. Действие необратимо." : "Webinars and workspace settings will become unavailable. This cannot be undone."} action={ru ? "Удалить Workspace" : "Delete workspace"} onClick={onDelete} /> : null}
  </section>;
}

function WebinarSettings({ ru, value, setValue, saving, onSave }: any) {
  return <section className="settings-stack"><SettingsHeader icon={<Video />} title={ru ? "Вебинары по умолчанию" : "Webinar defaults"} body={ru ? "Эти значения подставляются при создании нового вебинара." : "These values prefill every new webinar."} />
    <div className="settings-card"><div className="settings-form-grid">
      <Field label={ru ? "Язык вебинара" : "Webinar language"}><StyledSelect value={value.language} ariaLabel={ru ? "Язык вебинара" : "Webinar language"} options={[{ value: "ru", label: "Русский" }, { value: "en", label: "English" }]} onChange={(next) => setValue({ ...value, language: next })} /></Field>
      <Field label={ru ? "Часовой пояс" : "Time zone"}><StyledSelect value={value.timezone} ariaLabel={ru ? "Часовой пояс" : "Time zone"} options={timezones().map((zone) => ({ value: zone, label: zone }))} onChange={(next) => setValue({ ...value, timezone: next })} /></Field>
      <Field label={ru ? "Доступ" : "Access"}><StyledSelect value={value.access} ariaLabel={ru ? "Доступ" : "Access"} options={[{ value: "PUBLIC", label: ru ? "Публичный" : "Public" }, { value: "PRIVATE", label: ru ? "Приватный" : "Private" }]} onChange={(next) => setValue({ ...value, access: next })} /></Field>
    </div><div className="settings-toggle-list">
      <Toggle label={ru ? "Разрешать гостевой вход" : "Allow guest entry"} checked={value.allowGuests} onChange={(checked) => setValue({ ...value, allowGuests: checked })} />
      <Toggle label={ru ? "Требовать регистрацию" : "Require registration"} checked={value.requireRegistration} onChange={(checked) => setValue({ ...value, requireRegistration: checked })} />
      <Toggle label={ru ? "Автоматически запускать запись" : "Start recording automatically"} checked={value.autoRecording} onChange={(checked) => setValue({ ...value, autoRecording: checked })} />
      <Toggle label={ru ? "Разрешать чат зрителям" : "Allow attendee chat"} checked={value.viewerChat} onChange={(checked) => setValue({ ...value, viewerChat: checked })} />
    </div><div className="settings-actions"><SaveButton ru={ru} loading={saving} onClick={onSave} /></div></div>
  </section>;
}

function PollSettings({ ru, value, setValue, saving, onSave }: any) {
  return (
    <section className="settings-stack">
      <SettingsHeader
        icon={<BarChart3 />}
        title={ru ? "Опросы" : "Polls"}
        body={
          ru
            ? "Управляйте голосованием зрителей и моментом показа результатов."
            : "Control attendee voting and when results become visible."
        }
      />
      <div className="settings-card">
        <div className="settings-toggle-list">
          <Toggle
            label={ru ? "Включить опросы" : "Enable polls"}
            checked={value.enabled}
            onChange={(enabled) => setValue({ ...value, enabled })}
          />
          <Toggle
            label={ru ? "Анонимное голосование" : "Anonymous voting"}
            checked={value.anonymousVoting}
            onChange={(anonymousVoting) => setValue({ ...value, anonymousVoting })}
          />
        </div>
        <div className="settings-form-grid settings-poll-result-mode">
          <Field label={ru ? "Показывать результаты" : "Show results"}>
            <StyledSelect
              value={value.resultsVisibility}
              ariaLabel={ru ? "Показывать результаты" : "Show results"}
              options={[
                { value: "LIVE", label: ru ? "Сразу во время голосования" : "Live while voting" },
                { value: "AFTER_CLOSE", label: ru ? "После закрытия опроса" : "After the poll closes" },
              ]}
              onChange={(resultsVisibility) => setValue({ ...value, resultsVisibility })}
            />
          </Field>
        </div>
        <div className="settings-actions">
          <SaveButton ru={ru} loading={saving} onClick={onSave} />
        </div>
      </div>
    </section>
  );
}

function BrandingSettingsView({
  ru,
  workspace,
  setWorkspace,
  value,
  setValue,
  saving,
  onSave,
  setNotice,
}: any) {
  const colors = ["#7457ff", "#4dd0e1", "#3ec6b8", "#ff6b8a", "#f2a93b"];
  return (
    <section className="settings-stack">
      <SettingsHeader
        icon={<Palette />}
        title={ru ? "Брендинг" : "Branding"}
        body={
          ru
            ? "Оформление страницы регистрации и ожидания в стиле вашей команды."
            : "Style registration and waiting pages for your team."
        }
      />
      <div className="settings-card branding-settings-grid">
        <Field label={ru ? "Логотип Workspace" : "Workspace logo"}>
          <ImageUpload
            kind="workspace-logo"
            value={workspace.logoUrl}
            label={ru ? "Загрузить логотип" : "Upload logo"}
            ru={ru}
            setNotice={setNotice}
            onChange={(logoUrl: string) => setWorkspace({ ...workspace, logoUrl })}
          />
        </Field>
        <Field label={ru ? "Обложка вебинара" : "Webinar cover"}>
          <ImageUpload
            kind="webinar-cover"
            value={value.coverImageUrl ?? ""}
            label={ru ? "Загрузить обложку" : "Upload cover"}
            ru={ru}
            setNotice={setNotice}
            onChange={(coverImageUrl: string) => setValue({ ...value, coverImageUrl })}
          />
        </Field>
        <Field label={ru ? "Акцентный цвет" : "Accent color"}>
          <div className="brand-color-control">
            <input
              type="color"
              value={value.accentColor}
              onChange={(event) => setValue({ ...value, accentColor: event.target.value })}
              aria-label={ru ? "Акцентный цвет" : "Accent color"}
            />
            <code>{value.accentColor.toUpperCase()}</code>
            <div className="brand-color-presets">
              {colors.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={value.accentColor.toLowerCase() === color ? "is-active" : ""}
                  style={{ background: color }}
                  onClick={() => setValue({ ...value, accentColor: color })}
                  aria-label={color}
                />
              ))}
            </div>
          </div>
        </Field>
        <div className="branding-preview" style={{ "--preview-accent": value.accentColor } as React.CSSProperties}>
          {value.coverImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value.coverImageUrl} alt="" />
          ) : <span className="branding-preview__art" />}
          <div>
            {workspace.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={workspace.logoUrl} alt="" />
            ) : null}
            <small>{workspace.name}</small>
            <strong>{ru ? "Добро пожаловать на вебинар" : "Welcome to the webinar"}</strong>
            <button type="button">{ru ? "Зарегистрироваться" : "Register"}</button>
          </div>
        </div>
        <div className="settings-actions branding-settings-actions">
          <SaveButton ru={ru} loading={saving} onClick={onSave} />
        </div>
      </div>
      <ComingSoonCard
        ru={ru}
        title="White Label"
        body={ru ? "Собственный домен, скрытие Laminaria и фирменные email-письма появятся в Business." : "Custom domains, hidden Laminaria branding and branded email will arrive in Business."}
        items={ru ? ["Собственный домен", "Без Powered by Laminaria", "Оформление писем", "Фавикон"] : ["Custom domain", "No Powered by Laminaria", "Branded email", "Favicon"]}
      />
    </section>
  );
}

function ApiComingSoon({ ru }: { ru: boolean }) {
  return (
    <section className="settings-stack">
      <SettingsHeader
        icon={<Braces />}
        title="API & Webhooks"
        body={ru ? "Интеграция Laminaria с сайтом, CRM или LMS." : "Connect Laminaria to your website, CRM or LMS."}
      />
      <ComingSoonCard
        ru={ru}
        title={ru ? "Публичный API — скоро" : "Public API — coming soon"}
        body={ru ? "Запланирован для Business после запуска MVP. Сейчас раздел ничего не имитирует и не создаёт небезопасные ключи." : "Planned for Business after the MVP launch. This section does not create fake or insecure keys."}
        items={["webinar.started", "webinar.ended", "participant.registered", "recording.ready", "poll.completed"]}
      />
    </section>
  );
}

function ComingSoonCard({ ru, title, body, items }: { ru: boolean; title: string; body: string; items: string[] }) {
  return (
    <div className="settings-card business-coming-soon">
      <div className="business-coming-soon__icon"><LockKeyhole size={22} /></div>
      <div>
        <span>BUSINESS · {ru ? "СКОРО" : "COMING SOON"}</span>
        <h3>{title}</h3>
        <p>{body}</p>
        <div className="business-coming-soon__items">
          {items.map((item) => <code key={item}>{item}</code>)}
        </div>
      </div>
    </div>
  );
}

function NotificationSettings({ ru, value, setValue, onSave }: any) {
  const rows = [{ key: "registrationConfirmation", label: ru ? "Подтверждение регистрации" : "Registration confirmation" }, { key: "webinarReminder", label: ru ? "Напоминание перед вебинаром" : "Webinar reminder" }, { key: "teamInvitation", label: ru ? "Приглашение в команду" : "Team invitation" }, { key: "recordingReady", label: ru ? "Готовая запись" : "Recording ready" }];
  return <section className="settings-stack"><SettingsHeader icon={<Bell />} title={ru ? "Уведомления" : "Notifications"} body={ru ? "Выберите важные события, о которых стоит сообщать." : "Choose which important events should notify you."} /><div className="settings-card"><div className="settings-toggle-list">{rows.map((row) => <Toggle key={row.key} label={row.label} checked={value[row.key]} onChange={(checked) => setValue({ ...value, [row.key]: checked })} />)}</div><div className="settings-actions"><SaveButton ru={ru} onClick={onSave} /></div></div></section>;
}

function DeviceSettings({ ru, value, setValue, onSave, setNotice }: any) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [testing, setTesting] = useState(false);
  const [available, setAvailable] = useState<{ cameras: MediaDeviceInfo[]; microphones: MediaDeviceInfo[]; speakers: MediaDeviceInfo[] }>({ cameras: [], microphones: [], speakers: [] });
  useEffect(() => { void navigator.mediaDevices?.enumerateDevices().then((items) => setAvailable({ cameras: items.filter((x) => x.kind === "videoinput"), microphones: items.filter((x) => x.kind === "audioinput"), speakers: items.filter((x) => x.kind === "audiooutput") })).catch(() => undefined); return () => streamRef.current?.getTracks().forEach((track) => track.stop()); }, []);
  async function test() { try { streamRef.current?.getTracks().forEach((track) => track.stop()); const stream = await navigator.mediaDevices.getUserMedia({ video: value.cameraId ? { deviceId: { exact: value.cameraId } } : true, audio: value.microphoneId ? { deviceId: { exact: value.microphoneId } } : true }); streamRef.current = stream; setTesting(true); requestAnimationFrame(() => { if (videoRef.current) { videoRef.current.srcObject = stream; void videoRef.current.play(); } }); const items = await navigator.mediaDevices.enumerateDevices(); setAvailable({ cameras: items.filter((x) => x.kind === "videoinput"), microphones: items.filter((x) => x.kind === "audioinput"), speakers: items.filter((x) => x.kind === "audiooutput") }); } catch { setNotice(ru ? "Разрешите браузеру доступ к камере и микрофону" : "Allow browser camera and microphone access"); } }
  function stop() { streamRef.current?.getTracks().forEach((track) => track.stop()); streamRef.current = null; setTesting(false); }
  return <section className="settings-stack"><SettingsHeader icon={<Camera />} title={ru ? "Камера и звук" : "Camera & audio"} body={ru ? "Устройства, которые будут выбраны перед эфиром." : "Devices selected when you enter a webinar."} /><div className="settings-card"><div className="settings-form-grid">
    <DeviceSelect icon={<Camera />} label={ru ? "Камера по умолчанию" : "Default camera"} value={value.cameraId ?? ""} items={available.cameras} fallback={ru ? "Системная камера" : "System default camera"} onChange={(cameraId: string) => setValue({ ...value, cameraId })} />
    <DeviceSelect icon={<Mic />} label={ru ? "Микрофон по умолчанию" : "Default microphone"} value={value.microphoneId ?? ""} items={available.microphones} fallback={ru ? "Системный микрофон" : "System default microphone"} onChange={(microphoneId: string) => setValue({ ...value, microphoneId })} />
    <DeviceSelect icon={<MonitorSpeaker />} label={ru ? "Динамики" : "Speakers"} value={value.speakerId ?? ""} items={available.speakers} fallback={ru ? "Системные динамики" : "System default speakers"} onChange={(speakerId: string) => setValue({ ...value, speakerId })} />
    <Field label={ru ? "Качество видео" : "Video quality"}><StyledSelect value={value.videoQuality ?? "auto"} ariaLabel={ru ? "Качество видео" : "Video quality"} options={["auto", "360p", "480p", "720p", "1080p"].map((quality) => ({ value: quality, label: quality === "720p" ? "720p HD" : quality === "1080p" ? "1080p Full HD" : quality }))} onChange={(videoQuality) => setValue({ ...value, videoQuality })} /></Field>
  </div>{testing ? <div className="device-preview"><video ref={videoRef} muted playsInline /><span><span className="device-preview__live" />{ru ? "Устройства работают" : "Devices are working"}</span></div> : null}<div className="settings-actions"><Button variant="secondary" onClick={testing ? stop : test}><Camera size={17} />{testing ? (ru ? "Завершить тест" : "Stop test") : (ru ? "Тест устройств" : "Test devices")}</Button><SaveButton ru={ru} onClick={onSave} /></div></div></section>;
}

function DeviceSelect({ icon, label, value, items, fallback, onChange }: any) { return <Field label={label}><div className="settings-input-icon">{icon}<StyledSelect value={value} ariaLabel={label} options={[{ value: "", label: fallback }, ...items.map((item: MediaDeviceInfo, index: number) => ({ value: item.deviceId, label: item.label || `${label} ${index + 1}` }))]} onChange={onChange} /></div></Field>; }

function BillingSettings({ ru, payload, locale, setNotice, refresh, billingConfigured, billingStatusLoading }: any) {
  const usage = payload?.usage ?? { members: 0, webinars: 0, recordings: 0, storageBytes: 0 };
  const plan = String(payload?.planCode ?? "FREE").toUpperCase();
  const [interval, setInterval] = useState<"month" | "year">("year");
  const [loading, setLoading] = useState<string | null>(null);
  const workspaceId = payload?.workspace?.id as string | undefined;
  const offers = [
    { id: "free", name: "Free", month: 0, year: 0, features: ru ? ["До 25 участников", "HD-видео", "Чат", "Демонстрация экрана"] : ["Up to 25 participants", "HD video", "Chat", "Screen sharing"] },
    { id: "professional", name: "Pro", month: 12, year: 120, features: ru ? ["До 150 участников", "Запись", "Аналитика", "Опросы", "Брендинг"] : ["Up to 150 participants", "Recording", "Analytics", "Polls", "Branding"] },
    { id: "business", name: "Business", month: 29, year: 290, features: ru ? ["До 1000 участников", "API", "White Label", "Команда"] : ["Up to 1,000 participants", "API", "White Label", "Team"] },
  ] as const;
  async function checkout(nextPlan: "professional" | "business") {
    if (!workspaceId || loading) return;
    setLoading(nextPlan);
    try {
      const result = await api.createBillingCheckout(workspaceId, { plan: nextPlan, interval, locale });
      window.location.assign(result.url);
    } catch (error) {
      setNotice(friendlyError(error, locale));
      setLoading(null);
    }
  }
  async function portal() {
    if (!workspaceId || loading) return;
    setLoading("portal");
    try {
      const result = await api.createBillingPortal(workspaceId, locale);
      window.location.assign(result.url);
    } catch (error) {
      setNotice(friendlyError(error, locale));
      setLoading(null);
    }
  }
  async function cancelAndRefund() {
    if (!workspaceId || loading) return;
    const confirmed = window.confirm(
      ru
        ? "Отменить подписку сейчас и вернуть последний платёж? Workspace сразу перейдёт на Free."
        : "Cancel now and refund the latest payment? The workspace will switch to Free immediately.",
    );
    if (!confirmed) return;
    setLoading("cancel");
    try {
      await api.cancelAndRefundBilling(workspaceId);
      await refresh();
      setNotice(
        ru
          ? "Подписка отменена, возврат отправлен. Тариф изменён на Free."
          : "Subscription cancelled, refund submitted, and the plan changed to Free.",
      );
    } catch (error) {
      setNotice(friendlyError(error, locale));
    } finally {
      setLoading(null);
    }
  }
  return <section className="settings-stack"><SettingsHeader icon={<CreditCard />} title={ru ? "Тариф и оплата" : "Plan & billing"} body={ru ? "Безопасная оплата картой и управление подпиской." : "Secure card payments and subscription management."} />
    {!billingStatusLoading && !billingConfigured ? <div className="billing-setup-notice"><AlertTriangle size={19} /><div><strong>{ru ? "Оплата ещё не подключена" : "Payments are not connected yet"}</strong><p>{ru ? "Добавьте Stripe-ключи в Render и перезапустите API. До этого списаний не будет." : "Add Stripe keys in Render and redeploy the API. No charges can be made until then."}</p></div></div> : null}
    <div className="settings-plan-card"><div><small>{ru ? "ТЕКУЩИЙ ТАРИФ" : "CURRENT PLAN"}</small><strong>{plan === "PROFESSIONAL" ? "PRO" : plan}</strong><p>{plan === "FREE" ? (ru ? "Бесплатно, без привязанной карты" : "Free, no card attached") : (ru ? "Подписка активна" : "Subscription active")}</p></div>{plan !== "FREE" ? <div className="settings-actions"><Button variant="secondary" onClick={() => void portal()} disabled={Boolean(loading)}>{loading === "portal" ? <LoaderCircle className="spin" size={17} /> : <CreditCard size={17} />}{ru ? "Управлять подпиской" : "Manage subscription"}</Button><Button variant="secondary" onClick={() => void cancelAndRefund()} disabled={Boolean(loading)}>{loading === "cancel" ? <LoaderCircle className="spin" size={17} /> : <Trash2 size={17} />}{ru ? "Отменить и вернуть оплату" : "Cancel and refund"}</Button></div> : null}</div>
    <div className="billing-period" role="group" aria-label={ru ? "Период оплаты" : "Billing interval"}><button type="button" className={interval === "year" ? "is-active" : ""} onClick={() => setInterval("year")}>{ru ? "Год" : "Year"}<span>{ru ? "выгоднее" : "best value"}</span></button><button type="button" className={interval === "month" ? "is-active" : ""} onClick={() => setInterval("month")}>{ru ? "Месяц" : "Month"}</button></div>
    <div className="billing-offers">{offers.map((offer) => { const current = plan === offer.id.toUpperCase() || (offer.id === "professional" && plan === "PRO"); const paid = offer.id !== "free"; const amount = interval === "year" ? offer.year : offer.month; return <article key={offer.id} className={`${offer.id === "professional" ? "is-featured" : ""} ${current ? "is-current" : ""}`}><header><div><small>{current ? (ru ? "ТЕКУЩИЙ" : "CURRENT") : "LAMINARIA"}</small><h3>{offer.name}</h3></div><div className="billing-price"><strong>${amount}</strong><span>{interval === "year" ? (ru ? "/год" : "/year") : (ru ? "/месяц" : "/month")}</span></div></header><ul>{offer.features.map((feature) => <li key={feature}><Check size={16} />{feature}</li>)}</ul>{paid ? <Button onClick={() => void checkout(offer.id)} disabled={!billingConfigured || current || Boolean(loading)}>{loading === offer.id ? <LoaderCircle className="spin" size={17} /> : <CreditCard size={17} />}{current ? (ru ? "Активен" : "Active") : !billingConfigured ? (ru ? "Нужно подключить Stripe" : "Connect Stripe first") : (ru ? "Оплатить картой" : "Pay by card")}</Button> : <Button variant="secondary" disabled>{current ? (ru ? "Активен" : "Active") : (ru ? "Бесплатно" : "Free")}</Button>}</article>; })}</div>
    <p className="billing-security"><LockKeyhole size={15} />{ru ? "Данные карты обрабатывает Stripe и не хранятся в Laminaria." : "Card details are processed by Stripe and are never stored by Laminaria."}</p>
    <div className="settings-card"><h3>{ru ? "Использованные лимиты" : "Usage"}</h3><div className="usage-grid"><Usage value={usage.members} label={ru ? "участников команды" : "team members"} /><Usage value={usage.webinars} label={ru ? "вебинаров" : "webinars"} /><Usage value={usage.recordings} label={ru ? "записей" : "recordings"} /><Usage value={formatBytes(usage.storageBytes)} label={ru ? "хранилище" : "storage"} /></div></div>
  </section>;
}

function SecuritySettings({ ru, sessions, loading, onLogoutAll, onExport, onDelete }: any) { return <section className="settings-stack"><SettingsHeader icon={<ShieldCheck />} title={ru ? "Безопасность" : "Security"} body={ru ? "Сессии, экспорт и контроль аккаунта." : "Sessions, exports and account control."} /><div className="settings-card"><h3>{ru ? "Активные сессии" : "Active sessions"}</h3>{loading ? <SettingsLoading /> : <div className="session-list">{sessions.map((session: any) => <div key={session.id}><span className="session-device"><Globe2 size={17} /></span><div><strong>{session.current ? (ru ? "Это устройство" : "This device") : browserName(session.userAgent)}</strong><small>{session.ipAddress ?? (ru ? "IP не определён" : "IP unavailable")} · {new Date(session.lastSeenAt).toLocaleString()}</small></div>{session.current ? <span className="session-current">{ru ? "Текущая" : "Current"}</span> : null}</div>)}</div>}<div className="settings-actions"><Button variant="secondary" onClick={onLogoutAll}><LogOut size={17} />{ru ? "Выйти со всех устройств" : "Sign out everywhere"}</Button></div></div><div className="settings-card"><h3>{ru ? "Ваши данные" : "Your data"}</h3><p className="settings-card__body">{ru ? "Скачайте копию данных аккаунта в формате JSON." : "Download a JSON copy of your account data."}</p><div className="settings-actions settings-actions--left"><Button variant="secondary" onClick={onExport}><Download size={17} />{ru ? "Экспортировать данные" : "Export data"}</Button></div></div><DangerCard title={ru ? "Удалить аккаунт" : "Delete account"} body={ru ? "Профиль будет удалён, а все активные сессии завершены. Действие необратимо." : "Your profile will be deleted and every session revoked. This cannot be undone."} action={ru ? "Удалить аккаунт" : "Delete account"} onClick={onDelete} /></section>; }

function ImageUpload({ kind, value, label, onChange, ru, disabled = false, setNotice }: any) {
  const [uploading, setUploading] = useState(false);
  async function selectFile(file: File | undefined) {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 2 * 1024 * 1024) {
      setNotice(ru ? "Выберите PNG, JPEG или WebP размером до 2 МБ" : "Choose a PNG, JPEG or WebP image up to 2 MB");
      return;
    }
    setUploading(true);
    try {
      const result = await api.uploadImage(kind, await fileToDataUrl(file));
      onChange(result.url);
      setNotice(ru ? "Изображение загружено. Сохраните изменения." : "Image uploaded. Save your changes.");
    } catch (error) {
      setNotice(friendlyError(error, ru ? "ru" : "en"));
    } finally {
      setUploading(false);
    }
  }
  return <div className="image-upload"><span className="image-upload__preview" style={value ? { backgroundImage: `url(${value})` } : undefined}>{!value ? <Upload size={20} /> : null}</span><div className="image-upload__actions"><label className="image-upload__button">{uploading ? <LoaderCircle className="spin" size={16} /> : <Upload size={16} />}{uploading ? (ru ? "Загрузка…" : "Uploading…") : label}<input type="file" accept="image/png,image/jpeg,image/webp" disabled={disabled || uploading} onChange={(event) => { void selectFile(event.target.files?.[0]); event.currentTarget.value = ""; }} /></label>{value && !disabled ? <button type="button" className="image-upload__remove" onClick={() => onChange("")} aria-label={ru ? "Удалить изображение" : "Remove image"}><Trash2 size={16} /></button> : null}</div></div>;
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) { return <label className="settings-toggle"><span>{label}</span><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} /><i aria-hidden="true" /></label>; }
function DangerCard({ title, body, action, onClick }: { title: string; body: string; action: string; onClick: () => void }) { return <div className="settings-card settings-danger"><div><h3><Trash2 size={18} />{title}</h3><p>{body}</p></div><Button variant="secondary" onClick={onClick}><Trash2 size={17} />{action}</Button></div>; }
function Usage({ value, label }: { value: string | number; label: string }) { return <div><strong>{value}</strong><span>{label}</span></div>; }
function timezones() { try { return (Intl as typeof Intl & { supportedValuesOf?: (key: "timeZone") => string[] }).supportedValuesOf?.("timeZone") ?? FALLBACK_TIMEZONES; } catch { return FALLBACK_TIMEZONES; } }
function formatBytes(value: number) { if (value < 1024) return `${value} B`; if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} KB`; if (value < 1024 ** 3) return `${(value / 1024 ** 2).toFixed(1)} MB`; return `${(value / 1024 ** 3).toFixed(1)} GB`; }
function browserName(userAgent: string | null) { if (!userAgent) return "Browser session"; if (userAgent.includes("Edg/")) return "Microsoft Edge"; if (userAgent.includes("Chrome/")) return "Google Chrome"; if (userAgent.includes("Firefox/")) return "Mozilla Firefox"; if (userAgent.includes("Safari/")) return "Safari"; return "Browser session"; }
function downloadJson(data: unknown, name: string) { const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })); const anchor = document.createElement("a"); anchor.href = url; anchor.download = name; anchor.click(); URL.revokeObjectURL(url); }
function fileToDataUrl(file: File): Promise<string> { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(reader.error ?? new Error("File read failed")); reader.readAsDataURL(file); }); }
