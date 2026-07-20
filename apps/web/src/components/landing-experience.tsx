"use client";

import {
  ArrowUpRight,
  BarChart3,
  Bot,
  Captions,
  ChartNoAxesCombined,
  Check,
  ChevronDown,
  CircleGauge,
  Clapperboard,
  Copy,
  FileQuestion,
  Globe2,
  LockKeyhole,
  MessageCircleMore,
  Mic2,
  MonitorUp,
  Palette,
  Radio,
  Send,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Star,
  TriangleAlert,
  UsersRound,
  Video,
  Waves,
  X,
} from "lucide-react";
import { AnimatePresence, motion, useScroll, useSpring } from "motion/react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Link } from "@/i18n/navigation";
import { Badge, Button, Logo } from "@laminaria/ui";
import { MarketingHeader } from "./marketing-header";

const reveal = {
  hidden: { opacity: 0, y: 22 },
  visible: { opacity: 1, y: 0 },
};

export function LandingExperience() {
  const t = useTranslations();
  const locale = useLocale();
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 160, damping: 30, restDelta: 0.001 });

  return (
    <div className="marketing-shell">
      <motion.div className="scroll-progress" style={{ scaleX }} aria-hidden="true" />
      <MarketingHeader />
      <main>
        <section className="hero" id="product">
          <div className="ambient ambient--one" aria-hidden="true" />
          <div className="ambient ambient--two" aria-hidden="true" />
          <motion.div
            className="hero__copy"
            initial="hidden"
            animate="visible"
            transition={{ staggerChildren: 0.08, delayChildren: 0.08 }}
          >
            <motion.div variants={reveal}>
              <Badge tone="primary">{t("landing.eyebrow")}</Badge>
            </motion.div>
            <motion.h1 variants={reveal}>
              {t("landing.titleA")} <span>{t("landing.titleB")}</span>
            </motion.h1>
            <motion.p className="hero__subtitle" variants={reveal}>
              {t("landing.subtitle")}
            </motion.p>
            <motion.div className="hero__actions" variants={reveal}>
              <Link href="/sign-up">
                <Button size="lg">
                  {t("landing.primaryCta")}
                  <ArrowUpRight size={18} aria-hidden="true" />
                </Button>
              </Link>
              <a className="secondary-link" href="#workflow">
                {t("landing.secondaryCta")}
                <ChevronDown size={18} aria-hidden="true" />
              </a>
            </motion.div>
            <motion.p className="hero__trust" variants={reveal}>
              <Globe2 size={17} aria-hidden="true" />
              {t("landing.trusted")}
            </motion.p>
          </motion.div>
          <motion.div
            className="hero-room-wrap"
            initial={{ opacity: 0, scale: 0.96, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.18, ease: [0.16, 1, 0.3, 1] }}
          >
            <RoomIllustration locale={locale} t={t} />
          </motion.div>
        </section>

        <section className="control-section section-wrap">
          <motion.div
            className="control-copy"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.45 }}
            transition={{ staggerChildren: 0.1 }}
          >
            <motion.span className="section-kicker" variants={reveal}>
              <Waves size={17} />
              {t("landing.controlTitle")}
            </motion.span>
            <motion.h2 variants={reveal}>{t("landing.controlTitle")}</motion.h2>
            <motion.p variants={reveal}>{t("landing.controlBody")}</motion.p>
          </motion.div>
          <motion.div
            className="control-grid"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            transition={{ staggerChildren: 0.07 }}
          >
            <FeatureTile
              icon={<Video />}
              title={locale === "ru" ? "Сцена и трансляция" : "Stage and media"}
              body={
                locale === "ru"
                  ? "LiveKit управляет только медиапотоками и качеством соединения."
                  : "LiveKit owns media and connection quality — nothing more."
              }
            />
            <FeatureTile
              icon={<UsersRound />}
              title={locale === "ru" ? "Точные роли" : "Precise roles"}
              body={
                locale === "ru"
                  ? "Зритель остаётся зрителем, пока ведущий явно не пригласит его на сцену."
                  : "An attendee stays receive-only until a host explicitly invites them on stage."
              }
            />
            <FeatureTile
              icon={<MessageCircleMore />}
              title={locale === "ru" ? "Чистый разговор" : "A cleaner conversation"}
              body={
                locale === "ru"
                  ? "Чат, вопросы и опросы проверяются сервером до публикации."
                  : "Chat, Q&A, and polls are server-validated before they reach the room."
              }
            />
            <FeatureTile
              icon={<ChartNoAxesCombined />}
              title={locale === "ru" ? "Аналитика заявок" : "Registration analytics"}
              body={
                locale === "ru"
                  ? "После регистрации организатор видит имя, email, телефон и статус участника."
                  : "After registration, the host sees attendee name, email, phone, and registration status."
              }
            />
          </motion.div>
        </section>

        <DemoPreview locale={locale} />
        <MvpFeatures locale={locale} />

        <section className="workflow-section" id="workflow">
          <div className="section-wrap">
            <motion.div
              className="section-heading"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.5 }}
            >
              <motion.span variants={reveal} className="section-kicker">
                {t("landing.platformEyebrow")}
              </motion.span>
              <motion.h2 variants={reveal}>{t("landing.platformTitle")}</motion.h2>
            </motion.div>
            <div className="workflow-track">
              <WorkflowStep
                number="01"
                icon={<CircleGauge />}
                title={t("landing.stepCreate")}
                body={t("landing.stepCreateBody")}
              />
              <WorkflowStep
                number="02"
                icon={<Radio />}
                title={t("landing.stepLive")}
                body={t("landing.stepLiveBody")}
              />
              <WorkflowStep
                number="03"
                icon={<ChartNoAxesCombined />}
                title={t("landing.stepLearn")}
                body={t("landing.stepLearnBody")}
              />
            </div>
          </div>
        </section>

        <section className="global-section section-wrap" id="global">
          <motion.div
            className="global-orbit"
            initial={{ opacity: 0, rotate: -5 }}
            whileInView={{ opacity: 1, rotate: 0 }}
            viewport={{ once: true }}
          >
            <div className="globe-core">
              <Globe2 size={42} aria-hidden="true" />
              <span>EN</span>
              <span>RU</span>
            </div>
            <div className="orbit orbit--one" aria-hidden="true" />
            <div className="orbit orbit--two" aria-hidden="true" />
            <span className="timezone timezone--one">UTC−8</span>
            <span className="timezone timezone--two">UTC+1</span>
            <span className="timezone timezone--three">UTC+5</span>
          </motion.div>
          <motion.div
            className="global-copy"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.45 }}
            transition={{ staggerChildren: 0.1 }}
          >
            <motion.span className="section-kicker" variants={reveal}>
              {t("shell.global")}
            </motion.span>
            <motion.h2 variants={reveal}>{t("landing.globalTitle")}</motion.h2>
            <motion.p variants={reveal}>{t("landing.globalBody")}</motion.p>
            <motion.ul variants={reveal} className="check-list">
              <li>
                <Check size={16} />
                {locale === "ru"
                  ? "Переключение языка без перезагрузки"
                  : "Language switching without a reload"}
              </li>
              <li>
                <Check size={16} />
                {locale === "ru"
                  ? "Дата и время в часовом поясе посетителя"
                  : "Date and time in every visitor’s time zone"}
              </li>
              <li>
                <Check size={16} />
                {locale === "ru"
                  ? "Зрительский сценарий для desktop и mobile"
                  : "Attendee flow shaped for desktop and mobile"}
              </li>
            </motion.ul>
          </motion.div>
        </section>

        <section className="security-section" id="security">
          <div className="section-wrap security-card">
            <div className="security-card__icon">
              <ShieldCheck size={32} aria-hidden="true" />
            </div>
            <div>
              <span className="section-kicker">{t("landing.infrastructure")}</span>
              <h2>{t("landing.infrastructure")}</h2>
              <p>{t("landing.infrastructureBody")}</p>
            </div>
            <div className="security-points">
              <span>
                <LockKeyhole size={16} />
                {locale === "ru" ? "Защищённые сессии" : "Secure server sessions"}
              </span>
              <span>
                <Mic2 size={16} />
                {locale === "ru" ? "Короткоживущие права" : "Short-lived media grants"}
              </span>
              <span>
                <Captions size={16} />
                {locale === "ru" ? "Доступность по умолчанию" : "Accessibility by default"}
              </span>
            </div>
          </div>
        </section>

        <ComparisonSection locale={locale} />
        <FaqSection locale={locale} />
        <PricingSection locale={locale} />

        <section className="final-cta section-wrap">
          <motion.div
            className="final-cta__card"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <div className="final-cta__glow" aria-hidden="true" />
            <Logo compact />
            <h2>{locale === "ru" ? "Создайте пространство, в которое хочется войти." : "Create a space people want to enter."}</h2>
            <p>
              {locale === "ru"
                ? "Начните бесплатно с Free. Когда аудитория вырастет — вы сможете перейти на Pro или Business в любой момент."
                : "Start free with Free. When your audience grows, you can upgrade to Pro or Business anytime."}
            </p>
            <Link href="/sign-up">
              <Button size="lg">
                {locale === "ru" ? "Создать пространство" : "Create space"}
                <ArrowUpRight size={18} />
              </Button>
            </Link>
          </motion.div>
        </section>
      </main>
      <footer className="marketing-footer section-wrap">
        <Logo />
        <p>
          © 2026 Laminaria.{" "}
          {locale === "ru"
            ? "Комната для идей, которым нужен масштаб."
            : "Room for ideas that need to travel."}
        </p>
        <div>
          <Link href="/docs">{locale === "ru" ? "Документация" : "Docs"}</Link>
          <Link href="/sign-in">{t("auth.signIn")}</Link>
          <a href="#security">{t("shell.security")}</a>
        </div>
        <nav
          className="marketing-footer__socials"
          aria-label={locale === "ru" ? "Социальные сети Laminaria" : "Laminaria social links"}
        >
          {socialLinks.map((social) => (
            <a key={social.label} href={social.href} aria-label={social.label}>
              {social.icon}
            </a>
          ))}
        </nav>
      </footer>
    </div>
  );
}

