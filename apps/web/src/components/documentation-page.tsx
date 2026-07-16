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
  commercialMvp: Radio,
  pricing: BadgeDollarSign,
  design: MonitorSmartphone,
  stack: Blocks,
  architecture: Workflow,
  security: ShieldCheck,
  mvp: CheckCircle2,
} as const;

const commercialMvpCardsEn: DocCard[] = [
  {
    title: "Core platform",
    body:
      "Registration, sign-in, Google OAuth, GitHub OAuth, password recovery, persistent sessions, profile, avatar, name, bio, language, timezone and organization onboarding.",
    items: ["Workspace creation", "Owner, Admin, Moderator, Member", "Invitations and role management"],
  },
  {
    title: "Webinar management",
    body:
      "Title, description, banner, date, time, duration, timezone, public/private mode, password, participant limit, edit, delete, duplicate and save as template.",
    items: ["Waiting page", "Mic/camera/internet test", "Reusable templates"],
  },
  {
    title: "Live room",
    body:
      "Camera, microphone, screen sharing, multiple presenters, camera/microphone switching and host control over participants.",
    items: ["Host-only mode", "Multi-host mode", "Free mode"],
  },
  {
    title: "Chat and moderation",
    body:
      "Messages, emoji, replies, pinned messages, links, images, deleted messages, mutes and bans. Viewers write only when moderation settings allow it.",
    items: ["Delete message", "Temporary mute", "Kick and ban"],
  },
  {
    title: "AI differentiation",
    body:
      "AI Moderator, AI Assistant and AI Summary are the main Laminaria moat, so they move from vague future ideas into MVP+ priorities.",
    items: ["Spam/link/profanity filtering", "Answers from webinar materials", "Summary, Q&A list and homework"],
  },
  {
    title: "Engagement tools",
    body:
      "A commercial webinar needs Q&A, polls and reactions so the event feels alive and measurable.",
    items: ["Question likes and answered status", "Single/multiple-choice polls", "👍 ❤️ 👏 😂 🎉 reactions"],
  },
  {
    title: "Recording and files",
    body:
      "MVP should support recording, playback, download and file sharing during the webinar.",
    items: ["PDF, DOCX, PPTX, ZIP", "Future AI chapters", "Future transcript and search"],
  },
  {
    title: "Email and webinar landing page",
    body:
      "Every webinar gets a public page and automated email flow: invitation, reminder, webinar started, finished and thank-you messages.",
    items: ["Banner, host, date, registration", "Public share link", "Future branded emails"],
  },
  {
    title: "Analytics, dashboard and admin",
    body:
      "Dashboard needs upcoming webinars, recent recordings, stats and AI recommendations. Admin needs users, roles, webinars, recordings, analytics and tariff controls.",
    items: ["Registrations and attendees", "Average watch time", "Peak online"],
  },
  {
    title: "Premium and post-MVP",
    body:
      "Premium adds custom branding, domain, AI features, extra themes, branded emails, multiple organizations, API and webhooks. Later: Stage Mode, Whiteboard, Breakout Rooms, realtime translation, captions, RTMP, OBS, Zapier, CRM/LMS and mobile apps.",
  },
];

