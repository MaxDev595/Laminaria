"use client";

import {
  ArrowUpRight,
  Captions,
  ChartNoAxesCombined,
  Check,
  ChevronDown,
  CircleGauge,
  Globe2,
  LockKeyhole,
  MessageCircleMore,
  Mic2,
  Radio,
  ShieldCheck,
  Sparkles,
  UsersRound,
  Video,
  Waves,
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
            <motion.p className="hero__subtitle" variants={reveal}>{t("landing.subtitle")}</motion.p>
            <motion.div className="hero__actions" variants={reveal}>
              <Link href="/sign-up">
                <Button size="lg">{t("landing.primaryCta")}<ArrowUpRight size={18} aria-hidden="true" /></Button>
              </Link>
              <a className="secondary-link" href="#workflow">
                {t("landing.secondaryCta")}<ChevronDown size={18} aria-hidden="true" />
              </a>
            </motion.div>
            <motion.p className="hero__trust" variants={reveal}>
              <Globe2 size={17} aria-hidden="true" />{t("landing.trusted")}
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
            <motion.span className="section-kicker" variants={reveal}><Waves size={17} />{t("landing.controlTitle")}</motion.span>
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
            <FeatureTile icon={<Video />} title={locale === "ru" ? "Сцена и трансляция" : "Stage and media"} body={locale === "ru" ? "LiveKit управляет только медиапотоками и качеством соединения." : "LiveKit owns media and connection quality — nothing more."} />
            <FeatureTile icon={<UsersRound />} title={locale === "ru" ? "Точные роли" : "Precise roles"} body={locale === "ru" ? "Зритель остаётся зрителем, пока ведущий явно не пригласит его на сцену." : "An attendee stays receive-only until a host explicitly invites them on stage."} />
            <FeatureTile icon={<MessageCircleMore />} title={locale === "ru" ? "Чистый разговор" : "A cleaner conversation"} body={locale === "ru" ? "Чат, вопросы и опросы проверяются сервером до публикации." : "Chat, Q&A, and polls are server-validated before they reach the room."} />
            <FeatureTile icon={<Sparkles />} title={locale === "ru" ? "AI с границами" : "AI with boundaries"} body={locale === "ru" ? "Ассистент всегда отмечен, учитывает материалы и честно говорит, когда данных мало." : "The assistant is always labeled, grounded in materials, and explicit about uncertainty."} />
          </motion.div>
        </section>

        <section className="workflow-section" id="workflow">
          <div className="section-wrap">
            <motion.div className="section-heading" initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.5 }}>
              <motion.span variants={reveal} className="section-kicker">{t("landing.platformEyebrow")}</motion.span>
              <motion.h2 variants={reveal}>{t("landing.platformTitle")}</motion.h2>
            </motion.div>
            <div className="workflow-track">
              <WorkflowStep number="01" icon={<CircleGauge />} title={t("landing.stepCreate")} body={t("landing.stepCreateBody")} />
              <WorkflowStep number="02" icon={<Radio />} title={t("landing.stepLive")} body={t("landing.stepLiveBody")} />
              <WorkflowStep number="03" icon={<ChartNoAxesCombined />} title={t("landing.stepLearn")} body={t("landing.stepLearnBody")} />
            </div>
          </div>
        </section>

        <section className="global-section section-wrap" id="global">
          <motion.div className="global-orbit" initial={{ opacity: 0, rotate: -5 }} whileInView={{ opacity: 1, rotate: 0 }} viewport={{ once: true }}>
            <div className="globe-core"><Globe2 size={42} aria-hidden="true" /><span>EN</span><span>RU</span></div>
            <div className="orbit orbit--one" aria-hidden="true" />
            <div className="orbit orbit--two" aria-hidden="true" />
            <span className="timezone timezone--one">UTC−8</span>
            <span className="timezone timezone--two">UTC+1</span>
            <span className="timezone timezone--three">UTC+5</span>
          </motion.div>
          <motion.div className="global-copy" initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.45 }} transition={{ staggerChildren: 0.1 }}>
            <motion.span className="section-kicker" variants={reveal}>{t("shell.global")}</motion.span>
            <motion.h2 variants={reveal}>{t("landing.globalTitle")}</motion.h2>
            <motion.p variants={reveal}>{t("landing.globalBody")}</motion.p>
            <motion.ul variants={reveal} className="check-list">
              <li><Check size={16} />{locale === "ru" ? "Переключение языка без перезагрузки" : "Language switching without a reload"}</li>
              <li><Check size={16} />{locale === "ru" ? "Дата и время в часовом поясе посетителя" : "Date and time in every visitor’s time zone"}</li>
              <li><Check size={16} />{locale === "ru" ? "Зрительский сценарий для desktop и mobile" : "Attendee flow shaped for desktop and mobile"}</li>
            </motion.ul>
          </motion.div>
        </section>

        <section className="security-section" id="security">
          <div className="section-wrap security-card">
            <div className="security-card__icon"><ShieldCheck size={32} aria-hidden="true" /></div>
            <div>
              <span className="section-kicker">{t("landing.infrastructure")}</span>
              <h2>{t("landing.infrastructure")}</h2>
              <p>{t("landing.infrastructureBody")}</p>
            </div>
            <div className="security-points">
              <span><LockKeyhole size={16} />{locale === "ru" ? "Защищённые сессии" : "Secure server sessions"}</span>
              <span><Mic2 size={16} />{locale === "ru" ? "Короткоживущие права" : "Short-lived media grants"}</span>
              <span><Captions size={16} />{locale === "ru" ? "Доступность по умолчанию" : "Accessibility by default"}</span>
            </div>
          </div>
        </section>

        <section className="final-cta section-wrap">
          <motion.div className="final-cta__card" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <div className="final-cta__glow" aria-hidden="true" />
            <Logo compact />
            <h2>{t("landing.ctaTitle")}</h2>
            <p>{t("landing.ctaBody")}</p>
            <Link href="/sign-up"><Button size="lg">{t("landing.primaryCta")}<ArrowUpRight size={18} /></Button></Link>
          </motion.div>
        </section>
      </main>
      <footer className="marketing-footer section-wrap">
        <Logo />
        <p>© 2026 Laminaria. {locale === "ru" ? "Комната для идей, которым нужен масштаб." : "Room for ideas that need to travel."}</p>
        <div><Link href="/sign-in">{t("auth.signIn")}</Link><a href="#security">{t("shell.security")}</a></div>
      </footer>
    </div>
  );
}

