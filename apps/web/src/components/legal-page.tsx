import { ArrowLeft, Mail, ShieldCheck } from "lucide-react";

import { Link } from "@/i18n/navigation";
import { Logo } from "@laminaria/ui";

type LegalKind = "privacy" | "terms" | "refund";

type LegalSection = {
  title: string;
  paragraphs: string[];
  items?: string[];
};

const content: Record<
  "en" | "ru",
  Record<LegalKind, { title: string; intro: string; sections: LegalSection[] }>
> = {
  en: {
    privacy: {
      title: "Privacy Policy",
      intro:
        "This policy explains what data Laminaria uses to provide webinars and how you can control it.",
      sections: [
        {
          title: "Data we process",
          paragraphs: [
            "We process the information you provide and the technical data required to operate the service.",
          ],
          items: [
            "Account and profile details, including name, email, avatar, language and time zone.",
            "Workspace, webinar, registration, chat, poll and moderation data.",
            "Audio, video, screen sharing and recordings when those features are enabled.",
            "Session, device, IP address, security and diagnostic information.",
            "Subscription status and billing references. Laminaria does not store full card details.",
          ],
        },
        {
          title: "Why we use it",
          paragraphs: [
            "We use data to authenticate users, deliver webinars, store recordings, provide analytics, prevent abuse, process subscriptions and support users.",
            "We do not sell personal data.",
          ],
        },
        {
          title: "Service providers and international transfers",
          paragraphs: [
            "Laminaria relies on infrastructure and processors such as Vercel, Render, Neon, LiveKit, Cloudflare R2, Paddle and configured email or identity providers. Data may be processed outside your country with safeguards required by applicable law.",
          ],
        },
        {
          title: "Retention and your choices",
          paragraphs: [
            "We retain data only while needed for the service, legal obligations, security and dispute resolution. Retention can also depend on the workspace plan and organizer settings.",
            "You can update profile information, export account data, close sessions and request account deletion in Settings. You may also contact us to request access, correction, deletion or restriction where applicable.",
          ],
        },
      ],
    },
    terms: {
      title: "Terms of Service",
      intro: "These terms apply when you access or use Laminaria.",
      sections: [
        {
          title: "Accounts and workspaces",
          paragraphs: [
            "You must provide accurate information, protect your account and be legally able to accept these terms. Workspace owners are responsible for their members, webinar configuration and audience communications.",
          ],
        },
        {
          title: "Acceptable use",
          paragraphs: [
            "You may not use Laminaria to break the law, violate rights, distribute malware, harass people, evade limits or disrupt the service.",
          ],
        },
        {
          title: "Your content",
          paragraphs: [
            "You keep ownership of content you upload or transmit. You grant Laminaria the limited permission needed to host, process, transmit and display that content solely to provide and secure the service.",
            "Organizers are responsible for obtaining participant notices and consents required for recordings, analytics and communications.",
          ],
        },
        {
          title: "Subscriptions and availability",
          paragraphs: [
            "Paid plans renew for the selected billing period until cancelled. Prices, taxes, limits and included features are shown before checkout.",
            "We work to keep Laminaria reliable, but internet, browser, device and third-party infrastructure failures can interrupt live media. The service is provided on an as-available basis to the extent permitted by law.",
          ],
        },
        {
          title: "Suspension and liability",
          paragraphs: [
            "We may restrict accounts that create security risk, abuse the service or materially breach these terms. Nothing in these terms excludes rights or liability that cannot legally be excluded.",
          ],
        },
      ],
    },
    refund: {
      title: "Cancellation & Refund Policy",
      intro:
        "Laminaria keeps cancellation straightforward and shows the result before you confirm it.",
      sections: [
        {
          title: "Cancel and refund",
          paragraphs: [
            "When the in-app “Cancel and refund” action is available and succeeds, the active subscription is cancelled immediately, the workspace returns to Free and a refund request for the latest eligible subscription payment is submitted to Paddle. Live refunds may require Paddle approval.",
            "A successful refund submission is not the same as the money reaching your bank. Banks and card networks commonly need several business days.",
          ],
        },
        {
          title: "Eligibility and exceptions",
          paragraphs: [
            "A payment cannot be refunded twice. Refunds may also be unavailable when the payment has already been refunded, disputed, reversed, made outside Paddle, or is otherwise ineligible under Paddle or payment-network rules.",
            "If the automatic action cannot complete, contact support with the workspace and payment details. We will review the request and applicable consumer law.",
          ],
        },
        {
          title: "After cancellation",
          paragraphs: [
            "Paid-only limits and features stop immediately after a successful cancellation and downgrade. Export or download anything you need before cancelling.",
          ],
        },
      ],
    },
  },
  ru: {
    privacy: {
      title: "Политика конфиденциальности",
      intro:
        "Здесь описано, какие данные Laminaria использует для проведения вебинаров и как вы можете ими управлять.",
      sections: [
        {
          title: "Какие данные мы обрабатываем",
          paragraphs: [
            "Мы обрабатываем предоставленные вами сведения и технические данные, необходимые для работы сервиса.",
          ],
          items: [
            "Данные аккаунта и профиля: имя, email, аватар, язык и часовой пояс.",
            "Данные рабочих пространств, вебинаров, регистраций, чата, опросов и модерации.",
            "Аудио, видео, демонстрацию экрана и записи, когда эти функции включены.",
            "Данные сессий, устройства, IP-адрес, сведения безопасности и диагностики.",
            "Статус подписки и платёжные идентификаторы. Laminaria не хранит полные данные карты.",
          ],
        },
        {
          title: "Для чего нужны данные",
          paragraphs: [
            "Мы используем данные для входа, проведения вебинаров, хранения записей, аналитики, защиты от злоупотреблений, оплаты подписок и поддержки.",
            "Мы не продаём персональные данные.",
          ],
        },
        {
          title: "Подрядчики и международная обработка",
          paragraphs: [
            "Laminaria использует инфраструктуру и обработчиков, включая Vercel, Render, Neon, LiveKit, Cloudflare R2, Paddle, а также подключённых провайдеров почты и входа. Данные могут обрабатываться за пределами вашей страны с гарантиями, требуемыми применимым правом.",
          ],
        },
        {
          title: "Хранение и ваши права",
          paragraphs: [
            "Мы храним данные столько, сколько необходимо для работы сервиса, выполнения закона, безопасности и разрешения споров. Срок также зависит от тарифа и настроек организатора.",
            "В Настройках можно изменить профиль, экспортировать данные, закрыть сессии и запросить удаление аккаунта. Также можно обратиться к нам за доступом, исправлением, удалением или ограничением обработки, если это предусмотрено законом.",
          ],
        },
      ],
    },
    terms: {
      title: "Условия использования",
      intro: "Эти условия действуют при доступе к Laminaria и использовании сервиса.",
      sections: [
        {
          title: "Аккаунты и рабочие пространства",
          paragraphs: [
            "Вы должны указывать достоверные сведения, защищать аккаунт и иметь право принять эти условия. Владельцы рабочих пространств отвечают за участников команды, настройки вебинаров и сообщения аудитории.",
          ],
        },
        {
          title: "Допустимое использование",
          paragraphs: [
            "Нельзя использовать Laminaria для нарушения закона и чужих прав, распространения вредоносного ПО, травли, обхода ограничений или нарушения работы сервиса.",
          ],
        },
        {
          title: "Ваш контент",
          paragraphs: [
            "Права на загруженный и передаваемый контент остаются у вас. Вы даёте Laminaria ограниченное разрешение хранить, обрабатывать, передавать и показывать его только для предоставления и защиты сервиса.",
            "Организатор обязан получить необходимые уведомления и согласия участников на запись, аналитику и коммуникации.",
          ],
        },
        {
          title: "Подписки и доступность",
          paragraphs: [
            "Платный тариф продлевается на выбранный период до отмены. Цена, налоги, лимиты и функции показываются до оплаты.",
            "Мы стремимся к стабильной работе, но интернет, браузер, устройство и сторонняя инфраструктура могут прерывать эфир. В пределах закона сервис предоставляется по мере доступности.",
          ],
        },
        {
          title: "Ограничение доступа и ответственности",
          paragraphs: [
            "Мы можем ограничить аккаунт, создающий угрозу безопасности, злоупотребляющий сервисом или существенно нарушающий эти условия. Условия не исключают права и ответственность, которые нельзя исключить по закону.",
          ],
        },
      ],
    },
    refund: {
      title: "Отмена и возврат оплаты",
      intro: "Laminaria делает отмену понятной и показывает результат до подтверждения.",
      sections: [
        {
          title: "Отмена и возврат",
          paragraphs: [
            "Если действие «Отменить и вернуть оплату» доступно и выполнено успешно, подписка отменяется сразу, Workspace переходит на Free, а запрос на возврат последнего подходящего платежа отправляется в Paddle. Возврат в рабочем окружении может потребовать одобрения Paddle.",
            "Успешно отправленный возврат ещё не означает поступление денег в банк. Банку и платёжной системе обычно нужно несколько рабочих дней.",
          ],
        },
        {
          title: "Условия и исключения",
          paragraphs: [
            "Один платёж нельзя вернуть дважды. Возврат также может быть недоступен, если платёж уже возвращён, оспорен, отменён, проведён вне Paddle или не соответствует правилам Paddle и платёжной системы.",
            "Если автоматическая отмена не завершилась, напишите в поддержку и укажите Workspace и платёж. Мы проверим запрос с учётом применимого законодательства о защите потребителей.",
          ],
        },
        {
          title: "После отмены",
          paragraphs: [
            "После успешной отмены платные лимиты и функции отключаются сразу. Экспортируйте и скачайте нужные материалы до отмены.",
          ],
        },
      ],
    },
  },
};

