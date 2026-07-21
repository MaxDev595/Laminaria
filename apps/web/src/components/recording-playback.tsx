"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, LockKeyhole, MessageCircleMore, PlayCircle } from "lucide-react";
import { useLocale } from "next-intl";
import { useState } from "react";

import { Link } from "@/i18n/navigation";
import { api, friendlyError } from "@/lib/api";
import { Logo, Skeleton } from "@laminaria/ui";
import { ServiceState } from "./ui";

export function RecordingPlayback({ recordingId }: { recordingId: string }) {
  const locale = useLocale();
  const [playbackTime, setPlaybackTime] = useState(0);
  const query = useQuery({
    queryKey: ["public-recording", recordingId],
    queryFn: () => api.publicRecording(recordingId),
    retry: 1,
  });

  if (query.isLoading) {
    return (
      <main className="recording-playback-page">
        <Skeleton style={{ height: 72 }} />
        <div className="recording-playback-layout">
          <Skeleton style={{ minHeight: 520 }} />
          <Skeleton style={{ minHeight: 520 }} />
        </div>
      </main>
    );
  }

  if (query.isError || !query.data) {
    return (
      <main className="recording-playback-page">
        <Logo />
        <ServiceState
          icon={<PlayCircle size={22} />}
          title={locale === "ru" ? "Запись недоступна" : "Recording unavailable"}
          description={friendlyError(query.error, locale)}
        />
      </main>
    );
  }

  const { recording, webinar, chat } = query.data;
  const recordingStart = new Date(recording.startedAt ?? recording.createdAt).getTime();
  const recordedChat = chat.filter((message) => message.status === "visible");
  const visibleChat = recordedChat.filter(
    (message) => new Date(message.createdAt).getTime() <= recordingStart + playbackTime * 1000 + 500,
  );

  return (
    <main className="recording-playback-page">
      <header className="recording-playback-header">
        <Logo />
        <div>
          <span>{locale === "ru" ? "Запись вебинара" : "Webinar recording"}</span>
          <h1>{webinar.title}</h1>
        </div>
        <Link href={`/w/${webinar.slug}`} className="recording-back-link">
          <ArrowLeft size={16} />
          {locale === "ru" ? "О вебинаре" : "About webinar"}
        </Link>
      </header>

      <div className="recording-playback-layout">
        <section className="recording-video-shell">
          <video
            src={recording.playbackUrl ?? undefined}
            controls
            playsInline
            preload="metadata"
            onTimeUpdate={(event) => setPlaybackTime(event.currentTarget.currentTime)}
            onSeeked={(event) => setPlaybackTime(event.currentTarget.currentTime)}
          />
        </section>
        <aside className="recording-chat">
          <header>
            <div>
              <MessageCircleMore size={18} />
              <strong>{locale === "ru" ? "Чат эфира" : "Webinar chat"}</strong>
            </div>
            <span>
              <LockKeyhole size={13} /> {locale === "ru" ? "Только чтение" : "Read only"}
            </span>
          </header>
          <div className="recording-chat__messages" aria-live="polite">
            {visibleChat.length ? (
              visibleChat.map((message) => (
                <article key={message.id}>
                  <div>
                    <strong>{message.author.displayName}</strong>
                    {message.author.role !== "ATTENDEE" && message.author.role !== "GUEST" ? (
                      <span>{message.author.role}</span>
                    ) : null}
                    <time>
                      {new Date(message.createdAt).toLocaleTimeString(locale, {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </time>
                  </div>
                  <p>{message.body}</p>
                </article>
              ))
            ) : (
              <p className="recording-chat__empty">
                {recordedChat.length
                  ? locale === "ru"
                    ? "Сообщения появятся по ходу записи."
                    : "Messages will appear as the recording plays."
                  : locale === "ru"
                    ? "В этом эфире сообщений не было."
                    : "There were no messages in this webinar."}
              </p>
            )}
          </div>
        </aside>
      </div>
    </main>
  );
}