const socialLinks = [
  {
    label: "X",
    href: "https://x.com/",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M14.66 10.33 22.1 2h-1.76l-6.46 7.23L8.72 2H2.78l7.8 10.94L2.78 22h1.76l6.82-7.63L16.8 22h5.94l-8.08-11.67Zm-2.41 2.7-.79-1.09L5.17 3.28h2.7l5.08 7 .79 1.09 6.6 9.1h-2.7l-5.39-7.44Z" />
      </svg>
    ),
  },
  {
    label: "Reddit",
    href: "https://www.reddit.com/",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M20.6 11.1c.9 0 1.6.72 1.6 1.6 0 .64-.37 1.2-.9 1.45.04.22.06.44.06.67 0 2.92-4.18 5.29-9.34 5.29S2.68 17.74 2.68 14.82c0-.22.02-.44.06-.65a1.6 1.6 0 1 1 1.76-2.6c1.6-1.18 4.05-1.94 6.78-2.04l1.28-5.98a.65.65 0 0 1 .77-.5l4.2.9a1.55 1.55 0 1 1-.28 1.28l-3.54-.76-1.08 5.06c2.8.08 5.3.84 6.93 2.04.29-.3.66-.47 1.08-.47ZM8.75 14.15a1.35 1.35 0 1 0 0-2.7 1.35 1.35 0 0 0 0 2.7Zm6.49 3.02c.22-.22.22-.58 0-.8a.57.57 0 0 0-.8 0c-.56.56-1.7.78-2.44.78-.75 0-1.88-.22-2.44-.78a.57.57 0 0 0-.8.8c.9.9 2.46 1.12 3.24 1.12s2.34-.22 3.24-1.12Zm.03-3.02a1.35 1.35 0 1 0 0-2.7 1.35 1.35 0 0 0 0 2.7Z" />
      </svg>
    ),
  },
  {
    label: "Telegram",
    href: "https://t.me/",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M21.62 3.42a1.35 1.35 0 0 0-1.4-.18L3.2 9.82c-.74.29-1.2.86-1.17 1.45.03.6.55 1.09 1.33 1.27l4.33 1.02 1.66 5.22c.22.69.68 1.11 1.24 1.14.55.03 1.03-.32 1.37-.95l2.06-3.9 4.45 3.29c.46.34.95.43 1.37.24.41-.18.7-.6.8-1.18l1.92-12.68c.08-.55-.1-1.05-.94-1.32ZM9.1 13.18l8.83-5.57c.38-.24.74.22.41.52l-7.29 6.58-.28 3.02-1.67-4.55Z" />
      </svg>
    ),
  },
  {
    label: "TikTok",
    href: "https://www.tiktok.com/",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M15.7 2.5c.32 2.58 1.77 4.12 4.3 4.28v3.23a7.65 7.65 0 0 1-4.22-1.32v6.26c0 3.16-1.92 6.05-5.76 6.05-3.5 0-5.8-2.28-5.8-5.33 0-3.45 2.68-5.64 6.28-5.36v3.34c-1.5-.23-2.7.55-2.7 1.9 0 1.23.88 2.08 2.17 2.08 1.52 0 2.24-.98 2.24-2.62V2.5h3.49Z" />
      </svg>
    ),
  },
];