function RoomIllustration({ locale, t }: { locale: string; t: ReturnType<typeof useTranslations> }) {
  return (
    <motion.div className="room-illustration" whileHover={{ y: -4 }} transition={{ duration: 0.3 }}>
      <div className="room-illustration__topbar">
        <div><span className="status-pulse" /><strong>{t("landing.roomReady")}</strong></div>
        <span className="room-time">00:42:18</span>
      </div>
      <div className="room-stage">
        <div className="stage-light" aria-hidden="true" />
        <div className="speaker-mark"><span /><span /><span /></div>
        <div className="stage-caption"><Radio size={14} />{t("landing.liveCaption")}</div>
      </div>
      <div className="room-controls">
        <span className="room-control room-control--active"><Mic2 size={17} /></span>
        <span className="room-control room-control--active"><Video size={17} /></span>
        <span className="room-control"><Captions size={17} /></span>
        <span className="room-control"><MessageCircleMore size={17} /></span>
      </div>
      <motion.div className="permission-float permission-float--audience" animate={{ y: [0, -4, 0] }} transition={{ duration: 5, repeat: Infinity }}>
        <UsersRound size={16} /><span>{t("landing.audienceMode")}</span><Check size={14} />
      </motion.div>
      <motion.div className="permission-float permission-float--speaker" animate={{ y: [0, 5, 0] }} transition={{ duration: 6, repeat: Infinity, delay: 0.7 }}>
        <Mic2 size={16} /><span>{t("landing.speakerMode")}</span>
      </motion.div>
      <span className="room-locale">{locale.toUpperCase()}</span>
    </motion.div>
  );
}

function FeatureTile({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <motion.article className="feature-tile" variants={reveal} whileHover={{ y: -5 }}>
      <span className="feature-tile__icon" aria-hidden="true">{icon}</span>
      <h3>{title}</h3><p>{body}</p>
    </motion.article>
  );
}

function WorkflowStep({ number, icon, title, body }: { number: string; icon: React.ReactNode; title: string; body: string }) {
  return (
    <motion.article className="workflow-step" initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.4 }} variants={reveal}>
      <span className="workflow-step__number">{number}</span>
      <span className="workflow-step__icon" aria-hidden="true">{icon}</span>
      <h3>{title}</h3><p>{body}</p>
    </motion.article>
  );
}
