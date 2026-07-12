"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Building2, LoaderCircle } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { api, friendlyError } from "@/lib/api";
import { slugify } from "@/lib/text";
import { useRouter } from "@/i18n/navigation";
import { Button, Field, Input } from "./ui";

const schema = z.object({ name: z.string().trim().min(2).max(100), slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).min(3).max(63) });
type Values = z.infer<typeof schema>;

export function OnboardingForm() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const [error, setError] = useState("");
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { name: "", slug: "" } });
  const name = useWatch({ control: form.control, name: "name" });
  const slug = useWatch({ control: form.control, name: "slug" });

  useEffect(() => {
    if (!form.formState.dirtyFields.slug) form.setValue("slug", slugify(name));
  }, [name, form]);

  async function submit(values: Values) {
    setError("");
    try { await api.createWorkspace(values); router.replace("/dashboard"); }
    catch (reason) { setError(friendlyError(reason, locale)); }
  }

  return <div className="auth-form-wrap"><div className="auth-heading"><span className="onboarding-icon"><Building2 size={22} /></span><h1>{t("auth.workspaceTitle")}</h1><p>{t("auth.workspaceHint")}</p></div><form className="auth-form" onSubmit={form.handleSubmit(submit)}><Field label={locale === "ru" ? "Название" : "Workspace name"} error={form.formState.errors.name?.message}><Input autoFocus {...form.register("name")} /></Field><Field label={locale === "ru" ? "Адрес пространства" : "Workspace address"} hint={`laminaria.app/w/${slug || "your-workspace"}`} error={form.formState.errors.slug?.message}><Input {...form.register("slug")} /></Field>{error ? <div className="form-alert" role="alert">{error}</div> : null}<Button type="submit" size="lg" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting ? <LoaderCircle className="spin" size={18} /> : null}{locale === "ru" ? "Создать пространство" : "Create workspace"}<ArrowRight size={18} /></Button></form></div>;
}