function DemoPreview({ locale }: { locale: string }) {
  const isRu = locale === "ru";
  const steps = isRu
    ? ["Создание вебинара", "Запуск эфира", "Чат и AI", "Аналитика"]
    : ["Create webinar", "Go live", "Chat and AI", "Analytics"];

  return (
    <section className="demo-preview section-wrap" id="demo">
      <motion.div
        className="demo-preview__copy"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.35 }}
        transition={{ staggerChildren: 0.08 }}
      >
        <motion.span className="section-kicker" variants={reveal}>
          <Sparkles size={17} />
          {isRu ? "Демо продукта" : "Product demo"}
        </motion.span>
        <motion.h2 variants={reveal}>
          {isRu ? "Посмотрите, как Laminaria работает за 30 секунд" : "See Laminaria in action in 30 seconds"}
        </motion.h2>
        <motion.p variants={reveal}>
          {isRu
            ? "Один плавный сценарий: создание вебинара, запуск эфира, живой чат, AI-помощник и аналитика после события."
            : "One smooth flow: create a webinar, start the live room, chat with viewers, use AI and read analytics after the event."}
        </motion.p>
      </motion.div>
      <motion.div
        className="demo-reel"
        initial={{ opacity: 0, y: 28, scale: 0.97 }}
        whileInView={{ opacity: 1, y: 0, scale: 1 }}
        viewport={{ once: true, amount: 0.25 }}
        transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="demo-reel__screen">
          <div className="demo-reel__top">
            <span />
            <span />
            <span />
          </div>
          <div className="demo-reel__timeline">
            {steps.map((step, index) => (
              <div key={step} className={index === 1 ? "is-active" : ""}>
                <i>{index + 1}</i>
                <span>{step}</span>
              </div>
            ))}
          </div>
          <div className="demo-reel__stage">
            <div className="demo-card demo-card--create">
              <Radio size={22} />
              <strong>{isRu ? "Новый вебинар" : "New webinar"}</strong>
              <span>{isRu ? "30 сек настройки" : "30 sec setup"}</span>
            </div>
            <div className="demo-card demo-card--live">
              <Video size={22} />
              <strong>{isRu ? "Эфир запущен" : "Live room is ready"}</strong>
              <span>HD · Chat · Screen</span>
            </div>
            <div className="demo-card demo-card--ai">
              <Bot size={22} />
              <strong>AI Assistant</strong>
              <span>{isRu ? "Собрал 4 вопроса" : "Grouped 4 questions"}</span>
            </div>
            <div className="demo-card demo-card--analytics">
              <BarChart3 size={22} />
              <strong>{isRu ? "Аналитика" : "Analytics"}</strong>
              <span>{isRu ? "Посетители и заявки" : "Attendance and leads"}</span>
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  );
}

