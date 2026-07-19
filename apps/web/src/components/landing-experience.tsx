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
import { motion, useScroll, useSpring } from "motion/react";
import { useLocale, useTranslations } from "next-intl";
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
              title={locale === "ru" ? "РЎС†РµРЅР° Рё С‚СЂР°РЅСЃР»СЏС†РёСЏ" : "Stage and media"}
              body={
                locale === "ru"
                  ? "LiveKit СѓРїСЂР°РІР»СЏРµС‚ С‚РѕР»СЊРєРѕ РјРµРґРёР°РїРѕС‚РѕРєР°РјРё Рё РєР°С‡РµСЃС‚РІРѕРј СЃРѕРµРґРёРЅРµРЅРёСЏ."
                  : "LiveKit owns media and connection quality вЂ” nothing more."
              }
            />
            <FeatureTile
              icon={<UsersRound />}
              title={locale === "ru" ? "РўРѕС‡РЅС‹Рµ СЂРѕР»Рё" : "Precise roles"}
              body={
                locale === "ru"
                  ? "Р—СЂРёС‚РµР»СЊ РѕСЃС‚Р°С‘С‚СЃСЏ Р·СЂРёС‚РµР»РµРј, РїРѕРєР° РІРµРґСѓС‰РёР№ СЏРІРЅРѕ РЅРµ РїСЂРёРіР»Р°СЃРёС‚ РµРіРѕ РЅР° СЃС†РµРЅСѓ."
                  : "An attendee stays receive-only until a host explicitly invites them on stage."
              }
            />
            <FeatureTile
              icon={<MessageCircleMore />}
              title={locale === "ru" ? "Р§РёСЃС‚С‹Р№ СЂР°Р·РіРѕРІРѕСЂ" : "A cleaner conversation"}
              body={
                locale === "ru"
                  ? "Р§Р°С‚, РІРѕРїСЂРѕСЃС‹ Рё РѕРїСЂРѕСЃС‹ РїСЂРѕРІРµСЂСЏСЋС‚СЃСЏ СЃРµСЂРІРµСЂРѕРј РґРѕ РїСѓР±Р»РёРєР°С†РёРё."
                  : "Chat, Q&A, and polls are server-validated before they reach the room."
              }
            />
            <FeatureTile
              icon={<ChartNoAxesCombined />}
              title={locale === "ru" ? "РђРЅР°Р»РёС‚РёРєР° Р·Р°СЏРІРѕРє" : "Registration analytics"}
              body={
                locale === "ru"
                  ? "РџРѕСЃР»Рµ СЂРµРіРёСЃС‚СЂР°С†РёРё РѕСЂРіР°РЅРёР·Р°С‚РѕСЂ РІРёРґРёС‚ РёРјСЏ, email, С‚РµР»РµС„РѕРЅ Рё СЃС‚Р°С‚СѓСЃ СѓС‡Р°СЃС‚РЅРёРєР°."
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
            <span className="timezone timezone--one">UTCв€’8</span>
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
                  ? "РџРµСЂРµРєР»СЋС‡РµРЅРёРµ СЏР·С‹РєР° Р±РµР· РїРµСЂРµР·Р°РіСЂСѓР·РєРё"
                  : "Language switching without a reload"}
              </li>
              <li>
                <Check size={16} />
                {locale === "ru"
                  ? "Р”Р°С‚Р° Рё РІСЂРµРјСЏ РІ С‡Р°СЃРѕРІРѕРј РїРѕСЏСЃРµ РїРѕСЃРµС‚РёС‚РµР»СЏ"
                  : "Date and time in every visitorвЂ™s time zone"}
              </li>
              <li>
                <Check size={16} />
                {locale === "ru"
                  ? "Р—СЂРёС‚РµР»СЊСЃРєРёР№ СЃС†РµРЅР°СЂРёР№ РґР»СЏ desktop Рё mobile"
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
                {locale === "ru" ? "Р—Р°С‰РёС‰С‘РЅРЅС‹Рµ СЃРµСЃСЃРёРё" : "Secure server sessions"}
              </span>
              <span>
                <Mic2 size={16} />
                {locale === "ru" ? "РљРѕСЂРѕС‚РєРѕР¶РёРІСѓС‰РёРµ РїСЂР°РІР°" : "Short-lived media grants"}
              </span>
              <span>
                <Captions size={16} />
                {locale === "ru" ? "Р”РѕСЃС‚СѓРїРЅРѕСЃС‚СЊ РїРѕ СѓРјРѕР»С‡Р°РЅРёСЋ" : "Accessibility by default"}
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
            <h2>{locale === "ru" ? "РЎРѕР·РґР°Р№С‚Рµ РїСЂРѕСЃС‚СЂР°РЅСЃС‚РІРѕ, РІ РєРѕС‚РѕСЂРѕРµ С…РѕС‡РµС‚СЃСЏ РІРѕР№С‚Рё." : "Create a space people want to enter."}</h2>
            <p>
              {locale === "ru"
                ? "РќР°С‡РЅРёС‚Рµ СЃРѕ Starter РІСЃРµРіРѕ Р·Р° $3/РјРµСЃСЏС†. РљРѕРіРґР° Р°СѓРґРёС‚РѕСЂРёСЏ РІС‹СЂР°СЃС‚РµС‚ вЂ” РІС‹ СЃРјРѕР¶РµС‚Рµ РїРµСЂРµР№С‚Рё РЅР° Р±РѕР»РµРµ РІС‹СЃРѕРєРёР№ С‚Р°СЂРёС„ РІ Р»СЋР±РѕР№ РјРѕРјРµРЅС‚."
                : "Start with Starter for just $3/month. When your audience grows, you can upgrade anytime."}
            </p>
            <Link href="/sign-up">
              <Button size="lg">
                {locale === "ru" ? "РЎРѕР·РґР°С‚СЊ РїСЂРѕСЃС‚СЂР°РЅСЃС‚РІРѕ" : "Create space"}
                <ArrowUpRight size={18} />
              </Button>
            </Link>
          </motion.div>
        </section>
      </main>
      <footer className="marketing-footer section-wrap">
        <Logo />
        <p>
          В© 2026 Laminaria.{" "}
          {locale === "ru"
            ? "РљРѕРјРЅР°С‚Р° РґР»СЏ РёРґРµР№, РєРѕС‚РѕСЂС‹Рј РЅСѓР¶РµРЅ РјР°СЃС€С‚Р°Р±."
            : "Room for ideas that need to travel."}
        </p>
        <div>
          <Link href="/docs">{locale === "ru" ? "Р”РѕРєСѓРјРµРЅС‚Р°С†РёСЏ" : "Docs"}</Link>
          <Link href="/sign-in">{t("auth.signIn")}</Link>
          <a href="#security">{t("shell.security")}</a>
        </div>
      </footer>
    </div>
  );
}