const commercialMvpCardsRu: DocCard[] = [
  {
    title: "Основа платформы",
    body:
      "Регистрация, вход, Google OAuth, GitHub OAuth, восстановление пароля, сохранение сессии, профиль, аватар, имя, описание, язык, часовой пояс и онбординг организации.",
    items: ["Создание Workspace", "Owner, Admin, Moderator, Member", "Приглашения и управление ролями"],
  },
  {
    title: "Управление вебинарами",
    body:
      "Название, описание, баннер, дата, время, длительность, часовой пояс, публичный/приватный режим, пароль, лимит участников, редактирование, удаление, копирование и сохранение как шаблон.",
    items: ["Страница ожидания", "Тест микрофона/камеры/интернета", "Шаблоны вебинаров"],
  },
  {
    title: "Комната вебинара",
    body:
      "Камера, микрофон, демонстрация экрана, несколько ведущих, смена камеры/микрофона и управление правами участников.",
    items: ["Только ведущий", "Несколько ведущих", "Свободный режим"],
  },
  {
    title: "Чат и модерация",
    body:
      "Сообщения, эмодзи, ответы, закрепы, ссылки, изображения, удаление сообщений, муты и баны. Зрители пишут только когда это разрешено настройками модерации.",
    items: ["Удалить сообщение", "Временный мут", "Кик и бан"],
  },
  {
    title: "AI как отличие",
    body:
      "AI Moderator, AI Assistant и AI Summary — главный шанс выделить Laminaria, поэтому они переходят из далёкого будущего в приоритеты MVP+.",
    items: ["Фильтр спама, ссылок и мата", "Ответы по материалам вебинара", "Саммари, Q&A и домашнее задание"],
  },
  {
    title: "Интерактив",
    body:
      "Коммерческому вебинару нужны Q&A, опросы и реакции, чтобы эфир ощущался живым и измеримым.",
    items: ["Лайки вопросов и статус отвечено", "Один или несколько вариантов ответа", "👍 ❤️ 👏 😂 🎉 реакции"],
  },
  {
    title: "Запись и файлы",
    body:
      "MVP должен поддерживать запись вебинара, просмотр записи, скачивание и файлы во время эфира.",
    items: ["PDF, DOCX, PPTX, ZIP", "Будущие AI-главы", "Будущая транскрипция и поиск"],
  },
  {
    title: "Email и лендинг вебинара",
    body:
      "Каждый вебинар получает публичную страницу и автоматическую email-цепочку: приглашение, напоминание, старт, окончание и спасибо за участие.",
    items: ["Баннер, ведущий, дата, регистрация", "Публичная ссылка", "Брендирование писем позже"],
  },
  {
    title: "Аналитика, dashboard и админка",
    body:
      "Dashboard показывает ближайшие вебинары, последние записи, статистику и AI-рекомендации. Админка — пользователей, роли, вебинары, записи, аналитику и тариф.",
    items: ["Регистрации и посетители", "Среднее время просмотра", "Пик онлайна"],
  },
  {
    title: "Premium и после MVP",
    body:
      "Premium добавляет собственный бренд, домен, AI-функции, темы, брендированные письма, несколько организаций, API и webhooks. Дальше: Stage Mode, Whiteboard, Breakout Rooms, realtime-перевод, captions, RTMP, OBS, Zapier, CRM/LMS и mobile apps.",
  },
];