function MvpFeatures({ locale }: { locale: string }) {
  const isRu = locale === "ru";
  const features = [
    ["HD Video", <Video key="video" />],
    ["Screen Sharing", <MonitorUp key="screen" />],
    ["Live Chat", <MessageCircleMore key="chat" />],
    ["Polls", <BarChart3 key="polls" />],
    ["Q&A", <FileQuestion key="qa" />],
    ["Recording", <Clapperboard key="recording" />],
    ["Analytics", <ChartNoAxesCombined key="analytics" />],
    ["Branding", <Palette key="branding" />],
    ["Multi-language", <Globe2 key="language" />],
    ["Mobile", <Smartphone key="mobile" />],
  ] as const;

  return (
    <section className="mvp-features section-wrap" id="features">
      <SectionHead
        kicker={isRu ? "Возможности MVP" : "MVP features"}
        title={isRu ? "Полный набор для первого коммерческого релиза" : "The complete feature set for a commercial MVP"}
      />
      <div className="mvp-features__grid">
        {features.map(([title, icon]) => (
          <motion.article
            key={title}
            className="mvp-feature-card"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.25 }}
            variants={reveal}
            whileHover={{ y: -6 }}
          >
            <span>{icon}</span>
            <strong>{title}</strong>
          </motion.article>
        ))}
      </div>
    </section>
  );
}

