"use client";

import {
  ArrowUpRight,
  BadgeDollarSign,
  Blocks,
  CheckCircle2,
  Globe2,
  LayoutDashboard,
  LockKeyhole,
  MonitorSmartphone,
  Radio,
  ShieldCheck,
  Sparkles,
  Workflow,
} from "lucide-react";
import { motion, useScroll, useSpring } from "motion/react";
import { useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Badge, Button, Logo } from "@laminaria/ui";
import { MarketingHeader } from "./marketing-header";

type DocCard = {
  title: string;
  body: string;
  items?: string[];
};

type DocSection = {
  id: string;
  eyebrow: string;
  title: string;
  body: string;
  cards: DocCard[];
};

type DocsContent = {
  badge: string;
  title: string;
  lead: string;
  updated: string;
  primaryCta: string;
  secondaryCta: string;
  navTitle: string;
  footerText: string;
  sections: DocSection[];
};

const sectionIcons = {
  product: Sparkles,
  functionality: LayoutDashboard,
  pricing: BadgeDollarSign,
  design: MonitorSmartphone,
  stack: Blocks,
  architecture: Workflow,
  security: ShieldCheck,
  mvp: CheckCircle2,
} as const;

const docs: Record<"en" | "ru", DocsContent> = {
  en: {
    badge: "Product & technical documentation",
    title: "Laminaria documentation",
    lead:
      "A practical overview of the product, webinar flow, architecture, security model, MVP scope and future commercial logic.",
    updated: "Updated for the current MVP build",
    primaryCta: "Open the app",
    secondaryCta: "Back to landing",
    navTitle: "On this page",
    footerText: "Documentation for creators, teams and early startup checks.",
    sections: [
      {
        id: "product",
        eyebrow: "01 · Product",
        title: "What Laminaria is",
        body:
          "Laminaria is a webinar and live communication platform for creators, educators, consultants and teams that want to run polished online events without assembling several services by hand.",
        cards: [
          {
            title: "Core promise",
            body:
              "Create a webinar, share the registration link, host the live room, moderate the audience and collect useful analytics in one place.",
          },
          {
            title: "Market focus",
            body:
              "The product is prepared for the EU and US startup market while staying friendly for CIS users with Russian and English localization.",
          },
          {
            title: "User roles",
            body:
              "The platform separates organizers, co-hosts, speakers, moderators and viewers so each person gets only the tools they need.",
          },
        ],
      },
      {
        id: "functionality",
        eyebrow: "02 · Functionality",
        title: "Main product capabilities",
        body:
          "The MVP covers the full journey from account creation to a scheduled webinar, viewer registration, live session management, chat and analytics.",
        cards: [
          {
            title: "User system",
            body:
              "Email and Google sign-in, persistent sessions, onboarding, workspace creation and clean role-based access.",
            items: ["Organizer accounts", "Viewer participation", "Team roles"],
          },
          {
            title: "Webinar creation",
            body:
              "Organizers can create scheduled webinars, set title, description, language, time, visibility, banners and attendee limits.",
            items: ["Public registration link", "Countdown page", "Shareable viewer flow"],
          },
          {
            title: "Live room",
            body:
              "Hosts get camera, microphone, screen sharing, chat controls and quality options; viewers join without camera or microphone.",
            items: ["Audience counter", "Chat permissions", "Screen + camera layout"],
          },
          {
            title: "Moderation",
            body:
              "Admins and moderators can mute chat, ban users for a selected duration, remove banned users from the room and manage blocked lists.",
            items: ["Temporary mute", "Temporary or permanent ban", "Unban and unmute lists"],
          },
          {
            title: "AI and automation",
            body:
              "AI features are planned around summaries, webinar assistance, content suggestions and post-event insights.",
          },
          {
            title: "Analytics and notifications",
            body:
              "Registration data, attendance, names, emails and phone numbers are collected for webinar analytics. In-app notifications support team invites.",
          },
        ],
      },
      {
        id: "pricing",
        eyebrow: "03 · Pricing",
        title: "Commercial model",
        body:
          "Pricing is designed to start simple and grow into subscriptions once the MVP validates demand.",
        cards: [
          {
            title: "Free · $0",
            body:
              "For testing the product, creating early webinars and validating the viewer flow without paid limits during development.",
            items: ["Basic webinars", "Core room controls", "Manual testing"],
          },
          {
            title: "Creator · $15/month",
            body:
              "For solo creators and experts who need branded webinars, analytics and a more reliable production workflow.",
            items: ["More attendees", "Branding", "Analytics"],
          },
          {
            title: "Business · $49/month",
            body:
              "For teams that need moderation, team roles, deeper analytics, automation and future integrations.",
            items: ["Teams", "Advanced moderation", "Commercial analytics"],
          },
        ],
      },
      {
        id: "design",
        eyebrow: "04 · Design",
        title: "Design direction",
        body:
          "The interface should feel premium, fluid and joyful: soft gradients, glass panels, clear hierarchy and smooth motion that makes the product feel alive.",
        cards: [
          {
            title: "Visual language",
            body:
              "Ocean-inspired gradients, rounded surfaces, soft shadows, animated accents and a focused dark/light compatible base.",
          },
          {
            title: "Core pages",
            body:
              "Landing, auth, dashboard, webinar creation, public registration, countdown, prejoin, live room, teams and analytics.",
          },
          {
            title: "Responsive UX",
            body:
              "Mobile must be treated as a first-class surface: no overflow, readable controls, stacked panels and thumb-friendly actions.",
          },
        ],
      },
      {
        id: "stack",
        eyebrow: "05 · Stack",
        title: "Technical stack",
        body:
          "The project uses a modern TypeScript monorepo with a separate web app, API, shared packages and Prisma database layer.",
        cards: [
          {
            title: "Frontend",
            body:
              "Next.js, React, TypeScript, next-intl, motion animations and a shared Laminaria UI package.",
          },
          {
            title: "Backend",
            body:
              "Fastify API, Prisma, PostgreSQL/Neon, session cookies, realtime sockets and domain services.",
          },
          {
            title: "Live video",
            body:
              "LiveKit-compatible video infrastructure for host camera, screen sharing, token-based media grants and participant control.",
          },
          {
            title: "Infrastructure",
            body:
              "Vercel for the web client, Render for API hosting, Neon for PostgreSQL, object storage for assets and future workers for async tasks.",
          },
        ],
      },
      {
        id: "architecture",
        eyebrow: "06 · Architecture",
        title: "System architecture",
        body:
          "The MVP is intentionally close to a modular monolith: faster to ship, easier to debug and ready to split into services when usage grows.",
        cards: [
          {
            title: "Frontend Application",
            body:
              "Handles public pages, dashboard, room UI, localization, responsive layout and API integration.",
          },
          {
            title: "Backend API",
            body:
              "Owns authentication, workspaces, webinars, registrations, teams, moderation actions, analytics and realtime events.",
          },
          {
            title: "Realtime Service",
            body:
              "Coordinates chat, viewer counts, moderation events, room state and live notifications.",
          },
          {
            title: "Data model",
            body:
              "Main entities include users, sessions, workspaces, teams, memberships, webinars, registrations, chat messages, bans, mutes and analytics events.",
          },
        ],
      },
      {
        id: "security",
        eyebrow: "07 · Security",
        title: "Security model",
        body:
          "Security is built around server-owned sessions, short-lived media tokens, role checks and strict boundaries between organizers and viewers.",
        cards: [
          {
            title: "Auth and sessions",
            body:
              "HTTP-only cookies, CSRF checks and persistent login behavior keep users signed in safely across refreshes.",
          },
          {
            title: "Role-based access",
            body:
              "Organizers, moderators, speakers and viewers receive different permissions for room controls, chat and administrative actions.",
          },
          {
            title: "Moderation safety",
            body:
              "Bans and mutes are recorded so admins can review who was restricted, for how long and restore access when needed.",
          },
        ],
      },
      {
        id: "mvp",
        eyebrow: "08 · MVP",
        title: "MVP scope",
        body:
          "The current goal is a usable, testable product: create an account, create a workspace, schedule a webinar, share the link, register viewers, run the room and review basic analytics.",
        cards: [
          {
            title: "Included now",
            body:
              "Landing, localization, authentication, workspace flow, webinar scheduling, public registration, countdown, room, chat, moderation and analytics basics.",
          },
          {
            title: "Next after MVP",
            body:
              "Subscriptions, AI automation, advanced team marketplace, deeper analytics, polished notification center and production-grade video scaling.",
          },
        ],
      },
    ],
  },
  ru: {
    badge: "Продуктовая и техническая документация",
    title: "Документация Laminaria",
    lead:
      "Понятное описание продукта, вебинарного сценария, архитектуры, безопасности, MVP и будущей коммерческой модели.",
    updated: "Обновлено под текущую MVP-сборку",
    primaryCta: "Открыть приложение",
    secondaryCta: "Назад на лендинг",
    navTitle: "На этой странице",
    footerText: "Документация для создателей, команд и первых проверок стартапа.",
    sections: [
      {
        id: "product",
        eyebrow: "01 · Продукт",
        title: "Что такое Laminaria",
        body:
          "Laminaria — платформа для вебинаров и живой коммуникации: для создателей, экспертов, преподавателей, консультантов и команд, которым нужно проводить онлайн-эфиры без сборки пяти разных сервисов вручную.",
        cards: [
          {
            title: "Главное обещание",
            body:
              "Создать вебинар, выдать ссылку регистрации, провести эфир, модерировать зрителей и собрать полезную аналитику в одном месте.",
          },
          {
            title: "Фокус рынка",
            body:
              "Продукт готовится под стартап-рынок ЕС и США, но остаётся удобным для СНГ благодаря русской и английской локализации.",
          },
          {
            title: "Роли пользователей",
            body:
              "Платформа разделяет организаторов, соведущих, спикеров, модераторов и зрителей, чтобы каждый видел только нужные инструменты.",
          },
        ],
      },
      {
        id: "functionality",
        eyebrow: "02 · Функциональность",
        title: "Основные возможности",
        body:
          "MVP закрывает путь от регистрации аккаунта до запланированного вебинара, регистрации зрителей, проведения эфира, чата и аналитики.",
        cards: [
          {
            title: "Система пользователей",
            body:
              "Вход по почте и через Google, сохранение сессии, онбординг, создание рабочего пространства и нормальная система ролей.",
            items: ["Аккаунты организаторов", "Участие зрителей", "Командные роли"],
          },
          {
            title: "Создание вебинара",
            body:
              "Организатор задаёт название, описание, язык, дату, время, видимость, баннеры и лимит участников.",
            items: ["Публичная ссылка", "Страница обратного отсчёта", "Удобный путь зрителя"],
          },
          {
            title: "Комната эфира",
            body:
              "Ведущий получает камеру, микрофон, демонстрацию экрана, управление чатом и качеством. Зритель входит без камеры и микрофона.",
            items: ["Счётчик зрителей", "Разрешения чата", "Экран + камера ведущего"],
          },
          {
            title: "Модерация",
            body:
              "Админ и модератор могут мутить чат, банить на выбранный срок, выкидывать забаненных из комнаты и управлять списками ограничений.",
            items: ["Временный мут", "Временный или вечный бан", "Списки разбана и размута"],
          },
          {
            title: "AI и автоматизация",
            body:
              "AI-функции планируются для саммари, помощи во время вебинара, подсказок по контенту и пост-аналитики.",
          },
          {
            title: "Аналитика и уведомления",
            body:
              "Данные регистрации, посещаемость, имена, почты и телефоны собираются в аналитику вебинаров. Внутренние уведомления поддерживают приглашения в команды.",
          },
        ],
      },
      {
        id: "pricing",
        eyebrow: "03 · Тарифы",
        title: "Коммерческая модель",
        body:
          "Тарифы сделаны простыми для старта и могут перейти в подписки после проверки спроса на MVP.",
        cards: [
          {
            title: "Free · $0",
            body:
              "Для тестирования продукта, первых вебинаров и проверки пути зрителя без платных ограничений во время разработки.",
            items: ["Базовые вебинары", "Основные кнопки эфира", "Ручное тестирование"],
          },
          {
            title: "Creator · $15/мес",
            body:
              "Для создателей и экспертов, которым нужны брендирование, аналитика и более надёжный рабочий процесс.",
            items: ["Больше участников", "Брендинг", "Аналитика"],
          },
          {
            title: "Business · $49/мес",
            body:
              "Для команд: роли, модерация, расширенная аналитика, автоматизация и будущие интеграции.",
            items: ["Команды", "Продвинутая модерация", "Коммерческая аналитика"],
          },
        ],
      },
      {
        id: "design",
        eyebrow: "04 · Дизайн",
        title: "Дизайн-направление",
        body:
          "Интерфейс должен ощущаться премиальным, плавным и радостным: мягкие градиенты, стеклянные панели, понятная иерархия и живые анимации.",
        cards: [
          {
            title: "Визуальный язык",
            body:
              "Океанические градиенты, округлые поверхности, мягкие тени, анимированные акценты и база, которая дружит с тёмной и светлой темой.",
          },
          {
            title: "Главные страницы",
            body:
              "Лендинг, вход, регистрация, дашборд, создание вебинара, публичная регистрация, обратный отсчёт, prejoin, эфир, команды и аналитика.",
          },
          {
            title: "Адаптивность",
            body:
              "Мобильная версия должна быть полноценной: без overflow, с читаемыми контролами, стеком блоков и удобными кнопками под палец.",
          },
        ],
      },
      {
        id: "stack",
        eyebrow: "05 · Стек",
        title: "Технический стек",
        body:
          "Проект построен как современный TypeScript-монорепозиторий с отдельным web-приложением, API, общими пакетами и Prisma-слоем базы данных.",
        cards: [
          {
            title: "Frontend",
            body:
              "Next.js, React, TypeScript, next-intl, motion-анимации и общий UI-пакет Laminaria.",
          },
          {
            title: "Backend",
            body:
              "Fastify API, Prisma, PostgreSQL/Neon, session cookies, realtime-сокеты и доменные сервисы.",
          },
          {
            title: "Видео",
            body:
              "LiveKit-совместимая инфраструктура для камеры ведущего, демонстрации экрана, короткоживущих media-token и контроля участников.",
          },
          {
            title: "Инфраструктура",
            body:
              "Vercel для web-клиента, Render для API, Neon для PostgreSQL, object storage для ассетов и будущие worker-процессы для фоновых задач.",
          },
        ],
      },
      {
        id: "architecture",
        eyebrow: "06 · Архитектура",
        title: "Архитектура системы",
        body:
          "MVP сознательно близок к модульному монолиту: быстрее выпускать, проще отлаживать и легче разделить на сервисы, когда появится нагрузка.",
        cards: [
          {
            title: "Frontend Application",
            body:
              "Отвечает за публичные страницы, дашборд, комнату эфира, локализацию, адаптивный интерфейс и связь с API.",
          },
          {
            title: "Backend API",
            body:
              "Ведёт авторизацию, workspaces, webinars, registrations, teams, moderation actions, analytics и realtime-события.",
          },
          {
            title: "Realtime Service",
            body:
              "Синхронизирует чат, счётчик зрителей, события модерации, состояние комнаты и живые уведомления.",
          },
          {
            title: "Модель данных",
            body:
              "Основные сущности: users, sessions, workspaces, teams, memberships, webinars, registrations, chat messages, bans, mutes и analytics events.",
          },
        ],
      },
      {
        id: "security",
        eyebrow: "07 · Безопасность",
        title: "Модель безопасности",
        body:
          "Безопасность строится на серверных сессиях, короткоживущих media-token, проверках ролей и строгой границе между организаторами и зрителями.",
        cards: [
          {
            title: "Auth и сессии",
            body:
              "HTTP-only cookies, CSRF-проверки и сохранение входа позволяют безопасно оставаться в аккаунте после обновления страницы.",
          },
          {
            title: "Доступ по ролям",
            body:
              "Организаторы, модераторы, спикеры и зрители получают разные права на управление эфиром, чатом и админ-действиями.",
          },
          {
            title: "Безопасная модерация",
            body:
              "Баны и муты записываются, чтобы админ мог увидеть кого ограничили, на какой срок и при необходимости вернуть доступ.",
          },
        ],
      },
      {
        id: "mvp",
        eyebrow: "08 · MVP",
        title: "Объём MVP",
        body:
          "Текущая цель — рабочий продукт для проверки: создать аккаунт, рабочее пространство, вебинар, отправить ссылку, собрать регистрации, провести эфир и посмотреть базовую аналитику.",
        cards: [
          {
            title: "Есть сейчас",
            body:
              "Лендинг, локализация, авторизация, workspace flow, планирование вебинара, публичная регистрация, обратный отсчёт, комната, чат, модерация и базовая аналитика.",
          },
          {
            title: "После MVP",
            body:
              "Подписки, AI-автоматизация, расширенная биржа/команды, глубокая аналитика, центр уведомлений и production-масштабирование видео.",
          },
        ],
      },
    ],
  },
};

