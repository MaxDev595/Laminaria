"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowLeft,
  CalendarCheck,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Copy,
  ExternalLink,
  LoaderCircle,
  LockKeyhole,
  Radio,
  Save,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import { Link, useRouter } from "@/i18n/navigation";
import { api, friendlyError } from "@/lib/api";
import { localTimezone, slugify } from "@/lib/text";
import { Button } from "@laminaria/ui";
import { useDashboard } from "./dashboard-context";
import { Field, Input, Textarea } from "./ui";
import { StyledSelect } from "./styled-select";

const schema = z.object({
  title: z.string().trim().min(3).max(180),
  slug: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .min(3)
    .max(100),
  description: z.string().max(10_000),
  scheduledStartAt: z.string(),
  language: z.enum(["en", "ru"]),
  visibility: z.enum(["PUBLIC", "PRIVATE"]),
  allowGuests: z.boolean(),
  requireEmailRegistration: z.boolean(),
});

type Values = z.infer<typeof schema>;

export function CreateWebinarForm() {
  const t = useTranslations();
  const locale = useLocale() as "en" | "ru";
  const { workspace } = useDashboard();
  const router = useRouter();
  const [error, setError] = useState("");
  const [created, setCreated] = useState<{ title: string; slug: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: "",
      slug: "",
      description: "",
      scheduledStartAt: "",
      language: locale,
      visibility: "PUBLIC",
      allowGuests: false,
      requireEmailRegistration: true,
    },
  });
  const title = useWatch({ control: form.control, name: "title" });
  const slug = useWatch({ control: form.control, name: "slug" });
  const scheduledStartAt = useWatch({ control: form.control, name: "scheduledStartAt" });
  const language = useWatch({ control: form.control, name: "language" });
  const visibility = useWatch({ control: form.control, name: "visibility" });
  const allowGuests = useWatch({ control: form.control, name: "allowGuests" });
  const requireEmailRegistration = useWatch({
    control: form.control,
    name: "requireEmailRegistration",
  });
  const publicUrl = useMemo(() => {
    if (!created || typeof window === "undefined") return "";
    return new URL(`/${locale}/w/${created.slug}`, window.location.origin).toString();
  }, [created, locale]);

  useEffect(() => {
    if (!form.formState.dirtyFields.slug) form.setValue("slug", slugify(title));
  }, [title, form]);

  async function submit(values: Values, schedule: boolean) {
    setError("");
    try {
      const result = await api.createWebinar(workspace.id, {
        ...values,
        coverImageUrl: null,
        scheduledStartAt: values.scheduledStartAt
          ? new Date(values.scheduledStartAt).toISOString()
          : null,
        timezone: localTimezone(),
        maxAttendees: null,
      });
      if (schedule)
        await api.transitionWebinar(
          workspace.id,
          result.webinar.id,
          "SCHEDULED",
          result.webinar.version,
        );
      setCreated({ title: result.webinar.title, slug: result.webinar.slug });
    } catch (reason) {
      setError(friendlyError(reason, locale));
    }
  }

  if (created) {
    async function copyPublicUrl() {
      if (!publicUrl) return;
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    }

    return (
      <motion.div
        className="creation-success"
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        <span>
          <Check size={28} />
        </span>
        <h1>{t("webinar.draftCreated")}</h1>
        <p>{t("webinar.createdBody", { title: created.title })}</p>
        <div className="share-link-card">
          <small>{locale === "ru" ? "\u0421\u0441\u044b\u043b\u043a\u0430 \u0434\u043b\u044f \u0443\u0447\u0430\u0441\u0442\u043d\u0438\u043a\u043e\u0432" : "Participant link"}</small>
          <code>{publicUrl}</code>
          <Button type="button" variant="secondary" onClick={() => void copyPublicUrl()}>
            <Copy size={17} />
            {copied
              ? locale === "ru"
                ? "\u0421\u043a\u043e\u043f\u0438\u0440\u043e\u0432\u0430\u043d\u043e"
                : "Copied"
              : locale === "ru"
                ? "\u0421\u043a\u043e\u043f\u0438\u0440\u043e\u0432\u0430\u0442\u044c"
                : "Copy"}
          </Button>
        </div>
        <div>
          <Link href={`/w/${created.slug}`}>
            <Button>
              {t("webinar.openPage")}
              <ExternalLink size={17} />
            </Button>
          </Link>
          <Button variant="secondary" onClick={() => router.push("/dashboard/upcoming")}>
            {t("nav.upcoming")}
          </Button>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="create-webinar">
      <div className="create-webinar__top">
        <Link href="/dashboard" className="auth-back">
          <ArrowLeft size={16} />
          {t("common.back")}
        </Link>
        <span className="save-state">
          <span />
          {t("webinar.saveState")}
        </span>
      </div>
      <header>
        <span className="section-kicker">
          <Radio size={16} />
          {t("webinar.newRoom")}
        </span>
        <h1>{t("webinar.createTitle")}</h1>
        <p>{t("webinar.createSubtitle")}</p>
      </header>
      <form onSubmit={form.handleSubmit((values) => submit(values, false))}>
        <section className="form-section">
          <div className="form-section__intro">
            <span>01</span>
            <h2>{t("webinar.essentials")}</h2>
            <p>{t("webinar.essentialsBody")}</p>
          </div>
          <div className="form-section__fields">
            <Field label={t("webinar.title")} error={form.formState.errors.title?.message}>
              <Input autoFocus {...form.register("title")} />
            </Field>
            <Field
              label={t("webinar.slug")}
              hint={`laminaria.app/${locale}/w/${slug || "your-webinar"}`}
              error={form.formState.errors.slug?.message}
            >
              <Input {...form.register("slug")} />
            </Field>
            <Field label={t("webinar.description")}>
              <Textarea {...form.register("description")} />
            </Field>
          </div>
        </section>
        <section className="form-section">
          <div className="form-section__intro">
            <span>02</span>
            <h2>{t("webinar.timeAudience")}</h2>
            <p>{t("webinar.timeZone", { timezone: localTimezone() })}</p>
          </div>
          <div className="form-section__fields form-grid">
            <Field label={t("webinar.date")}>
              <input type="hidden" {...form.register("scheduledStartAt")} />
              <DateTimePicker
                locale={locale}
                value={scheduledStartAt}
                onChange={(value) => form.setValue("scheduledStartAt", value, { shouldDirty: true })}
              />
            </Field>
            <Field label={t("webinar.language")}>
              <FancySelect
                value={language}
                options={[
                  { value: "en", label: "English" },
                  { value: "ru", label: "Русский" },
                ]}
                onChange={(value) => form.setValue("language", value, { shouldDirty: true })}
              />
            </Field>
            <Field label={t("webinar.access")}>
              <FancySelect
                value={visibility}
                options={[
                  { value: "PUBLIC", label: t("webinar.public") },
                  { value: "PRIVATE", label: t("webinar.private") },
                ]}
                onChange={(value) => form.setValue("visibility", value, { shouldDirty: true })}
              />
            </Field>
            <ToggleField
              label={t("webinar.guestAccess")}
              icon={<LockKeyhole size={17} />}
              checked={allowGuests}
              onChange={(checked) => form.setValue("allowGuests", checked, { shouldDirty: true })}
            />
            <ToggleField
              label={t("webinar.emailRegistration")}
              icon={<CalendarCheck size={17} />}
              checked={requireEmailRegistration}
              onChange={(checked) =>
                form.setValue("requireEmailRegistration", checked, { shouldDirty: true })
              }
            />
          </div>
        </section>
        <section className="form-section form-section--future">
          <div className="form-section__intro">
            <span>03</span>
            <h2>{t("webinar.roomCapabilities")}</h2>
            <p>{t("webinar.roomCapabilitiesBody")}</p>
          </div>
          <div className="capability-preview">
            <span>
              <Check />
              {t("webinar.chat")}
            </span>
            <span>
              <Check />
              {t("webinar.qa")}
            </span>
            <span>
              <Check />
              {t("webinar.polls")}
            </span>
            <span>
              <Check />
              {t("webinar.reactions")}
            </span>
          </div>
        </section>
        <AnimatePresence>
          {error ? (
            <motion.div
              className="form-alert form-alert--box"
              role="alert"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              {error}
            </motion.div>
          ) : null}
        </AnimatePresence>
        <footer className="create-webinar__footer">
          <Button
            type="submit"
            variant="secondary"
            size="lg"
            disabled={form.formState.isSubmitting}
          >
            {form.formState.isSubmitting ? (
              <LoaderCircle className="spin" size={18} />
            ) : (
              <Save size={18} />
            )}
            {t("webinar.saveDraft")}
          </Button>
          <Button
            type="button"
            size="lg"
            disabled={form.formState.isSubmitting || !scheduledStartAt}
            onClick={form.handleSubmit((values) => submit(values, true))}
          >
            <CalendarCheck size={18} />
            {t("webinar.schedule")}
          </Button>
        </footer>
      </form>
    </div>
  );
}

