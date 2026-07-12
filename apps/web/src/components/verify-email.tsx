"use client";

import { CheckCircle2, LoaderCircle, MailCheck, XCircle } from "lucide-react";
import { motion } from "motion/react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { api, friendlyError } from "@/lib/api";
import { Link } from "@/i18n/navigation";
import { Button } from "@laminaria/ui";

export function VerifyEmail({ token, sent }: { token?: string; sent?: boolean }) {
  const locale = useLocale();
  const t = useTranslations();
  const [state, setState] = useState<"waiting" | "verifying" | "success" | "error">(token ? "verifying" : "waiting");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) return;
    api.verifyEmail(token).then(() => setState("success")).catch((reason) => {
      setError(friendlyError(reason, locale));
      setState("error");
    });
  }, [token, locale]);

  const icon = state === "verifying" ? <LoaderCircle className="spin" /> : state === "success" ? <CheckCircle2 /> : state === "error" ? <XCircle /> : <MailCheck />;
  const title = state === "success" ? (locale === "ru" ? "Почта подтверждена" : "Email verified") : state === "error" ? (locale === "ru" ? "Ссылка не сработала" : "The link did not work") : t("auth.verifyTitle");
  const body = state === "verifying" ? (locale === "ru" ? "Проверяем защищённую ссылку…" : "Checking the secure link…") : state === "success" ? (locale === "ru" ? "Теперь создадим рабочее пространство." : "Now let’s create your workspace.") : state === "error" ? error : sent ? t("auth.verifyBody") : t("auth.verifyBody");

  return (
    <motion.div className={`auth-success auth-success--${state}`} initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}>
      <span>{icon}</span><h1>{title}</h1><p>{body}</p>
      {state === "success" ? <Link href="/onboarding"><Button>{locale === "ru" ? "Создать пространство" : "Create workspace"}</Button></Link> : state === "error" ? <Link href="/sign-in"><Button variant="secondary">{t("auth.signIn")}</Button></Link> : null}
    </motion.div>
  );
}