export function DocumentationPage() {
  const locale = useLocale() === "ru" ? "ru" : "en";
  const content = docs[locale];
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 160, damping: 30, restDelta: 0.001 });

  return (
    <div className="marketing-shell docs-shell">
      <motion.div className="scroll-progress" style={{ scaleX }} aria-hidden="true" />
      <MarketingHeader />
      <main>
        <section className="docs-hero section-wrap">
          <div className="ambient ambient--one" aria-hidden="true" />
          <div className="ambient ambient--two" aria-hidden="true" />
          <motion.div
            className="docs-hero__content"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          >
            <Badge tone="primary"><Sparkles size={14} />{content.badge}</Badge>
            <h1>{content.title}</h1>
            <p>{content.lead}</p>
            <div className="docs-hero__meta">
              <span><Globe2 size={16} />EN / RU</span>
              <span><Radio size={16} />{content.updated}</span>
              <span><LockKeyhole size={16} />MVP</span>
            </div>
            <div className="docs-hero__actions">
              <Link href="/sign-up"><Button size="lg">{content.primaryCta}<ArrowUpRight size={18} /></Button></Link>
              <Link href="/"><Button size="lg" variant="ghost">{content.secondaryCta}</Button></Link>
            </div>
          </motion.div>
        </section>

        <section className="docs-layout section-wrap" aria-label={content.title}>
          <aside className="docs-nav-card">
            <Logo compact />
            <h2>{content.navTitle}</h2>
            <nav aria-label={content.navTitle}>
              {content.sections.map((section) => {
                const Icon = sectionIcons[section.id as keyof typeof sectionIcons] ?? Sparkles;
                return (
                  <a key={section.id} href={`#${section.id}`}>
                    <Icon size={16} />
                    <span>{section.title}</span>
                  </a>
                );
              })}
            </nav>
          </aside>

          <div className="docs-content">
            {content.sections.map((section, index) => {
              const Icon = sectionIcons[section.id as keyof typeof sectionIcons] ?? Sparkles;
              return (
                <motion.article
                  key={section.id}
                  id={section.id}
                  className="docs-section-card"
                  initial={{ opacity: 0, y: 26 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-80px" }}
                  transition={{ duration: 0.45, delay: Math.min(index * 0.03, 0.18) }}
                >
                  <div className="docs-section-card__head">
                    <div className="docs-section-card__icon"><Icon size={22} /></div>
                    <div>
                      <span>{section.eyebrow}</span>
                      <h2>{section.title}</h2>
                    </div>
                  </div>
                  <p className="docs-section-card__body">{section.body}</p>
                  <div className={section.id === "pricing" ? "docs-price-grid" : "docs-card-grid"}>
                    {section.cards.map((card) => (
                      <div key={card.title} className={section.id === "pricing" ? "docs-price-card" : "docs-mini-card"}>
                        <h3>{card.title}</h3>
                        <p>{card.body}</p>
                        {card.items ? (
                          <ul>
                            {card.items.map((item) => <li key={item}><CheckCircle2 size={15} />{item}</li>)}
                          </ul>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </motion.article>
              );
            })}
          </div>
        </section>
      </main>
      <footer className="marketing-footer section-wrap">
        <Logo />
        <p>© 2026 Laminaria. {content.footerText}</p>
        <div>
          <Link href="/">{locale === "ru" ? "Лендинг" : "Landing"}</Link>
          <Link href="/sign-in">{locale === "ru" ? "Войти" : "Sign in"}</Link>
        </div>
      </footer>
    </div>
  );
}