const docs: Record<"en" | "ru", DocsContent> = {
  en: {
    badge: "Product & technical documentation",
    title: "Laminaria documentation",
    lead:
      "A paid-ready product plan for a webinar SaaS that can compete with Zoom, WebinarJam and Livestorm through AI, moderation and a fully animated ocean interface.",
    updated: "Updated to the commercial MVP roadmap",
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
              "Create a webinar, share the registration link, host the live room, moderate the audience, collect analytics and reuse the event as part of a repeatable business workflow.",
          },
          {
            title: "Market focus",
            body:
              "The product is prepared for the EU and US startup market while staying friendly for CIS users through Russian and English localization.",
          },
          {
            title: "Positioning",
            body:
              "Laminaria should not be a bare MVP. The first public version should already feel premium enough that creators can imagine paying for it.",
          },
        ],
      },
      {
        id: "functionality",
        eyebrow: "02 · Functionality",
        title: "Main product capabilities",
        body:
          "The baseline covers the full journey from account creation to a scheduled webinar, viewer registration, live room, chat, moderation, analytics and reusable team workflow.",
        cards: [
          {
            title: "User system",
            body:
              "Email and Google sign-in, GitHub OAuth target, password recovery, persistent sessions, onboarding, profile, avatar, language, timezone and workspace creation.",
            items: ["Organizer accounts", "Viewer participation", "Team roles"],
          },
          {
            title: "Webinar creation",
            body:
              "Organizers can create scheduled webinars, set title, description, banner, language, time, duration, visibility, password, attendee limit and landing page content.",
            items: ["Public registration link", "Countdown page", "Shareable viewer flow"],
          },
          {
            title: "Live room",
            body:
              "Hosts get camera, microphone, screen sharing, chat controls, quality options and room modes; viewers join without camera or microphone unless invited.",
            items: ["Audience counter", "Chat permissions", "Screen + camera layout"],
          },
          {
            title: "Moderation",
            body:
              "Admins and moderators can delete messages, mute, ban, kick, invite speakers and manage blocked lists inside and outside the webinar.",
            items: ["Temporary mute", "Temporary or permanent ban", "Unban and unmute lists"],
          },
          {
            title: "AI layer",
            body:
              "AI Moderator, AI Assistant and AI Summary define the MVP+ differentiation: fewer manual tasks for hosts and more value after the event.",
          },
          {
            title: "Analytics and notifications",
            body:
              "Registration data, attendance, names, emails and phone numbers feed webinar analytics. In-app notifications support team invites and future collaboration flows.",
          },
        ],
      },
      {
        id: "commercialMvp",
        eyebrow: "03 · Paid-ready MVP",
        title: "Comparison with the new MVP plan",
        body:
          "The earlier documentation was too small: it described a usable test product. The corrected roadmap raises Laminaria to a commercial SaaS MVP that can be sold to early users.",
        cards: commercialMvpCardsEn,
      },
      {
        id: "pricing",
        eyebrow: "04 · Pricing",
        title: "Commercial model",
        body:
          "Pricing starts simple, but the feature split now matches a real SaaS ladder: free testing, creator monetization, and business/team workflows.",
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
              "For solo creators and experts who need branded webinars, recording, analytics and a reliable production workflow.",
            items: ["More attendees", "Branding", "Analytics"],
          },
          {
            title: "Business · $49/month",
            body:
              "For teams that need roles, moderation, recordings, admin controls, deeper analytics, automation and integrations.",
            items: ["Teams", "Advanced moderation", "Commercial analytics"],
          },
        ],
      },
      {
        id: "design",
        eyebrow: "05 · Design",
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
              "Landing, auth, dashboard, webinar creation, public registration, countdown, prejoin, live room, teams, admin, recordings and analytics.",
          },
          {
            title: "Responsive UX",
            body:
              "Mobile must be a first-class surface: no overflow, readable controls, stacked panels and thumb-friendly actions.",
          },
        ],
      },
      {
        id: "stack",
        eyebrow: "06 · Stack",
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
        eyebrow: "07 · Architecture",
        title: "System architecture",
        body:
          "The MVP stays close to a modular monolith: faster to ship, easier to debug and ready to split into services when usage grows.",
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
              "Coordinates chat, viewer counts, Q&A, polls, reactions, moderation events, room state and live notifications.",
          },
          {
            title: "Data model",
            body:
              "Main entities include users, sessions, workspaces, teams, memberships, webinars, registrations, questions, polls, recordings, chat messages, bans, mutes and analytics events.",
          },
        ],
      },
      {
        id: "security",
        eyebrow: "08 · Security",
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
              "Owners, admins, moderators, speakers, members and viewers receive different permissions for room controls, chat and administrative actions.",
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
        eyebrow: "09 · Roadmap",
        title: "Final MVP roadmap",
        body:
          "The roadmap is now split into MVP v1.0, MVP+ and post-MVP. MVP v1.0 is no longer just a demo: it is the first commercial version for paid early users.",
        cards: [
          {
            title: "MVP v1.0",
            body:
              "Authorization and workspace, webinar creation, webinar room, video/audio, screen sharing, chat, Q&A, polls, recording, webinar landing page, email notifications, analytics and dashboard.",
            items: ["Core SaaS loop", "Host + viewer flow", "Commercial webinar baseline"],
          },
          {
            title: "MVP+ differentiators",
            body:
              "AI Moderator, AI Assistant, AI Summary, additional themes, fully animated ocean interface, extended analytics, recording search, AI chapters and webinar transcription.",
            items: ["AI as the main moat", "Marine design as brand identity", "Better post-event value"],
          },
          {
            title: "After MVP revenue",
            body:
              "Stage Mode, Whiteboard, Breakout Rooms, AI Translator, Live Captions, RTMP, OBS integration, API, Zapier, CRM/LMS integrations and mobile apps.",
            items: ["Expansion features", "Integrations", "Enterprise readiness"],
          },
        ],
      },
    ],
  },
  ru: {
    badge: "Продуктовая и техническая документация",
    title: "Документация Laminaria",
    lead:
      "Коммерческий план webinar SaaS, который может конкурировать с Zoom, WebinarJam и Livestorm за счёт AI, модерации и полностью анимированного морского интерфейса.",
    updated: "Обновлено под коммерческую MVP-дорожную карту",
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
              "Создать вебинар, выдать ссылку регистрации, провести эфир, модерировать зрителей, собрать аналитику и повторно использовать мероприятие как часть бизнес-процесса.",
          },
          {
            title: "Фокус рынка",
            body:
              "Продукт готовится под стартап-рынок ЕС и США, но остаётся удобным для СНГ благодаря русской и английской локализации.",
          },
          {
            title: "Позиционирование",
            body:
              "Laminaria не должна быть голым MVP. Первая публичная версия уже должна ощущаться достаточно премиально, чтобы создатели могли представить оплату.",
          },
        ],
      },
      {
        id: "functionality",
        eyebrow: "02 · Функциональность",
        title: "Основные возможности",
        body:
          "Базовая версия закрывает путь от создания аккаунта до запланированного вебинара, регистрации зрителей, комнаты эфира, чата, модерации, аналитики и командного workflow.",
        cards: [
          {
            title: "Система пользователей",
            body:
              "Вход по почте и через Google, цель по GitHub OAuth, восстановление пароля, сохранение сессии, онбординг, профиль, аватар, язык, часовой пояс и создание workspace.",
            items: ["Аккаунты организаторов", "Участие зрителей", "Командные роли"],
          },
          {
            title: "Создание вебинара",
            body:
              "Организатор задаёт название, описание, баннер, язык, дату, время, длительность, видимость, пароль, лимит участников и контент landing page.",
            items: ["Публичная ссылка", "Страница обратного отсчёта", "Удобный путь зрителя"],
          },
          {
            title: "Комната эфира",
            body:
              "Ведущий получает камеру, микрофон, демонстрацию экрана, управление чатом, качеством и режимами комнаты. Зритель входит без камеры и микрофона, пока его не пригласили.",
            items: ["Счётчик зрителей", "Разрешения чата", "Экран + камера ведущего"],
          },
          {
            title: "Модерация",
            body:
              "Админы и модераторы могут удалять сообщения, мутить, банить, кикать, приглашать спикеров и управлять списками ограничений во время и вне вебинара.",
            items: ["Временный мут", "Временный или вечный бан", "Списки разбана и размута"],
          },
          {
            title: "AI-слой",
            body:
              "AI Moderator, AI Assistant и AI Summary — главные отличия MVP+: меньше ручной работы для ведущего и больше пользы после эфира.",
          },
          {
            title: "Аналитика и уведомления",
            body:
              "Данные регистрации, посещаемость, имена, почты и телефоны уходят в аналитику вебинаров. Внутренние уведомления поддерживают приглашения в команды и будущую коллаборацию.",
          },
        ],
      },
      {
        id: "commercialMvp",
        eyebrow: "03 · Платёжеспособный MVP",
        title: "Сравнение с новым MVP-планом",
        body:
          "Прошлая документация была слишком маленькой: она описывала рабочий тестовый продукт. Исправленная дорожная карта поднимает Laminaria до коммерческого SaaS MVP, который можно продавать ранним пользователям.",
        cards: commercialMvpCardsRu,
      },
      {
        id: "pricing",
        eyebrow: "04 · Тарифы",
        title: "Коммерческая модель",
        body:
          "Тарифы остаются простыми, но теперь структура функций похожа на реальную SaaS-лестницу: тестирование, монетизация создателей и командная бизнес-работа.",
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
              "Для создателей и экспертов, которым нужны брендирование, записи, аналитика и более надёжный рабочий процесс.",
            items: ["Больше участников", "Брендинг", "Аналитика"],
          },
          {
            title: "Business · $49/мес",
            body:
              "Для команд: роли, модерация, записи, админ-контроль, расширенная аналитика, автоматизация и интеграции.",
            items: ["Команды", "Продвинутая модерация", "Коммерческая аналитика"],
          },
        ],
      },
      {
        id: "design",
        eyebrow: "05 · Дизайн",
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
              "Лендинг, вход, регистрация, дашборд, создание вебинара, публичная регистрация, обратный отсчёт, prejoin, эфир, команды, админка, записи и аналитика.",
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
        eyebrow: "06 · Стек",
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
        eyebrow: "07 · Архитектура",
        title: "Архитектура системы",
        body:
          "MVP остаётся близким к модульному монолиту: быстрее выпускать, проще отлаживать и легче разделить на сервисы, когда появится нагрузка.",
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
              "Синхронизирует чат, счётчик зрителей, Q&A, опросы, реакции, события модерации, состояние комнаты и живые уведомления.",
          },
          {
            title: "Модель данных",
            body:
              "Основные сущности: users, sessions, workspaces, teams, memberships, webinars, registrations, questions, polls, recordings, chat messages, bans, mutes и analytics events.",
          },
        ],
      },
      {
        id: "security",
        eyebrow: "08 · Безопасность",
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
              "Owners, admins, moderators, speakers, members и viewers получают разные права на управление эфиром, чатом и админ-действиями.",
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
        eyebrow: "09 · Roadmap",
        title: "Итоговая дорожная карта MVP",
        body:
          "Дорожная карта теперь разделена на MVP v1.0, MVP+ и post-MVP. MVP v1.0 больше не демо, а первая коммерческая версия для ранних платящих пользователей.",
        cards: [
          {
            title: "MVP v1.0",
            body:
              "Авторизация и Workspace, создание вебинаров, комната вебинара, видео/аудио, демонстрация экрана, чат, Q&A, опросы, запись, лендинг вебинара, email-уведомления, аналитика и Dashboard.",
            items: ["Core SaaS loop", "Путь ведущего и зрителя", "Коммерческая база вебинара"],
          },
          {
            title: "MVP+ отличия",
            body:
              "AI Moderator, AI Assistant, AI Summary, дополнительные темы, полностью анимированный морской интерфейс, расширенная аналитика, поиск по записям, AI-главы и транскрипция.",
            items: ["AI как главный moat", "Морской дизайн как бренд", "Больше пользы после эфира"],
          },
          {
            title: "После первых денег",
            body:
              "Stage Mode, Whiteboard, Breakout Rooms, AI Translator, Live Captions, RTMP, OBS Integration, API, Zapier, CRM/LMS интеграции и мобильные приложения.",
            items: ["Расширение продукта", "Интеграции", "Готовность к enterprise"],
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