function DateTimePicker({
  locale,
  value,
  onChange,
}: {
  locale: "en" | "ru";
  value: string;
  onChange: (value: string) => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const selected = parseLocalDateTime(value);
  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(selected ?? new Date()));
  const calendarDays = useMemo(() => calendarGrid(viewMonth), [viewMonth]);
  const hours = String(selected?.getHours() ?? 12).padStart(2, "0");
  const minutes = String(selected ? Math.floor(selected.getMinutes() / 5) * 5 : 0).padStart(2, "0");

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  function updateTime(nextHours: string, nextMinutes: string) {
    const base = selected ?? new Date();
    onChange(formatLocalDateTime(base, Number(nextHours), Number(nextMinutes)));
  }

  function chooseDay(day: Date) {
    onChange(formatLocalDateTime(day, Number(hours), Number(minutes)));
    if (day.getMonth() !== viewMonth.getMonth()) setViewMonth(startOfMonth(day));
  }

  const label = selected
    ? new Intl.DateTimeFormat(locale, {
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(selected)
    : locale === "ru"
      ? "Выберите дату и время"
      : "Choose date and time";

  return (
    <div ref={root} className={`laminaria-calendar ${open ? "is-open" : ""}`}>
      <button type="button" className="laminaria-calendar__trigger" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((current) => !current)}>
        <span>{label}</span>
        <span className="laminaria-calendar__trigger-icon"><CalendarDays size={17} /></span>
      </button>
      <AnimatePresence>
        {open ? (
          <motion.div className="laminaria-calendar__popover" role="dialog" aria-label={locale === "ru" ? "Выбор даты и времени" : "Choose date and time"} initial={{ opacity: 0, y: -8, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: .98 }} transition={{ duration: .18 }}>
            <header>
              <button type="button" onClick={() => setViewMonth(addMonths(viewMonth, -1))} aria-label={locale === "ru" ? "Предыдущий месяц" : "Previous month"}><ChevronLeft size={17} /></button>
              <strong>{viewMonth.toLocaleDateString(locale, { month: "long", year: "numeric" })}</strong>
              <button type="button" onClick={() => setViewMonth(addMonths(viewMonth, 1))} aria-label={locale === "ru" ? "Следующий месяц" : "Next month"}><ChevronRight size={17} /></button>
            </header>
            <div className="laminaria-calendar__weekdays">{(locale === "ru" ? ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"] : ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"]).map((day) => <span key={day}>{day}</span>)}</div>
            <div className="laminaria-calendar__days">
              {calendarDays.map((day) => {
                const active = selected ? sameDay(day, selected) : false;
                const today = sameDay(day, new Date());
                return <button key={day.toISOString()} type="button" className={`${day.getMonth() !== viewMonth.getMonth() ? "is-outside" : ""} ${active ? "is-selected" : ""} ${today ? "is-today" : ""}`} onClick={() => chooseDay(day)}><span>{day.getDate()}</span></button>;
              })}
            </div>
            <div className="laminaria-calendar__time">
              <span><Clock3 size={16} />{locale === "ru" ? "Время" : "Time"}</span>
              <div>
                <StyledSelect className="styled-select--compact styled-select--up" value={hours} ariaLabel={locale === "ru" ? "Часы" : "Hours"} options={Array.from({ length: 24 }, (_, index) => { const item = String(index).padStart(2, "0"); return { value: item, label: item }; })} onChange={(next) => updateTime(next, minutes)} />
                <i>:</i>
                <StyledSelect className="styled-select--compact styled-select--up" value={minutes} ariaLabel={locale === "ru" ? "Минуты" : "Minutes"} options={Array.from({ length: 12 }, (_, index) => { const item = String(index * 5).padStart(2, "0"); return { value: item, label: item }; })} onChange={(next) => updateTime(hours, next)} />
              </div>
            </div>
            <footer>
              <button type="button" onClick={() => { onChange(""); setOpen(false); }}>{locale === "ru" ? "Очистить" : "Clear"}</button>
              <button type="button" className="is-primary" onClick={() => { const next = new Date(Date.now() + 60 * 60 * 1000); next.setMinutes(Math.ceil(next.getMinutes() / 5) * 5, 0, 0); onChange(formatLocalDateTime(next, next.getHours(), next.getMinutes())); setViewMonth(startOfMonth(next)); }}>{locale === "ru" ? "Через час" : "In one hour"}</button>
              <button type="button" className="is-done" onClick={() => setOpen(false)}>{locale === "ru" ? "Готово" : "Done"}</button>
            </footer>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function parseLocalDateTime(value: string): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatLocalDateTime(date: Date, hours: number, minutes: number): string {
  const next = new Date(date);
  next.setHours(hours, minutes, 0, 0);
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${next.getFullYear()}-${pad(next.getMonth() + 1)}-${pad(next.getDate())}T${pad(next.getHours())}:${pad(next.getMinutes())}`;
}

function startOfMonth(date: Date): Date { return new Date(date.getFullYear(), date.getMonth(), 1); }
function addMonths(date: Date, amount: number): Date { return new Date(date.getFullYear(), date.getMonth() + amount, 1); }
function sameDay(left: Date, right: Date): boolean { return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth() && left.getDate() === right.getDate(); }
function calendarGrid(month: Date): Date[] { const first = startOfMonth(month); const mondayOffset = (first.getDay() + 6) % 7; const start = new Date(first.getFullYear(), first.getMonth(), 1 - mondayOffset); return Array.from({ length: 42 }, (_, index) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + index)); }

function FancySelect<TValue extends string>({
  value,
  options,
  onChange,
}: {
  value: TValue;
  options: Array<{ value: TValue; label: string }>;
  onChange: (value: TValue) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value) ?? options[0];

  return (
    <div
      className="fancy-select"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <button
        type="button"
        className="fancy-select__button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span>{selected?.label}</span>
        <ChevronDown size={17} />
      </button>
      <AnimatePresence>
        {open ? (
          <motion.div
            className="fancy-select__menu"
            role="listbox"
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          >
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={option.value === value}
                className={option.value === value ? "is-active" : ""}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
              >
                {option.label}
                {option.value === value ? <Check size={15} /> : null}
              </button>
            ))}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function ToggleField({
  label,
  icon,
  checked,
  onChange,
}: {
  label: string;
  icon: React.ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="toggle-field">
      <span>
        {icon}
        {label}
      </span>
      <input
        className="lm-sr-only"
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className={`toggle ${checked ? "is-on" : ""}`} aria-hidden="true">
        <i />
      </span>
    </label>
  );
}