function PricingSection({ locale }: { locale: string }) {
  const isRu = locale === "ru";
  const [billing, setBilling] = useState<"yearly" | "monthly">("yearly");
  const yearly = billing === "yearly";
  const plans = [
    {
      name: "Free",
      price: "$0",
      originalPrice: null,
      note: isRu ? "для первых тестов" : "for first tests",
      period: isRu ? "/месяц" : "/month",
      items: isRu
        ? ["До 25 участников", "HD-видео", "Чат", "Демонстрация экрана"]
        : ["Up to 25 participants", "HD Video", "Chat", "Screen Share"],
      cta: isRu ? "Начать" : "Start",
    },
    {
      name: "Pro",
      price: yearly ? "$120" : "$12",
      originalPrice: yearly ? "$144" : "$15",
      note: isRu ? "самый популярный" : "most popular",
      period: yearly ? (isRu ? "/год" : "/year") : isRu ? "/месяц" : "/month",
      featured: true,
      items: isRu
        ? ["До 150 участников", "Запись", "Аналитика", "Опросы", "Брендинг"]
        : ["Up to 150 participants", "Recording", "Analytics", "Polls", "Branding"],
      cta: isRu ? "Выбрать Pro" : "Choose Pro",
    },
    {
      name: "Business",
      price: yearly ? "$290" : "$29",
      originalPrice: yearly ? "$348" : "$36",
      note: isRu ? "для команд" : "for teams",
      period: yearly ? (isRu ? "/год" : "/year") : isRu ? "/месяц" : "/month",
      items: isRu
        ? ["До 1000 участников", "API", "White Label", "Команда"]
        : ["Up to 1000 participants", "API", "White Label", "Team"],
      cta: isRu ? "Для бизнеса" : "Go Business",
    },
  ];

  return (
    <section className="landing-pricing section-wrap" id="pricing">
      <SectionHead
        kicker={isRu ? "Тарифы" : "Pricing"}
        title={isRu ? "Простая цена, чтобы быстро проверить рынок" : "Simple pricing to validate the market fast"}
      />
      <div className="billing-switch" role="group" aria-label={isRu ? "Период оплаты" : "Billing period"}>
        <button
          type="button"
          className={yearly ? "is-active" : ""}
          onClick={() => setBilling("yearly")}
        >
          {isRu ? "Год" : "Yearly"}
          <span>{isRu ? "скидка 17%" : "save 17%"}</span>
        </button>
        <button type="button" className={!yearly ? "is-active" : ""} onClick={() => setBilling("monthly")}>
          {isRu ? "Месяц" : "Monthly"}
          <span>{isRu ? "скидка 20%" : "save 20%"}</span>
        </button>
      </div>
      <div className="landing-pricing__grid">
        {plans.map((plan) => (
          <motion.article
            key={plan.name}
            className={`landing-price-card ${plan.featured ? "is-featured" : ""}`}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.25 }}
            variants={reveal}
            whileHover={{ y: -6 }}
          >
            {plan.featured ? (
              <span className="landing-price-card__badge">
                <Star size={14} />
                {isRu ? "Популярный" : "Popular"}
              </span>
            ) : null}
            <h3>{plan.name}</h3>
            <div className="landing-price-card__price">
              {plan.originalPrice ? <del>{plan.originalPrice}</del> : null}
              <strong>{plan.price}</strong>
              <span>{plan.period}</span>
            </div>
            <p>{plan.note}</p>
            <ul>
              {plan.items.map((item) => (
                <li key={item}>
                  <Check size={16} />
                  {item}
                </li>
              ))}
            </ul>
            <Link href="/sign-up">{plan.cta}</Link>
          </motion.article>
        ))}
      </div>
    </section>
  );
}