export function LegalPage({ locale, kind }: { locale: string; kind: LegalKind }) {
  const lang = locale === "ru" ? "ru" : "en";
  const page = content[lang][kind];

  return (
    <main className="legal-page">
      <header className="legal-page__header">
        <Link href="/" aria-label={lang === "ru" ? "На главную" : "Home"}>
          <Logo />
        </Link>
        <Link href="/" className="legal-page__back">
          <ArrowLeft size={17} />
          {lang === "ru" ? "На главную" : "Back home"}
        </Link>
      </header>
      <article className="legal-page__document">
        <span className="legal-page__eyebrow">
          <ShieldCheck size={17} />
          {lang === "ru" ? "Юридическая информация" : "Legal"}
        </span>
        <h1>{page.title}</h1>
        <p className="legal-page__intro">{page.intro}</p>
        <p className="legal-page__updated">
          {lang === "ru" ? "Обновлено: 24 июля 2026" : "Updated: July 24, 2026"}
        </p>
        {page.sections.map((section) => (
          <section key={section.title}>
            <h2>{section.title}</h2>
            {section.paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
            {section.items ? (
              <ul>
                {section.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : null}
          </section>
        ))}
        <aside className="legal-page__contact">
          <Mail size={18} />
          <div>
            <strong>{lang === "ru" ? "Вопросы и запросы" : "Questions and requests"}</strong>
            <a href="mailto:support@laminarias.com">support@laminarias.com</a>
          </div>
        </aside>
      </article>
    </main>
  );
}
