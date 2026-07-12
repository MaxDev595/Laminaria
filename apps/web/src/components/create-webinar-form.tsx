"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, CalendarCheck, Check, LoaderCircle, LockKeyhole, Radio, Save, Sparkles } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import { Link, useRouter } from "@/i18n/navigation";
import { api, friendlyError } from "@/lib/api";
import { localTimezone, slugify } from "@/lib/text";
import { Button } from "@laminaria/ui";
import { useDashboard } from "./dashboard-context";
import { Field, Input, Select, Textarea } from "./ui";

const schema = z.object({
  title: z.string().trim().min(3).max(180),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).min(3).max(100),
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
  const allowGuests = useWatch({ control: form.control, name: "allowGuests" });
  const requireEmailRegistration = useWatch({ control: form.control, name: "requireEmailRegistration" });

  useEffect(() => {
    if (!form.formState.dirtyFields.slug) form.setValue("slug", slugify(title));
  }, [title, form]);

  async function submit(values: Values, schedule: boolean) {
    setError("");
    try {
      const result = await api.createWebinar(workspace.id, {
        ...values,
        scheduledStartAt: values.scheduledStartAt ? new Date(values.scheduledStartAt).toISOString() : null,
        timezone: localTimezone(),
        maxAttendees: null,
      });
      if (schedule) await api.transitionWebinar(workspace.id, result.webinar.id, "SCHEDULED", result.webinar.version);
      setCreated({ title: result.webinar.title, slug: result.webinar.slug });
    } catch (reason) {
      setError(friendlyError(reason, locale));
    }
  }

  if (created) {
    return (
      <motion.div className="creation-success" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}>
        <span><Check size={28} /></span>
        <h1>{t("webinar.draftCreated")}</h1>
        <p>{t("webinar.createdBody", { title: created.title })}</p>
        <div>
          <Link href={`/w/${created.slug}`}><Button>{t("webinar.openPage")}</Button></Link>
          <Button variant="secondary" onClick={() => router.push("/dashboard/drafts")}>{t("nav.drafts")}</Button>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="create-webinar">
      <div className="create-webinar__top">
        <Link href="/dashboard" className="auth-back"><ArrowLeft size={16} />{t("common.back")}</Link>
        <span className="save-state"><span />{t("webinar.saveState")}</span>
      </div>
      <header>
        <span className="section-kicker"><Radio size={16} />{t("webinar.newRoom")}</span>
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
            <Field label={t("webinar.title")} error={form.formState.errors.title?.message}><Input autoFocus {...form.register("title")} /></Field>
            <Field label={t("webinar.slug")} hint={`laminaria.app/${locale}/w/${slug || "your-webinar"}`} error={form.formState.errors.slug?.message}><Input {...form.register("slug")} /></Field>
            <Field label={t("webinar.description")}><Textarea {...form.register("description")} /></Field>
          </div>
        </section>
        <section className="form-section">
          <div className="form-section__intro">
            <span>02</span>
            <h2>{t("webinar.timeAudience")}</h2>
            <p>{t("webinar.timeZone", { timezone: localTimezone() })}</p>
          </div>
          <div className="form-section__fields form-grid">
            <Field label={t("webinar.date")}><Input type="datetime-local" {...form.register("scheduledStartAt")} /></Field>
            <Field label={t("webinar.language")}>
              <Select {...form.register("language")}>
                <option value="en">English</option>
                <option value="ru">Русский</option>
              </Select>
            </Field>
            <Field label={t("webinar.access")}>
              <Select {...form.register("visibility")}>
                <option value="PUBLIC">{t("webinar.public")}</option>
                <option value="PRIVATE">{t("webinar.private")}</option>
              </Select>
            </Field>
            <ToggleField label={t("webinar.guestAccess")} icon={<LockKeyhole size={17} />} checked={allowGuests} onChange={(checked) => form.setValue("allowGuests", checked, { shouldDirty: true })} />
            <ToggleField label={t("webinar.emailRegistration")} icon={<CalendarCheck size={17} />} checked={requireEmailRegistration} onChange={(checked) => form.setValue("requireEmailRegistration", checked, { shouldDirty: true })} />
          </div>
        </section>
        <section className="form-section form-section--future">
          <div className="form-section__intro">
            <span>03</span>
            <h2>{t("webinar.roomCapabilities")}</h2>
            <p>{t("webinar.roomCapabilitiesBody")}</p>
          </div>
          <div className="capability-preview">
            <span><Check />{t("webinar.chat")}</span>
            <span><Check />{t("webinar.qa")}</span>
            <span><Check />{t("webinar.polls")}</span>
            <span><Check />{t("webinar.reactions")}</span>
            <span className="is-pending"><Sparkles />{t("webinar.aiModeration")} · {t("common.notConfigured")}</span>
          </div>
        </section>
        <AnimatePresence>{error ? <motion.div className="form-alert form-alert--box" role="alert" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>{error}</motion.div> : null}</AnimatePresence>
        <footer className="create-webinar__footer">
          <Button type="submit" variant="secondary" size="lg" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? <LoaderCircle className="spin" size={18} /> : <Save size={18} />}
            {t("webinar.saveDraft")}
          </Button>
          <Button type="button" size="lg" disabled={form.formState.isSubmitting || !scheduledStartAt} onClick={form.handleSubmit((values) => submit(values, true))}>
            <CalendarCheck size={18} />
            {t("webinar.schedule")}
          </Button>
        </footer>
      </form>
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
      <span>{icon}{label}</span>
      <input className="lm-sr-only" type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span className={`toggle ${checked ? "is-on" : ""}`} aria-hidden="true"><i /></span>
    </label>
  );
}