function ComparisonSection({ locale }: { locale: string }) {
  const isRu = locale === "ru";
  const rows = [
    ["AI Moderator", "yes", "no", "no"],
    ["Webinar Analytics", "yes", "warn", "no"],
    ["Branding", "yes", "warn", "no"],
  ] as const;

  return (
    <section className="landing-comparison section-wrap">
      <SectionHead
        kicker={isRu ? "Сравнение" : "Comparison"}
        title={isRu ? "Чем Laminaria выделяется уже в MVP" : "Where Laminaria already stands out"}
      />
      <div className="landing-comparison__table">
        <div className="landing-comparison__row is-head">
          <span>Feature</span>
          <span>Laminaria</span>
          <span>Zoom</span>
          <span>Google Meet</span>
        </div>
        {rows.map(([feature, laminaria, zoom, meet]) => (
          <div key={feature} className="landing-comparison__row">
            <span>{feature}</span>
            <StatusIcon status={laminaria} />
            <StatusIcon status={zoom} />
            <StatusIcon status={meet} />
          </div>
        ))}
      </div>
    </section>
  );
}

function FaqSection({ locale }: { locale: string }) {
  const isRu = locale === "ru";
  const [openQuestion, setOpenQuestion] = useState<string | null>(null);
  const items = isRu
    ? [
        ["Сколько участников можно пригласить?", "Starter поддерживает до 25 участников, Pro до 150, Business до 1000."],
        ["Есть ли запись вебинара?", "Да, запись входит в Pro и Business."],
        ["Работает ли на телефоне?", "Да, лендинг, регистрация и комната адаптированы под мобильные устройства."],
        ["Нужно ли что-то устанавливать?", "Нет, всё работает в браузере."],
        ["Можно ли брендировать вебинар?", "Да, брендинг доступен в Pro и Business."],
        ["Можно ли отменить подписку?", "Да, отменить можно в любой момент."],
      ]
    : [
        ["How many participants can join?", "Starter supports up to 25 participants, Pro up to 150, Business up to 1000."],
        ["Can I record webinars?", "Yes, recording is included in Pro and Business."],
        ["Does it work on mobile?", "Yes, the landing, registration and room are mobile-ready."],
        ["Do attendees need to install anything?", "No, everything works in the browser."],
        ["Can I customize branding?", "Yes, branding is available in Pro and Business."],
        ["Can I cancel anytime?", "Yes, you can cancel your subscription anytime."],
      ];

  return (
    <section className="landing-faq section-wrap" id="faq">
      <SectionHead kicker="FAQ" title={isRu ? "Коротко о главном" : "The essentials, answered"} />
      <div className="landing-faq__list">
        {items.map(([question, answer]) => (
          <article key={question} className={openQuestion === question ? "is-open" : ""}>
            <button
              type="button"
              aria-expanded={openQuestion === question}
              onClick={() => setOpenQuestion((current) => (current === question ? null : question))}
            >
              {question}
              <motion.span animate={{ rotate: openQuestion === question ? 180 : 0 }} transition={{ duration: 0.28 }}>
                <ChevronDown size={18} />
              </motion.span>
            </button>
            <AnimatePresence initial={false}>
              {openQuestion === question ? (
                <motion.div
                  className="landing-faq__answer"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.34, ease: [0.16, 1, 0.3, 1] }}
                >
                  <p>{answer}</p>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </article>
        ))}
      </div>
    </section>
  );
}

