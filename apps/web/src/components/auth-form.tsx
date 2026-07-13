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
  MessageSquareText,
  Smartphone,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Link, useRouter } from "@/i18n/navigation";
import { api, friendlyError, type AuthPayload, type AuthProvidersPayload } from "@/lib/api";
import { Button, Field, Input } from "./ui";

type AuthMode = "sign-in" | "sign-up" | "forgot" | "reset";
type SignInMethod = "email" | "phone";

const schema = z.object({
  name: z.string().trim().max(100).optional(),
  email: z.email().optional().or(z.literal("")),
  phone: z.string().trim().max(32).optional(),
  code: z.string().trim().max(6).optional(),
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
  const [method, setMethod] = useState<SignInMethod>("email");
  const [phoneCodeSent, setPhoneCodeSent] = useState(false);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [providers, setProviders] = useState<AuthProvidersPayload | null>(null);
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", email: "", phone: "", code: "", password: "" },
  });

  const isSignUp = mode === "sign-up";
  const isForgot = mode === "forgot";
  const isReset = mode === "reset";
  const isSignIn = mode === "sign-in";
  const canUsePhoneAuth = isSignIn || isSignUp;
  const title = isSignUp ? t("auth.signUp") : isForgot || isReset ? t("auth.resetPassword") : t("auth.signIn");
  const subtitle = isSignUp
    ? locale === "ru"
      ? "Создайте защищённый аккаунт и первое рабочее пространство."
      : "Create your secure account and first workspace."
    : isForgot
      ? locale === "ru"
        ? "Мы отправим защищённую ссылку, если аккаунт существует."
        : "We will send a secure link if the account exists."
      : isReset
        ? locale === "ru"
          ? "Придумайте новый пароль длиной не менее 12 символов."
          : "Choose a new password with at least 12 characters."
        : locale === "ru"
          ? "Вернитесь в своё рабочее пространство."
          : "Return to your workspace.";

  useEffect(() => {
    let active = true;
    api.authProviders()
      .then((value) => {
        if (active) setProviders(value);
      })
      .catch(() => {
        if (active) setProviders(null);
      });

    if (mode === "sign-in") {
      api.me()
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
        if (method === "phone") {
          const phone = values.phone?.trim();
          if (!values.name) throw new Error(locale === "ru" ? "Введите имя." : "Enter your name.");
          if (!phone) throw new Error(locale === "ru" ? "Введите номер телефона." : "Enter your phone number.");
          if (!phoneCodeSent) {
            const result = await api.phoneStart({ phone, locale });
            setDevCode(result.devCode);
            setPhoneCodeSent(true);
            return;
          }
          if (!values.code || values.code.length !== 6) {
            throw new Error(locale === "ru" ? "Введите 6-значный код." : "Enter the 6-digit code.");
          }
          rememberAuthenticated(await api.phoneVerify({ phone, code: values.code, name: values.name, locale }));
          router.replace("/dashboard");
          return;
        }
        if (!values.name || !values.email || !values.password || values.password.length < 12) {
          throw new Error(locale === "ru" ? "Укажите имя, email и пароль от 12 символов." : "Enter your name, email, and a password of at least 12 characters.");
        }
        const result = await api.signUp({ name: values.name, email: values.email, password: values.password, locale });
        if (result.verificationRequired) {
          router.push("/verify-email?sent=1");
          return;
        }
        rememberAuthenticated(await api.signIn({ email: values.email, password: values.password }));
        router.replace("/dashboard");
      } else if (mode === "sign-in") {
        if (method === "phone") {
          const phone = values.phone?.trim();
          if (!phone) throw new Error(locale === "ru" ? "Введите номер телефона." : "Enter your phone number.");
          if (!phoneCodeSent) {
            const result = await api.phoneStart({ phone, locale });
            setDevCode(result.devCode);
            setPhoneCodeSent(true);
            return;
          }
          if (!values.code || values.code.length !== 6) {
            throw new Error(locale === "ru" ? "Введите 6-значный код." : "Enter the 6-digit code.");
          }
          rememberAuthenticated(await api.phoneVerify({ phone, code: values.code, name: values.name, locale }));
          router.replace("/dashboard");
          return;
        }
        if (!values.email || !values.password) {
          throw new Error(locale === "ru" ? "Введите email и пароль." : "Enter your email and password.");
        }
        rememberAuthenticated(await api.signIn({ email: values.email, password: values.password }));
        router.replace("/dashboard");
      } else if (mode === "forgot") {
        if (!values.email) throw new Error(locale === "ru" ? "Введите email." : "Enter your email.");
        await api.forgotPassword(values.email);
        setSuccess(true);
      } else {
        if (!token) throw new Error(locale === "ru" ? "Ссылка восстановления недействительна." : "The reset link is invalid.");
        if (!values.password || values.password.length < 12) {
          throw new Error(locale === "ru" ? "Пароль должен содержать минимум 12 символов." : "Use at least 12 characters.");
        }
        await api.resetPassword(token, values.password);
        queryClient.clear();
        setSuccess(true);
      }
    } catch (error) {
      setServerError(error instanceof Error && !("code" in error) ? error.message : friendlyError(error, locale));
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
      <motion.div className="auth-success" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}>
        <span>
          <CheckCircle2 size={28} />
        </span>
        <h1>{isForgot ? (locale === "ru" ? "Проверьте почту" : "Check your inbox") : (locale === "ru" ? "Пароль обновлён" : "Password updated")}</h1>
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
    <motion.div className="auth-form-wrap" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <div className="auth-heading">
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>

      {canUsePhoneAuth ? (
        <>
          <div className="auth-method-tabs" role="tablist" aria-label={locale === "ru" ? "Способ входа" : "Sign-in method"}>
            <button type="button" role="tab" aria-selected={method === "email"} onClick={() => setMethod("email")}>
              <Mail size={16} />
              Email
            </button>
            <button type="button" role="tab" aria-selected={method === "phone"} onClick={() => setMethod("phone")}>
              <Smartphone size={16} />
              {locale === "ru" ? "Телефон" : "Phone"}
            </button>
          </div>
          {isSignIn ? <button type="button" className="google-auth-button" onClick={startGoogle}>
            <span>G</span>
            {locale === "ru" ? "Войти через Google" : "Continue with Google"}
          </button> : null}
        </>
      ) : null}

      <form className="auth-form" onSubmit={form.handleSubmit(submit)} noValidate>
        {isSignUp ? (
          <Field label={t("auth.name")} error={form.formState.errors.name?.message}>
            <Input autoComplete="name" {...form.register("name")} />
          </Field>
        ) : null}

        {canUsePhoneAuth && method === "phone" ? (
          <>
            <Field
              label={locale === "ru" ? "Номер телефона" : "Phone number"}
              hint={locale === "ru" ? "Для локальной разработки код: 000000" : "For local development, use code: 000000"}
            >
              <Input type="tel" autoComplete="tel" inputMode="tel" placeholder="+7 777 000 00 00" {...form.register("phone")} />
            </Field>
            {phoneCodeSent ? (
              <Field label={locale === "ru" ? "Код из SMS" : "SMS code"} hint={devCode ? `${locale === "ru" ? "Dev-код" : "Dev code"}: ${devCode}` : undefined}>
                <Input inputMode="numeric" maxLength={6} placeholder="000000" {...form.register("code")} />
              </Field>
            ) : null}
          </>
        ) : !isReset ? (
          <Field label={t("auth.email")} error={form.formState.errors.email?.message}>
            <Input type="email" autoComplete="email" inputMode="email" {...form.register("email")} />
          </Field>
        ) : null}

        {!isForgot && !(canUsePhoneAuth && method === "phone") ? (
          <Field label={t("auth.password")} hint={isSignUp || isReset ? (locale === "ru" ? "Минимум 12 символов" : "At least 12 characters") : undefined}>
            <div className="password-field">
              <Input type={visible ? "text" : "password"} autoComplete={isSignUp ? "new-password" : "current-password"} {...form.register("password")} />
              <button
                type="button"
                onClick={() => setVisible((value) => !value)}
                aria-label={visible ? (locale === "ru" ? "Скрыть пароль" : "Hide password") : (locale === "ru" ? "Показать пароль" : "Show password")}
              >
                {visible ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </Field>
        ) : null}

        {isSignIn && method === "phone" && phoneCodeSent ? (
          <Field
            label={locale === "ru" ? "Имя в аккаунте" : "Account name"}
            hint={locale === "ru" ? "Нужно только при первом входе по телефону" : "Only needed the first time you use phone sign-in"}
          >
            <Input autoComplete="name" {...form.register("name")} />
          </Field>
        ) : null}

        {mode === "sign-in" && method === "email" ? (
          <Link href="/forgot-password" className="form-link">
            {t("auth.forgotPassword")}
          </Link>
        ) : null}

        <AnimatePresence>
          {serverError ? (
            <motion.div className="form-alert" role="alert" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
              <AlertCircle size={17} />
              {serverError}
            </motion.div>
          ) : null}
        </AnimatePresence>

        <Button type="submit" size="lg" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? <LoaderCircle className="spin" size={18} /> : isForgot ? <Mail size={18} /> : isSignIn && method === "phone" ? <MessageSquareText size={18} /> : null}
          {isSignUp
            ? t("auth.signUp")
            : isForgot
              ? locale === "ru"
                ? "Отправить ссылку"
                : "Send reset link"
              : isReset
                ? t("auth.resetPassword")
                : isSignIn && method === "phone" && !phoneCodeSent
                  ? locale === "ru"
                    ? "Получить код"
                    : "Get code"
                  : t("auth.signIn")}
          {!form.formState.isSubmitting && !isForgot ? <ArrowRight size={18} /> : null}
        </Button>
      </form>

      <p className="auth-alternate">
        {isSignUp ? t("auth.haveAccount") : t("auth.noAccount")}{" "}
        <Link href={isSignUp ? "/sign-in" : "/sign-up"}>{isSignUp ? t("auth.signIn") : t("auth.signUp")}</Link>
      </p>
    </motion.div>
  );
}