function DemoPreview({ locale }: { locale: string }) {
  const isRu = locale === "ru";
  const steps = isRu
    ? ["РЎРѕР·РґР°РЅРёРµ РІРµР±РёРЅР°СЂР°", "Р—Р°РїСѓСЃРє СЌС„РёСЂР°", "Р§Р°С‚ Рё AI", "РђРЅР°Р»РёС‚РёРєР°"]
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
          {isRu ? "Р”РµРјРѕ РїСЂРѕРґСѓРєС‚Р°" : "Product demo"}
        </motion.span>
        <motion.h2 variants={reveal}>
          {isRu ? "РџРѕСЃРјРѕС‚СЂРёС‚Рµ, РєР°Рє Laminaria СЂР°Р±РѕС‚Р°РµС‚ Р·Р° 30 СЃРµРєСѓРЅРґ" : "See Laminaria in action in 30 seconds"}
        </motion.h2>
        <motion.p variants={reveal}>
          {isRu
            ? "РћРґРёРЅ РїР»Р°РІРЅС‹Р№ СЃС†РµРЅР°СЂРёР№: СЃРѕР·РґР°РЅРёРµ РІРµР±РёРЅР°СЂР°, Р·Р°РїСѓСЃРє СЌС„РёСЂР°, Р¶РёРІРѕР№ С‡Р°С‚, AI-РїРѕРјРѕС‰РЅРёРє Рё Р°РЅР°Р»РёС‚РёРєР° РїРѕСЃР»Рµ СЃРѕР±С‹С‚РёСЏ."
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
              <strong>{isRu ? "РќРѕРІС‹Р№ РІРµР±РёРЅР°СЂ" : "New webinar"}</strong>
              <span>{isRu ? "30 СЃРµРє РЅР°СЃС‚СЂРѕР№РєРё" : "30 sec setup"}</span>
            </div>
            <div className="demo-card demo-card--live">
              <Video size={22} />
              <strong>{isRu ? "Р­С„РёСЂ Р·Р°РїСѓС‰РµРЅ" : "Live room is ready"}</strong>
              <span>HD В· Chat В· Screen</span>
            </div>
            <div className="demo-card demo-card--ai">
              <Bot size={22} />
              <strong>AI Assistant</strong>
              <span>{isRu ? "РЎРѕР±СЂР°Р» 4 РІРѕРїСЂРѕСЃР°" : "Grouped 4 questions"}</span>
            </div>
            <div className="demo-card demo-card--analytics">
              <BarChart3 size={22} />
              <strong>{isRu ? "РђРЅР°Р»РёС‚РёРєР°" : "Analytics"}</strong>
              <span>{isRu ? "РџРѕСЃРµС‚РёС‚РµР»Рё Рё Р·Р°СЏРІРєРё" : "Attendance and leads"}</span>
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
    ["AI Moderator", <ShieldCheck key="moderator" />],
    ["AI Assistant", <Bot key="bot" />],
    ["Recording", <Clapperboard key="recording" />],
    ["Analytics", <ChartNoAxesCombined key="analytics" />],
    ["Branding", <Palette key="branding" />],
    ["Multi-language", <Globe2 key="language" />],
    ["Mobile", <Smartphone key="mobile" />],
  ] as const;

  return (
    <section className="mvp-features section-wrap" id="features">
      <SectionHead
        kicker={isRu ? "Р’РѕР·РјРѕР¶РЅРѕСЃС‚Рё MVP" : "MVP features"}
        title={isRu ? "РџРѕР»РЅС‹Р№ РЅР°Р±РѕСЂ РґР»СЏ РїРµСЂРІРѕРіРѕ РєРѕРјРјРµСЂС‡РµСЃРєРѕРіРѕ СЂРµР»РёР·Р°" : "The complete feature set for a commercial MVP"}
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
  const plans = [
    {
      name: "Starter",
      price: "$3",
      note: isRu ? "РґР»СЏ РїСЂРѕРІРµСЂРєРё СЃРїСЂРѕСЃР°" : "to validate demand",
      items: ["Up to 25 participants", "HD Video", "Chat", "Screen Share"],
      cta: isRu ? "РќР°С‡Р°С‚СЊ" : "Start",
    },
    {
      name: "Pro",
      price: "$12",
      note: isRu ? "СЃР°РјС‹Р№ РїРѕРїСѓР»СЏСЂРЅС‹Р№" : "most popular",
      featured: true,
      items: ["Up to 150 participants", "AI", "Recording", "Analytics", "Polls", "Branding"],
      cta: isRu ? "Р’С‹Р±СЂР°С‚СЊ Pro" : "Choose Pro",
    },
    {
      name: "Business",
      price: "$29",
      note: isRu ? "РґР»СЏ РєРѕРјР°РЅРґ" : "for teams",
      items: ["Up to 1000 participants", "API", "White Label", "Team", "All AI features"],
      cta: isRu ? "Р”Р»СЏ Р±РёР·РЅРµСЃР°" : "Go Business",
    },
  ];

  return (
    <section className="landing-pricing section-wrap" id="pricing">
      <SectionHead
        kicker={isRu ? "РўР°СЂРёС„С‹" : "Pricing"}
        title={isRu ? "РџСЂРѕСЃС‚Р°СЏ С†РµРЅР°, С‡С‚РѕР±С‹ Р±С‹СЃС‚СЂРѕ РїСЂРѕРІРµСЂРёС‚СЊ СЂС‹РЅРѕРє" : "Simple pricing to validate the market fast"}
      />
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
                {isRu ? "РџРѕРїСѓР»СЏСЂРЅС‹Р№" : "Popular"}
              </span>
            ) : null}
            <h3>{plan.name}</h3>
            <div className="landing-price-card__price">
              <strong>{plan.price}</strong>
              <span>/month</span>
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
        kicker={isRu ? "РЎСЂР°РІРЅРµРЅРёРµ" : "Comparison"}
        title={isRu ? "Р§РµРј Laminaria РІС‹РґРµР»СЏРµС‚СЃСЏ СѓР¶Рµ РІ MVP" : "Where Laminaria already stands out"}
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
  const items = isRu
    ? [
        ["РЎРєРѕР»СЊРєРѕ СѓС‡Р°СЃС‚РЅРёРєРѕРІ РјРѕР¶РЅРѕ РїСЂРёРіР»Р°СЃРёС‚СЊ?", "Starter РїРѕРґРґРµСЂР¶РёРІР°РµС‚ РґРѕ 25 СѓС‡Р°СЃС‚РЅРёРєРѕРІ, Pro РґРѕ 150, Business РґРѕ 1000."],
        ["Р•СЃС‚СЊ Р»Рё Р·Р°РїРёСЃСЊ РІРµР±РёРЅР°СЂР°?", "Р”Р°, Р·Р°РїРёСЃСЊ РІС…РѕРґРёС‚ РІ Pro Рё Business."],
        ["Р Р°Р±РѕС‚Р°РµС‚ Р»Рё РЅР° С‚РµР»РµС„РѕРЅРµ?", "Р”Р°, Р»РµРЅРґРёРЅРі, СЂРµРіРёСЃС‚СЂР°С†РёСЏ Рё РєРѕРјРЅР°С‚Р° Р°РґР°РїС‚РёСЂРѕРІР°РЅС‹ РїРѕРґ РјРѕР±РёР»СЊРЅС‹Рµ СѓСЃС‚СЂРѕР№СЃС‚РІР°."],
        ["РќСѓР¶РЅРѕ Р»Рё С‡С‚Рѕ-С‚Рѕ СѓСЃС‚Р°РЅР°РІР»РёРІР°С‚СЊ?", "РќРµС‚, РІСЃС‘ СЂР°Р±РѕС‚Р°РµС‚ РІ Р±СЂР°СѓР·РµСЂРµ."],
        ["РњРѕР¶РЅРѕ Р»Рё Р±СЂРµРЅРґРёСЂРѕРІР°С‚СЊ РІРµР±РёРЅР°СЂ?", "Р”Р°, Р±СЂРµРЅРґРёРЅРі РґРѕСЃС‚СѓРїРµРЅ РІ Pro Рё Business."],
        ["РњРѕР¶РЅРѕ Р»Рё РѕС‚РјРµРЅРёС‚СЊ РїРѕРґРїРёСЃРєСѓ?", "Р”Р°, РѕС‚РјРµРЅРёС‚СЊ РјРѕР¶РЅРѕ РІ Р»СЋР±РѕР№ РјРѕРјРµРЅС‚."],
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
      <SectionHead kicker="FAQ" title={isRu ? "РљРѕСЂРѕС‚РєРѕ Рѕ РіР»Р°РІРЅРѕРј" : "The essentials, answered"} />
      <div className="landing-faq__list">
        {items.map(([question, answer]) => (
          <details key={question}>
            <summary>
              {question}
              <ChevronDown size={18} />
            </summary>
            <p>{answer}</p>
          </details>
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
            <span>{locale === "ru" ? "Р’С‹" : "You"}</span>
          </div>
          <div className="room-mock-speaker is-guest">
            <span>{locale === "ru" ? "РЎРїРёРєРµСЂ" : "Speaker"}</span>
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
            {locale === "ru" ? "Р’С‹ РґРµРјРѕРЅСЃС‚СЂРёСЂСѓРµС‚Рµ СЌРєСЂР°РЅ" : "You are sharing your screen"}
          </span>
          <h3>{locale === "ru" ? "РљР°Рє Р·Р°РїСѓСЃРєР°С‚СЊ РІРµР±РёРЅР°СЂС‹, РєРѕС‚РѕСЂС‹Рµ РґРѕСЃРјР°С‚СЂРёРІР°СЋС‚" : "Run webinars people finish"}</h3>
          <p>{locale === "ru" ? "РџСЂР°РєС‚РёС‡РЅС‹Р№ С„РѕСЂРјР°С‚ РґР»СЏ РїСЂРѕРґР°Р¶, РѕР±СѓС‡РµРЅРёСЏ Рё РєРѕРјСЊСЋРЅРёС‚Рё." : "A practical format for sales, learning, and communities."}</p>
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
            {locale === "ru" ? "РћС‚Р»РёС‡РЅР°СЏ С‚РµРјР°" : "Great topic"}
          </p>
          <p className="is-you">
            <span>{locale === "ru" ? "Р’С‹" : "You"}</span>
            {locale === "ru" ? "РЎРµР№С‡Р°СЃ РїРѕРєР°Р¶Сѓ РЅР° СЃР»Р°Р№РґРµ." : "I'll show it on the slide."}
          </p>
          <div>
            <small>{locale === "ru" ? "РЎРѕРѕР±С‰РµРЅРёРµ..." : "Message..."}</small>
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