function SectionHead({ kicker, title }: { kicker: string; title: string }) {
  return (
    <motion.div
      className="landing-section-head"
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.45 }}
      transition={{ staggerChildren: 0.08 }}
    >
      <motion.span className="section-kicker" variants={reveal}>
        {kicker}
      </motion.span>
      <motion.h2 variants={reveal}>{title}</motion.h2>
    </motion.div>
  );
}

function StatusIcon({ status }: { status: "yes" | "no" | "warn" }) {
  if (status === "yes") {
    return (
      <span className="landing-status landing-status--yes" aria-label="Yes">
        <Check size={16} />
      </span>
    );
  }
  if (status === "warn") {
    return (
      <span className="landing-status landing-status--warn" aria-label="Limited">
        <TriangleAlert size={16} />
      </span>
    );
  }
  return (
    <span className="landing-status landing-status--no" aria-label="No">
      <X size={16} />
    </span>
  );
}

function RoomIllustration({
  locale,
  t,
}: {
  locale: string;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <motion.div className="room-illustration" whileHover={{ y: -4 }} transition={{ duration: 0.3 }}>
      <div className="room-illustration__topbar">
        <div>
          <span className="status-pulse" />
          <strong>Laminaria</strong>
        </div>
        <span className="room-time">00:42:18</span>
        <span className="room-top-users">
          <UsersRound size={14} />
          56
        </span>
      </div>
      <div className="room-mock-grid">
        <div className="room-mock-speakers">
          <div className="room-mock-speaker is-main">
            <span>{locale === "ru" ? "Вы" : "You"}</span>
          </div>
          <div className="room-mock-speaker is-guest">
            <span>{locale === "ru" ? "Спикер" : "Speaker"}</span>
          </div>
          <div className="room-mock-tools">
            <span>
              <Mic2 size={15} />
            </span>
            <span>
              <Video size={15} />
            </span>
            <span>
              <MonitorUp size={15} />
            </span>
          </div>
        </div>
        <div className="room-stage">
          <div className="stage-light" aria-hidden="true" />
          <span className="stage-caption">
            <MonitorUp size={14} />
            {locale === "ru" ? "Вы демонстрируете экран" : "You are sharing your screen"}
          </span>
          <h3>{locale === "ru" ? "Как запускать вебинары, которые досматривают" : "Run webinars people finish"}</h3>
          <div className="room-slide-shape" aria-hidden="true" />
          <div className="room-annotation-bar">
            <span />
            <span />
            <span />
          </div>
        </div>
        <div className="room-mock-chat">
          <strong>{t("room.chat")}</strong>
          <p>
            <span>Anna</span>
            {locale === "ru" ? "Отличная тема" : "Great topic"}
          </p>
          <p className="is-you">
            <span>{locale === "ru" ? "Вы" : "You"}</span>
            {locale === "ru" ? "Сейчас покажу на слайде." : "I'll show it on the slide."}
          </p>
          <div>
            <small>{locale === "ru" ? "Сообщение..." : "Message..."}</small>
            <Send size={14} />
          </div>
        </div>
      </div>
      <div className="room-controls">
        <span className="room-control room-control--active">
          <Mic2 size={17} />
        </span>
        <span className="room-control room-control--active">
          <Video size={17} />
        </span>
        <span className="room-control">
          <Captions size={17} />
        </span>
        <span className="room-control">
          <MessageCircleMore size={17} />
        </span>
        <span className="room-control room-control--active">
          <Copy size={17} />
        </span>
      </div>
      <span className="room-locale">{locale.toUpperCase()}</span>
    </motion.div>
  );
}

function FeatureTile({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <motion.article className="feature-tile" variants={reveal} whileHover={{ y: -5 }}>
      <span className="feature-tile__icon" aria-hidden="true">
        {icon}
      </span>
      <h3>{title}</h3>
      <p>{body}</p>
    </motion.article>
  );
}

function WorkflowStep({
  number,
  icon,
  title,
  body,
}: {
  number: string;
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <motion.article
      className="workflow-step"
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.4 }}
      variants={reveal}
    >
      <span className="workflow-step__number">{number}</span>
      <span className="workflow-step__icon" aria-hidden="true">
        {icon}
      </span>
      <h3>{title}</h3>
      <p>{body}</p>
    </motion.article>
  );
}


