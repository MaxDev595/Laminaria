"use client";

import { ArrowRight, CheckCircle2, LoaderCircle, XCircle } from "lucide-react";
import { useLocale } from "next-intl";
import { useEffect, useState } from "react";

import { Link, useRouter } from "@/i18n/navigation";
import { api, friendlyError } from "@/lib/api";
import { Button } from "@laminaria/ui";

export function RegistrationConfirmation({ slug, token }: { slug: string; token?: string }) {
  const locale = useLocale();
  const router = useRouter();
  const [state, setState] = useState<"loading" | "success" | "error">(token ? "loading" : "error");
  const [error, setError] = useState(
    token ? "" : locale === "ru" ? "В ссылке нет токена подтверждения." : "The confirmation token is missing.",
  );

  useEffect(() => {
    if (!token) return;
    api.confirmRegistration(token)
      .then((result) => {
        sessionStorage.setItem(`laminaria-access:${slug}`, result.accessToken);
        setState("success");
        window.setTimeout(() => router.replace(`/w/${slug}/waiting`), 650);
      })
      .catch((reason) => {
        setError(friendlyError(reason, locale));
        setState("error");
      });
  }, [token, slug, locale, router]);

  const title =
    state === "loading"
      ? locale === "ru" ? "Подтверждаем регистрацию" : "Confirming registration"
      : state === "success"
        ? locale === "ru" ? "Регистрация подтверждена" : "Registration confirmed"
        : locale === "ru" ? "Не удалось подтвердить" : "Confirmation failed";

  const body =
    state === "loading"
      ? locale === "ru" ? "Проверяем защищённую ссылку…" : "Checking the secure link…"
      : state === "success"
        ? locale === "ru" ? "Пропуск сохранён. Открываем страницу ожидания." : "Your access pass is saved. Opening the waiting room."
        : error;

  return (
    <main className="confirmation-page">
      <div className={`confirmation-card confirmation-card--${state}`}>
        <span>{state === "loading" ? <LoaderCircle className="spin" /> : state === "success" ? <CheckCircle2 /> : <XCircle />}</span>
        <h1>{title}</h1>
        <p>{body}</p>
        {state === "success" ? (
          <Link href={`/w/${slug}/waiting`}>
            <Button>{locale === "ru" ? "Открыть ожидание" : "Open waiting room"}<ArrowRight size={17} /></Button>
          </Link>
        ) : state === "error" ? (
          <Link href={`/w/${slug}`}>
            <Button variant="secondary">{locale === "ru" ? "Вернуться к вебинару" : "Return to webinar"}</Button>
          </Link>
        ) : null}
      </div>
    </main>
  );
}
