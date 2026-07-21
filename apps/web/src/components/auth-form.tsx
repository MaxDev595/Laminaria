"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  LoaderCircle,
  Mail,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Link, useRouter } from "@/i18n/navigation";
import { api, friendlyError, type AuthPayload, type AuthProvidersPayload } from "@/lib/api";
import { Button, Field, Input } from "./ui";

type AuthMode = "sign-in" | "sign-up" | "forgot" | "reset";

const schema = z.object({
  name: z.string().trim().max(100).optional(),
  email: z.email().optional().or(z.literal("")),
  password: z.string().optional(),
});

type Values = z.infer<typeof schema>;

export function AuthForm({ mode, token }: { mode: AuthMode; token?: string }) {
  const t = useTranslations();
  const locale = useLocale() as "en" | "ru";
  const router = useRouter();
  const queryClient = useQueryClient();
  const [visible, setVisible] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [providers, setProviders] = useState<AuthProvidersPayload | null>(null);
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", email: "", password: "" },
  });

  const isSignUp = mode === "sign-up";
  const isForgot = mode === "forgot";
  const isReset = mode === "reset";
  const isSignIn = mode === "sign-in";
  const title = isSignUp
    ? t("auth.signUp")
    : isForgot || isReset
      ? t("auth.resetPassword")
      : t("auth.signIn");
  const subtitle = isSignUp
    ? locale === "ru"
      ? "Создайте аккаунт через email или Google."
      : "Create your account with email or Google."
    : isForgot
      ? locale === "ru"
        ? "Мы отправим защищённую ссылку, если аккаунт существует."
        : "We will send a secure link if the account exists."
      : isReset
        ? locale === "ru"
          ? "Придумайте новый пароль длиной не менее 12 символов."
          : "Choose a new password with at least 12 characters."
        : locale === "ru"
          ? "Войдите через email или Google."
          : "Sign in with email or Google.";

  useEffect(() => {
    let active = true;
    api
      .authProviders()
      .then((value) => {
        if (active) setProviders(value);
      })
      .catch(() => {
        if (active) setProviders(null);
      });

    if (mode === "sign-in") {
      api
        .me()
        .then((payload) => {
          if (!active) return;
          queryClient.setQueryData(["me"], payload);
          router.replace("/dashboard");
        })
        .catch(() => undefined);
    }

    return () => {
      active = false;
    };
  }, [mode, queryClient, router]);

  function rememberAuthenticated(payload: AuthPayload) {
    queryClient.setQueryData(["me"], payload);
    void queryClient.invalidateQueries({ queryKey: ["workspaces"] });
  }

  async function submit(values: Values) {
    setServerError(null);
    try {
      if (mode === "sign-up") {
        if (!values.name || !values.email || !values.password || values.password.length < 12) {
          throw new Error(
            locale === "ru"
              ? "Укажите имя, email и пароль от 12 символов."
              : "Enter your name, email, and a password of at least 12 characters.",
          );
        }
        const result = await api.signUp({
          name: values.name,
          email: values.email,
          password: values.password,
          locale,
        });
        if (result.verificationRequired) {
          router.push("/verify-email?sent=1");
          return;
        }
        rememberAuthenticated(await api.signIn({ email: values.email, password: values.password }));
        router.replace("/dashboard");
      } else if (mode === "sign-in") {
        if (!values.email || !values.password) {
          throw new Error(
            locale === "ru" ? "Введите email и пароль." : "Enter your email and password.",
          );
        }
        rememberAuthenticated(await api.signIn({ email: values.email, password: values.password }));
        router.replace("/dashboard");
      } else if (mode === "forgot") {
        if (!values.email)
          throw new Error(locale === "ru" ? "Введите email." : "Enter your email.");
        await api.forgotPassword(values.email);
        setSuccess(true);
      } else {
        if (!token)
          throw new Error(
            locale === "ru"
              ? "Ссылка восстановления недействительна."
              : "The reset link is invalid.",
          );
        if (!values.password || values.password.length < 12) {
          throw new Error(
            locale === "ru"
              ? "Пароль должен содержать минимум 12 символов."
              : "Use at least 12 characters.",
          );
        }
        await api.resetPassword(token, values.password);
        queryClient.clear();
        setSuccess(true);
      }
    } catch (error) {
      setServerError(
        error instanceof Error && !("code" in error) ? error.message : friendlyError(error, locale),
      );
    }
  }

  function startGoogle() {
    if (!providers?.google.enabled) {
      setServerError(
        locale === "ru"
          ? "Google-вход добавлен, но нужны GOOGLE_CLIENT_ID и GOOGLE_CLIENT_SECRET в .env."
          : "Google sign-in is wired, but GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are required in .env.",
      );
      return;
    }
    window.location.href = api.googleStartUrl(locale);
  }

  if (success) {
    return (
      <motion.div
        className="auth-success"
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        <span>
          <CheckCircle2 size={28} />
        </span>
        <h1>
          {isForgot
            ? locale === "ru"
              ? "Проверьте почту"
              : "Check your inbox"
            : locale === "ru"
              ? "Пароль обновлён"
              : "Password updated"}
        </h1>
        <p>
          {isForgot
            ? locale === "ru"
              ? "Если адрес зарегистрирован, письмо уже отправлено."
              : "If the address is registered, the message is on its way."
            : locale === "ru"
              ? "Теперь можно войти с новым паролем."
              : "You can now sign in with your new password."}
        </p>
        <Link href="/sign-in">
          <Button>
            {t("auth.signIn")}
            <ArrowRight size={17} />
          </Button>
        </Link>
      </motion.div>
    );
  }

  return (
    <motion.div
      className="auth-form-wrap"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="auth-heading">
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>

      {isSignIn || isSignUp ? (
        <button type="button" className="google-auth-button" onClick={startGoogle}>
          <span><Image src="/google-logo.png" alt="" width={24} height={24} priority /></span>
          {locale === "ru" ? "Продолжить через Google" : "Continue with Google"}
        </button>
      ) : null}

      <form className="auth-form" onSubmit={form.handleSubmit(submit)} noValidate>
        {isSignUp ? (
          <Field label={t("auth.name")} error={form.formState.errors.name?.message}>
            <Input autoComplete="name" {...form.register("name")} />
          </Field>
        ) : null}

        {!isReset ? (
          <Field label={t("auth.email")} error={form.formState.errors.email?.message}>
            <Input
              type="email"
              autoComplete="email"
              inputMode="email"
              {...form.register("email")}
            />
          </Field>
        ) : null}

        {!isForgot ? (
          <Field
            label={t("auth.password")}
            hint={
              isSignUp || isReset
                ? locale === "ru"
                  ? "Минимум 12 символов"
                  : "At least 12 characters"
                : undefined
            }
          >
            <div className="password-field">
              <Input
                type={visible ? "text" : "password"}
                autoComplete={isSignUp || isReset ? "new-password" : "current-password"}
                {...form.register("password")}
              />
              <button
                type="button"
                onClick={() => setVisible((value) => !value)}
                aria-label={
                  visible
                    ? locale === "ru"
                      ? "Скрыть пароль"
                      : "Hide password"
                    : locale === "ru"
                      ? "Показать пароль"
                      : "Show password"
                }
              >
                {visible ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </Field>
        ) : null}

        {isSignIn ? (
          <Link href="/forgot-password" className="form-link">
            {t("auth.forgotPassword")}
          </Link>
        ) : null}

        <AnimatePresence>
          {serverError ? (
            <motion.div
              className="form-alert"
              role="alert"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
            >
              <AlertCircle size={17} />
              {serverError}
            </motion.div>
          ) : null}
        </AnimatePresence>

        <Button type="submit" size="lg" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? (
            <LoaderCircle className="spin" size={18} />
          ) : isForgot ? (
            <Mail size={18} />
          ) : null}
          {isSignUp
            ? t("auth.signUp")
            : isForgot
              ? locale === "ru"
                ? "Отправить ссылку"
                : "Send reset link"
              : isReset
                ? t("auth.resetPassword")
                : t("auth.signIn")}
          {!form.formState.isSubmitting && !isForgot ? <ArrowRight size={18} /> : null}
        </Button>
      </form>

      <p className="auth-alternate">
        {isSignUp ? t("auth.haveAccount") : t("auth.noAccount")}{" "}
        <Link href={isSignUp ? "/sign-in" : "/sign-up"}>
          {isSignUp ? t("auth.signIn") : t("auth.signUp")}
        </Link>
      </p>
    </motion.div>
  );
}
