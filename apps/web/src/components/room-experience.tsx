"use client";

import {
  ConnectionStateToast,
  LiveKitRoom,
  ParticipantTile,
  RoomAudioRenderer,
  useConnectionState,
  useParticipants,
  useRoomContext,
  useTracks,
} from "@livekit/components-react";
import { ConnectionState, Track, VideoQuality } from "livekit-client";
import {
  AlertTriangle,
  ArrowLeft,
  Ban,
  Camera,
  CameraOff,
  CheckCircle2,
  HelpCircle,
  LoaderCircle,
  MessageCircleMore,
  Mic,
  MicOff,
  MonitorUp,
  Send,
  ShieldCheck,
  Signal,
  SlidersHorizontal,
  Square,
  Tv,
  UsersRound,
  VolumeX,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { io, type Socket } from "socket.io-client";

import { Link, useRouter } from "@/i18n/navigation";
import { api, type PrejoinPayload } from "@/lib/api";
import { Badge, Button, Logo } from "@laminaria/ui";
import { ServiceState } from "./ui";

interface StoredRoom extends PrejoinPayload {
  preferences?: { cameraOn: boolean; micOn: boolean };
}

interface Actor {
  id: string;
  displayName: string;
  role: Role;
}

interface ChatMessage {
  id: string;
  author: Actor;
  body: string;
  status: string;
  createdAt: string;
}

interface Question {
  id: string;
  author: Actor;
  body: string;
  status: string;
  upvoteCount: number;
  createdAt: string;
  answer?: { body: string; author: Actor; createdAt: string };
}

interface Restriction {
  targetId: string;
  targetName: string;
  action: "mute" | "ban" | "unmute" | "unban";
  active: boolean;
  until: string | null;
  reason?: string;
}

type Role = "OWNER" | "HOST" | "COHOST" | "MODERATOR" | "SPEAKER" | "ATTENDEE" | "GUEST";
type EndedStatus = "ENDED" | "CANCELLED" | "ARCHIVED";
type QualityPreset = "144p" | "240p" | "480p" | "720p" | "1080p";
type Ack<T> =
  | { ok: true; data: T; replayed: boolean }
  | { ok: false; error: { code: string; message: string } };

const QUALITY_PRESETS = ["144p", "240p", "480p", "720p", "1080p"] as const;

export function RoomExperience({ slug }: { slug: string }) {
  const locale = useLocale();
  const [endedStatus, setEndedStatus] = useState<EndedStatus | null>(null);
  const subscribeStorage = useCallback(() => () => undefined, []);
  const rawSession = useSyncExternalStore(
    subscribeStorage,
    () => sessionStorage.getItem(`laminaria-room:${slug}`),
    () => null,
  );
  const session = useMemo(() => {
    if (!rawSession) return null;
    try {
      return JSON.parse(rawSession) as StoredRoom;
    } catch {
      return null;
    }
  }, [rawSession]);

  const handleEnded = useCallback(
    (status: EndedStatus) => {
      sessionStorage.removeItem(`laminaria-room:${slug}`);
      setEndedStatus(status);
    },
    [slug],
  );

  if (endedStatus) return <RoomEnded slug={slug} status={endedStatus} />;

  if (!session) {
    return (
      <main className="room-gate">
        <Logo />
        <ServiceState
          icon={<AlertTriangle size={20} />}
          title={locale === "ru" ? "Нужен вход в вебинар" : "Webinar entry is required"}
          description={
            locale === "ru"
              ? "Токен комнаты хранится только в текущей вкладке. Вернитесь через страницу входа."
              : "The room token stays only in this tab. Return through the entry page."
          }
          action={
            <Link href={`/w/${slug}/prejoin`}>
              <Button>
                <ArrowLeft size={17} />
                {locale === "ru" ? "Ко входу" : "Go to entry"}
              </Button>
            </Link>
          }
        />
      </main>
    );
  }

  return (
    <LiveKitRoom
      token={session.media.token}
      serverUrl={session.media.url}
      connect
      audio={false}
      video={false}
      options={{
        adaptiveStream: true,
        dynacast: true,
        videoCaptureDefaults: {
          resolution: { width: 1920, height: 1080 },
        },
        publishDefaults: {
          simulcast: true,
          videoEncoding: { maxBitrate: 4_500_000 },
        },
      }}
      data-lk-theme="default"
      className="webinar-room"
    >
      <RoomTopbar slug={slug} session={session} />
      <div className="webinar-room__body">
        <section className="live-stage">
          <RoomConnectionGuard session={session} />
          <BroadcastStage currentRole={session.participant.role} />
          <RoomAudioRenderer />
          <ConnectionStateToast />
        </section>
        <RealtimePanel slug={slug} session={session} onEnded={handleEnded} />
      </div>
    </LiveKitRoom>
  );
}

function RoomConnectionGuard({ session }: { session: StoredRoom }) {
  const locale = useLocale();
  const room = useRoomContext();
  const state = useConnectionState();
  const [timedOut, setTimedOut] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const connected = state === ConnectionState.Connected;

  useEffect(() => {
    if (connected) {
      const reset = window.setTimeout(() => setTimedOut(false), 0);
      return () => window.clearTimeout(reset);
    }
    const timeout = window.setTimeout(() => setTimedOut(true), 12_000);
    return () => window.clearTimeout(timeout);
  }, [connected, state]);

  async function retry() {
    if (retrying) return;
    setRetrying(true);
    setTimedOut(false);
    try {
      await room.disconnect();
      await room.connect(session.media.url, session.media.token);
    } catch {
      setTimedOut(true);
    } finally {
      setRetrying(false);
    }
  }

  if (!timedOut || connected) return null;
  return (
    <div className="room-connection-alert" role="alert">
      <AlertTriangle size={18} />
      <div>
        <strong>{locale === "ru" ? "LiveKit не отвечает" : "LiveKit is not responding"}</strong>
        <span>
          {locale === "ru"
            ? "Браузер не смог подключиться к медиасерверу. Проверьте сеть или VPN и повторите."
            : "The browser could not reach the media server. Check your network or VPN and retry."}
        </span>
      </div>
      <button type="button" onClick={() => void retry()} disabled={retrying}>
        {retrying ? <LoaderCircle className="spin" size={16} /> : null}
        {locale === "ru" ? "Повторить" : "Retry"}
      </button>
    </div>
  );
}

function RoomEnded({ slug, status }: { slug: string; status: EndedStatus }) {
  const locale = useLocale();
  const cancelled = status === "CANCELLED" || status === "ARCHIVED";
  return (
    <main className="room-gate">
      <Logo />
      <ServiceState
        icon={<CheckCircle2 size={20} />}
        title={
          locale === "ru"
            ? cancelled
              ? "Вебинар закрыт"
              : "Вебинар завершён"
            : cancelled
              ? "The webinar is closed"
              : "The webinar has ended"
        }
        description={
          locale === "ru" ? "Организатор завершил трансляцию." : "The host ended the broadcast."
        }
        action={
          <div className="service-actions">
            <Link href="/dashboard">
              <Button>
                <ArrowLeft size={17} />
                Dashboard
              </Button>
            </Link>
            <Link href={`/w/${slug}`}>
              <Button variant="secondary">
                {locale === "ru" ? "Страница вебинара" : "Webinar page"}
              </Button>
            </Link>
          </div>
        }
      />
    </main>
  );
}

function BroadcastStage({ currentRole }: { currentRole: Role }) {
  const locale = useLocale();
  const [quality, setQuality] = useState<QualityPreset>("720p");
  const participants = useParticipants();
  const tracks = useTracks(
    [
      { source: Track.Source.ScreenShare, withPlaceholder: false },
      { source: Track.Source.Camera, withPlaceholder: false },
    ],
    { onlySubscribed: true },
  );

  useEffect(() => {
    for (const trackRef of tracks) applyViewerQuality(trackRef.publication, quality);
  }, [quality, tracks]);

  const viewerCount = participants.filter((participant) =>
    isViewerRole(roleFromMetadata(participant.metadata)),
  ).length;

  return (
    <div className="broadcast-stage">
      <div className="broadcast-toolbar">
        <div className="viewer-counter">
          <UsersRound size={17} />
          <span>{viewerCount}</span>
          <small>{locale === "ru" ? "зрителей" : "viewers"}</small>
        </div>
        {!canPublishMedia(currentRole) ? (
          <label className="quality-select">
            <span>{locale === "ru" ? "Качество" : "Quality"}</span>
            <select
              value={quality}
              onChange={(event) => setQuality(event.target.value as QualityPreset)}
            >
              {QUALITY_PRESETS.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      {tracks.length === 0 ? (
        <div className="viewer-stage-empty">
          <Tv size={34} />
          <h2>{locale === "ru" ? "Ожидаем ведущего" : "Waiting for the host"}</h2>
          <p>
            {locale === "ru"
              ? "Зрители не создают плитки на сцене. Здесь появится только камера, экран или спикер эфира."
              : "Viewers do not create stage tiles. Only host camera, screen share, or speakers appear here."}
          </p>
        </div>
      ) : (
        <div
          className={`viewer-stage-grid ${tracks.some((trackRef) => trackRef.source === Track.Source.ScreenShare) ? "has-screen-share" : ""}`}
        >
          {tracks.map((trackRef) => (
            <ParticipantTile
              key={`${trackRef.participant.identity}:${trackRef.source}:${trackRef.publication?.trackSid ?? "track"}`}
              trackRef={trackRef}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function RoomTopbar({ slug, session }: { slug: string; session: StoredRoom }) {
  const state = useConnectionState();
  const room = useRoomContext();
  const router = useRouter();
  const t = useTranslations();
  const locale = useLocale();
  const [ending, setEnding] = useState(false);
  const [endError, setEndError] = useState("");
  const role = session.participant.role;
  const connected = state === ConnectionState.Connected;
  const reconnecting = state === ConnectionState.Reconnecting;

  async function leaveRoom() {
    sessionStorage.removeItem(`laminaria-room:${slug}`);
    await room.disconnect();
    router.replace("/dashboard");
  }

  async function endWebinar() {
    if (ending || !canEndWebinar(role)) return;
    const confirmed = window.confirm(
      locale === "ru"
        ? "Завершить эфир для всех участников?"
        : "End the webinar for every participant?",
    );
    if (!confirmed) return;
    setEnding(true);
    setEndError("");
    try {
      await api.endWebinar(session.webinarId);
      sessionStorage.removeItem(`laminaria-room:${slug}`);
      await room.disconnect();
      router.replace("/dashboard");
    } catch (reason) {
      setEndError(
        reason instanceof Error
          ? reason.message
          : locale === "ru"
            ? "Не удалось завершить эфир."
            : "Could not end the webinar.",
      );
      setEnding(false);
    }
  }

  return (
    <header className="room-topbar">
      <Logo />
      <div
        className={`room-connection ${connected ? "is-connected" : reconnecting ? "is-reconnecting" : ""}`}
      >
        <Signal size={16} />
        <span>
          {connected
            ? t("room.connected")
            : reconnecting
              ? t("room.reconnecting")
              : t("room.connecting")}
        </span>
      </div>
      <div className="room-topbar__actions">
        <RoleBadge role={role} />
        {canPublishMedia(role) ? <HostMediaControls preferences={session.preferences} /> : null}
        {canEndWebinar(role) ? (
          <button
            type="button"
            className="room-end"
            onClick={() => void endWebinar()}
            disabled={ending}
            title={locale === "ru" ? "Завершить эфир для всех" : "End webinar for everyone"}
          >
            {ending ? <LoaderCircle className="spin" size={17} /> : <Square size={16} />}
            {locale === "ru" ? "Завершить эфир" : "End webinar"}
          </button>
        ) : null}
        <button type="button" className="room-leave" onClick={() => void leaveRoom()}>
          <X size={17} />
          {t("room.leave")}
        </button>
        {endError ? (
          <span className="room-end-error" role="alert">
            {endError}
          </span>
        ) : null}
      </div>
    </header>
  );
}

function HostMediaControls({ preferences }: { preferences?: StoredRoom["preferences"] }) {
  const locale = useLocale();
  const room = useRoomContext();
  const connectionState = useConnectionState();
  const [cameraOn, setCameraOn] = useState(room.localParticipant.isCameraEnabled);
  const [micOn, setMicOn] = useState(room.localParticipant.isMicrophoneEnabled);
  const [screenOn, setScreenOn] = useState(room.localParticipant.isScreenShareEnabled);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const initialMediaApplied = useRef(false);
  const connected = connectionState === ConnectionState.Connected;

  useEffect(() => {
    if (!connected || initialMediaApplied.current) return;
    initialMediaApplied.current = true;

    let cancelled = false;

    async function applyInitialMedia() {
      try {
        if (preferences?.micOn) {
          await room.localParticipant.setMicrophoneEnabled(true);
          if (!cancelled) setMicOn(true);
        }
        if (preferences?.cameraOn) {
          await room.localParticipant.setCameraEnabled(true);
          if (!cancelled) setCameraOn(true);
        }
      } catch (reason) {
        if (!cancelled) {
          setMediaError(
            reason instanceof Error
              ? reason.message
              : locale === "ru"
                ? "Не удалось включить медиа."
                : "Could not enable media.",
          );
        }
      }
    }

    void applyInitialMedia();

    return () => {
      cancelled = true;
    };
  }, [connected, locale, preferences?.cameraOn, preferences?.micOn, room.localParticipant]);

  async function toggleCamera() {
    if (!connected) return;
    const next = !cameraOn;
    try {
      await room.localParticipant.setCameraEnabled(next);
      setCameraOn(next);
      setMediaError(null);
    } catch (reason) {
      setMediaError(
        reason instanceof Error
          ? reason.message
          : locale === "ru"
            ? "Камера пока недоступна."
            : "Camera is not available yet.",
      );
    }
  }

  async function toggleMic() {
    if (!connected) return;
    const next = !micOn;
    try {
      await room.localParticipant.setMicrophoneEnabled(next);
      setMicOn(next);
      setMediaError(null);
    } catch (reason) {
      setMediaError(
        reason instanceof Error
          ? reason.message
          : locale === "ru"
            ? "Микрофон пока недоступен."
            : "Microphone is not available yet.",
      );
    }
  }

  async function toggleScreen() {
    if (!connected) return;
    const next = !screenOn;
    try {
      await room.localParticipant.setScreenShareEnabled(next);
      setScreenOn(next);
      setMediaError(null);
    } catch (reason) {
      setMediaError(
        reason instanceof Error
          ? reason.message
          : locale === "ru"
            ? "Демонстрация экрана пока недоступна."
            : "Screen sharing is not available yet.",
      );
    }
  }

  return (
    <div className="host-media-controls-wrap">
      <div className="host-media-controls">
        <button
          type="button"
          className={cameraOn ? "is-on" : ""}
          onClick={() => void toggleCamera()}
          disabled={!connected}
        >
          {cameraOn ? <Camera size={17} /> : <CameraOff size={17} />}
          {locale === "ru" ? "Камера" : "Camera"}
        </button>
        <button
          type="button"
          className={micOn ? "is-on" : ""}
          onClick={() => void toggleMic()}
          disabled={!connected}
        >
          {micOn ? <Mic size={17} /> : <MicOff size={17} />}
          {locale === "ru" ? "Микрофон" : "Mic"}
        </button>
        <button
          type="button"
          className={screenOn ? "is-on" : ""}
          onClick={() => void toggleScreen()}
          disabled={!connected}
        >
          <MonitorUp size={17} />
          {locale === "ru" ? "Экран" : "Screen"}
        </button>
      </div>
      {mediaError ? <p className="host-media-controls__error">{mediaError}</p> : null}
    </div>
  );
}

function RealtimePanel({
  slug,
  session,
  onEnded,
}: {
  slug: string;
  session: StoredRoom;
  onEnded: (status: EndedStatus) => void;
}) {
  const locale = useLocale();
  const t = useTranslations();
  const room = useRoomContext();
  const router = useRouter();
  const [tab, setTab] = useState<"chat" | "questions">("chat");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [restrictions, setRestrictions] = useState<Restriction[]>([]);
  const [text, setText] = useState("");
  const [connected, setConnected] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [viewerChatEnabled, setViewerChatEnabled] = useState(false);
  const [moderationTarget, setModerationTarget] = useState<Actor | null>(null);
  const [answeringQuestionId, setAnsweringQuestionId] = useState<string | null>(null);
  const [answerText, setAnswerText] = useState("");
  const socketRef = useRef<Socket | null>(null);
  const viewer = isViewerRole(session.participant.role);
  const canModerateChat = canModerate(session.participant.role);
  const chatLocked = viewer && tab === "chat" && !viewerChatEnabled;

  useEffect(() => {
    const socket = io(api.origin, {
      auth: { token: session.realtimeToken },
      transports: ["websocket", "polling"],
      withCredentials: true,
      reconnection: true,
      reconnectionDelayMax: 5_000,
    });
    socketRef.current = socket;
    socket.on("connect", () => {
      setConnected(true);
      setError("");
      socket.emit("webinar:join", { webinarId: session.webinarId }, (ack: Ack<unknown>) => {
        if (!ack.ok) setError(ack.error.message);
      });
    });
    socket.on("disconnect", () => setConnected(false));
    socket.on("connect_error", (reason) => setError(reason.message));
    socket.on("realtime:error", (payload: { message: string }) => setError(payload.message));
    socket.on("webinar:ended", (payload: { status: EndedStatus }) => onEnded(payload.status));
    socket.on("chat:state", (state: { webinarId: string; enabled: boolean }) => {
      if (state.webinarId === session.webinarId) setViewerChatEnabled(state.enabled);
    });
    socket.on("moderation:restriction", (restriction: Restriction) => {
      if (restriction.targetId === currentActorId(session))
        setError(restrictionMessage(restriction, locale));
      setRestrictions((current) => upsertRestriction(current, restriction));
    });
    socket.on("moderation:kicked", (restriction: Restriction) => {
      if (restriction.targetId !== currentActorId(session)) return;
      setError(restrictionMessage(restriction, locale));
      sessionStorage.removeItem(`laminaria-room:${slug}`);
      void room.disconnect().finally(() => {
        socket.disconnect();
        router.replace(`/w/${slug}`);
      });
    });
    socket.on("chat:created", (message: ChatMessage) =>
      setMessages((current) =>
        current.some((item) => item.id === message.id) ? current : [...current, message],
      ),
    );
    socket.on("chat:deleted", (payload: { messageId: string }) =>
      setMessages((current) => current.filter((item) => item.id !== payload.messageId)),
    );
    socket.on("question:created", (question: Question) =>
      setQuestions((current) =>
        current.some((item) => item.id === question.id) ? current : [...current, question],
      ),
    );
    socket.on("question:updated", (question: Question) =>
      setQuestions((current) => current.map((item) => (item.id === question.id ? question : item))),
    );
    return () => {
      socket.emit("webinar:leave", { webinarId: session.webinarId });
      socket.disconnect();
      socketRef.current = null;
    };
  }, [locale, onEnded, room, router, session, slug]);

  async function send() {
    const body = text.trim();
    const socket = socketRef.current;
    if (!body || !socket?.connected || chatLocked) return;
    setSending(true);
    setError("");
    const event = tab === "chat" ? "chat:send" : "question:ask";
    socket.emit(
      event,
      { webinarId: session.webinarId, idempotencyKey: crypto.randomUUID(), body },
      (ack: Ack<ChatMessage | Question>) => {
        setSending(false);
        if (!ack.ok) {
          setError(ack.error.message);
          return;
        }
        setText("");
      },
    );
  }

  function toggleViewerChat() {
    const socket = socketRef.current;
    if (!socket?.connected || !canModerateChat) return;
    const next = !viewerChatEnabled;
    socket.emit(
      "chat:set_state",
      { webinarId: session.webinarId, idempotencyKey: crypto.randomUUID(), enabled: next },
      (ack: Ack<{ webinarId: string; enabled: boolean }>) => {
        if (!ack.ok) {
          setError(ack.error.message);
          return;
        }
        setViewerChatEnabled(ack.data.enabled);
      },
    );
  }

  function restrict(target: Actor, action: Restriction["action"], durationMinutes?: number | null) {
    const socket = socketRef.current;
    if (!socket?.connected || !canModerateChat) return;
    socket.emit(
      "moderation:restrict",
      {
        webinarId: session.webinarId,
        idempotencyKey: crypto.randomUUID(),
        targetId: target.id,
        targetName: target.displayName,
        action,
        durationMinutes,
      },
      (ack: Ack<Restriction>) => {
        if (!ack.ok) {
          setError(ack.error.message);
          return;
        }
        if (action === "ban" || action === "mute") setModerationTarget(null);
      },
    );
  }

  function answerQuestion(questionId: string) {
    const socket = socketRef.current;
    const body = answerText.trim();
    if (!socket?.connected || !canModerateChat || !body) return;
    socket.emit(
      "question:answer",
      {
        webinarId: session.webinarId,
        idempotencyKey: crypto.randomUUID(),
        questionId,
        body,
      },
      (ack: Ack<Question>) => {
        if (!ack.ok) {
          setError(ack.error.message);
          return;
        }
        setAnswerText("");
        setAnsweringQuestionId(null);
      },
    );
  }

  const items = tab === "chat" ? messages : questions;

  return (
    <aside className="realtime-panel">
      <div className="realtime-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "chat"}
          onClick={() => setTab("chat")}
        >
          <MessageCircleMore size={17} />
          {t("room.chat")}
          <span>{messages.length}</span>
          {tab === "chat" ? <motion.i layoutId="realtime-tab" /> : null}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "questions"}
          onClick={() => setTab("questions")}
        >
          <HelpCircle size={17} />
          {t("room.questions")}
          <span>{questions.length}</span>
          {tab === "questions" ? <motion.i layoutId="realtime-tab" /> : null}
        </button>
      </div>

      <div className="realtime-status">
        <span className={connected ? "is-live" : ""} />
        {connected
          ? locale === "ru"
            ? "Realtime подключён"
            : "Realtime connected"
          : locale === "ru"
            ? "Восстанавливаем realtime..."
            : "Restoring realtime..."}
      </div>

      {canModerateChat ? (
        <button
          type="button"
          className="chat-gate-toggle"
          onClick={toggleViewerChat}
          disabled={!connected}
        >
          {viewerChatEnabled
            ? locale === "ru"
              ? "Закрыть чат зрителям"
              : "Close viewer chat"
            : locale === "ru"
              ? "Открыть чат зрителям"
              : "Open viewer chat"}
        </button>
      ) : null}

      <div className="realtime-list" role="log" aria-live="polite">
        <AnimatePresence initial={false}>
          {items.length === 0 ? (
            <motion.div
              className="realtime-empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <span>{tab === "chat" ? <MessageCircleMore /> : <HelpCircle />}</span>
              <h3>
                {tab === "chat"
                  ? locale === "ru"
                    ? "Чат пока пуст"
                    : "The conversation starts here"
                  : locale === "ru"
                    ? "Вопросов пока нет"
                    : "No questions yet"}
              </h3>
              <p>
                {locale === "ru"
                  ? "Здесь появятся сообщения текущего эфира."
                  : "Only messages from this live session appear here."}
              </p>
            </motion.div>
          ) : (
            items.map((item) => (
              <motion.article
                className={`realtime-message ${roleClass(item.author.role)}`}
                key={item.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                <span>{item.author.displayName.slice(0, 1).toUpperCase()}</span>
                <div>
                  <header>
                    <strong>{item.author.displayName}</strong>
                    <RoleInline role={item.author.role} />
                  </header>
                  <p>{item.body}</p>
                  {canModerateChat && !canModerate(item.author.role) ? (
                    <div className="message-moderation-actions">
                      <button type="button" onClick={() => setModerationTarget(item.author)}>
                        <SlidersHorizontal size={13} />
                        {locale === "ru" ? "Модерация" : "Moderate"}
                      </button>
                    </div>
                  ) : null}
                  {isQuestion(item) ? (
                    <>
                      <div className="question-actions">
                        <button
                          type="button"
                          onClick={() => {
                            const socket = socketRef.current;
                            if (!socket?.connected) return;
                            socket.emit(
                              "question:upvote",
                              {
                                webinarId: session.webinarId,
                                idempotencyKey: crypto.randomUUID(),
                                questionId: item.id,
                              },
                              (ack: Ack<Question>) => {
                                if (!ack.ok) setError(ack.error.message);
                              },
                            );
                          }}
                        >
                          <CheckCircle2 size={14} />
                          {item.upvoteCount}
                        </button>
                        {canModerateChat && item.status !== "answered" ? (
                          <button
                            type="button"
                            onClick={() => {
                              setAnsweringQuestionId(item.id);
                              setAnswerText("");
                            }}
                          >
                            {locale === "ru" ? "Ответить" : "Answer"}
                          </button>
                        ) : null}
                      </div>
                      {item.answer ? (
                        <div className="question-answer">
                          <strong>{locale === "ru" ? "Ответ" : "Answer"}</strong>
                          <p>{item.answer.body}</p>
                        </div>
                      ) : null}
                      {answeringQuestionId === item.id ? (
                        <form
                          className="question-answer-form"
                          onSubmit={(event) => {
                            event.preventDefault();
                            answerQuestion(item.id);
                          }}
                        >
                          <label className="lm-sr-only" htmlFor={`answer-${item.id}`}>
                            {locale === "ru" ? "Ответ на вопрос" : "Question answer"}
                          </label>
                          <textarea
                            id={`answer-${item.id}`}
                            value={answerText}
                            onChange={(event) => setAnswerText(event.target.value)}
                            maxLength={4000}
                            rows={2}
                            autoFocus
                          />
                          <div>
                            <button type="submit" disabled={!answerText.trim()}>
                              {locale === "ru" ? "Отправить" : "Send"}
                            </button>
                            <button type="button" onClick={() => setAnsweringQuestionId(null)}>
                              {locale === "ru" ? "Отмена" : "Cancel"}
                            </button>
                          </div>
                        </form>
                      ) : null}
                    </>
                  ) : null}
                </div>
              </motion.article>
            ))
          )}
        </AnimatePresence>
      </div>

      {canModerateChat && restrictions.length > 0 ? (
        <div className="restriction-list">
          <strong>{locale === "ru" ? "Ограничения эфира" : "Live restrictions"}</strong>
          {restrictions.map((restriction) => (
            <div key={`${restriction.targetId}:${restriction.action}`}>
              <span>
                {restriction.targetName} · {restriction.action}
                {restriction.until ? ` · ${formatRestrictionUntil(restriction.until, locale)}` : ""}
              </span>
              {restriction.action === "mute" ? (
                <button
                  type="button"
                  onClick={() =>
                    restrict(
                      {
                        id: restriction.targetId,
                        displayName: restriction.targetName,
                        role: "ATTENDEE",
                      },
                      "unmute",
                    )
                  }
                >
                  unmute
                </button>
              ) : null}
              {restriction.action === "ban" ? (
                <button
                  type="button"
                  onClick={() =>
                    restrict(
                      {
                        id: restriction.targetId,
                        displayName: restriction.targetName,
                        role: "ATTENDEE",
                      },
                      "unban",
                    )
                  }
                >
                  unban
                </button>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      <AnimatePresence>
        {moderationTarget ? (
          <ModerationDialog
            actor={moderationTarget}
            locale={locale}
            onClose={() => setModerationTarget(null)}
            onRestrict={(action, duration) => restrict(moderationTarget, action, duration)}
          />
        ) : null}
      </AnimatePresence>

      {error ? (
        <div className="realtime-error" role="alert">
          <AlertTriangle size={15} />
          {error}
        </div>
      ) : null}

      <form
        className="realtime-composer"
        onSubmit={(event) => {
          event.preventDefault();
          void send();
        }}
      >
        <label className="lm-sr-only" htmlFor="realtime-message">
          {tab === "chat" ? t("room.sendMessage") : t("room.askQuestion")}
        </label>
        <textarea
          id="realtime-message"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={tab === "chat" ? t("room.sendMessage") : t("room.askQuestion")}
          maxLength={2000}
          rows={2}
          disabled={!connected || sending || chatLocked}
        />
        <button
          type="submit"
          disabled={!connected || sending || !text.trim() || chatLocked}
          aria-label={tab === "chat" ? t("room.sendMessage") : t("room.askQuestion")}
        >
          {sending ? <LoaderCircle className="spin" size={18} /> : <Send size={18} />}
        </button>
      </form>

      {chatLocked ? (
        <div className="realtime-error" role="status">
          <AlertTriangle size={15} />
          {locale === "ru"
            ? "Чат для зрителей закрыт. Его может открыть организатор или модератор."
            : "Viewer chat is closed. A host or moderator can open it."}
        </div>
      ) : null}
    </aside>
  );
}

function ModerationDialog({
  actor,
  locale,
  onClose,
  onRestrict,
}: {
  actor: Actor;
  locale: string;
  onClose: () => void;
  onRestrict: (action: "mute" | "ban", durationMinutes: number | null) => void;
}) {
  const muteDurations = [
    { label: "10m", value: 10 },
    { label: "30m", value: 30 },
    { label: "1h", value: 60 },
    { label: "2h", value: 120 },
    { label: "3h", value: 180 },
    { label: locale === "ru" ? "Навсегда" : "Forever", value: null },
  ];
  const banDurations = [
    { label: "1h", value: 60 },
    { label: "3h", value: 180 },
    { label: "24h", value: 1_440 },
    { label: "3d", value: 4_320 },
    { label: "7d", value: 10_080 },
    { label: "14d", value: 20_160 },
    { label: "30d", value: 43_200 },
    { label: locale === "ru" ? "Навсегда" : "Forever", value: null },
  ];

  return (
    <motion.div
      className="moderation-modal"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <button
        className="moderation-modal__backdrop"
        type="button"
        onClick={onClose}
        aria-label="Close"
      />
      <motion.div
        className="moderation-modal__panel"
        initial={{ y: 20, scale: 0.98 }}
        animate={{ y: 0, scale: 1 }}
        exit={{ y: 12, scale: 0.98 }}
      >
        <header>
          <div>
            <span>{actor.displayName.slice(0, 1).toUpperCase()}</span>
            <div>
              <h2>{locale === "ru" ? "Модерация зрителя" : "Viewer moderation"}</h2>
              <p>{actor.displayName}</p>
            </div>
          </div>
          <button type="button" onClick={onClose}>
            <X size={17} />
          </button>
        </header>
        <section>
          <h3>
            <VolumeX size={16} />
            {locale === "ru"
              ? "Мьют: зритель не сможет писать в чат"
              : "Mute: viewer cannot write in chat"}
          </h3>
          <div>
            {muteDurations.map((duration) => (
              <button
                key={`mute-${duration.label}`}
                type="button"
                onClick={() => onRestrict("mute", duration.value)}
              >
                {duration.label}
              </button>
            ))}
          </div>
        </section>
        <section>
          <h3>
            <Ban size={16} />
            {locale === "ru"
              ? "Бан: зритель не сможет заходить в эфир"
              : "Ban: viewer cannot enter the webinar"}
          </h3>
          <div>
            {banDurations.map((duration) => (
              <button
                key={`ban-${duration.label}`}
                type="button"
                onClick={() => onRestrict("ban", duration.value)}
              >
                {duration.label}
              </button>
            ))}
          </div>
        </section>
      </motion.div>
    </motion.div>
  );
}

function RoleBadge({ role }: { role: Role }) {
  return (
    <Badge tone={canModerate(role) ? "primary" : "neutral"}>{roleLabel(role, "en") || role}</Badge>
  );
}

function RoleInline({ role }: { role: Role }) {
  const locale = useLocale();
  const label = roleLabel(role, locale);
  if (!label) return null;
  return (
    <small className={`role-chip ${roleClass(role)}`}>
      <ShieldCheck size={12} />
      {label}
    </small>
  );
}

function roleLabel(role: Role, locale: string): string {
  if (role === "OWNER" || role === "HOST" || role === "COHOST")
    return locale === "ru" ? "админ" : "admin";
  if (role === "MODERATOR") return locale === "ru" ? "модератор" : "moderator";
  return "";
}

function roleClass(role: Role): string {
  if (role === "OWNER" || role === "HOST" || role === "COHOST") return "is-admin";
  if (role === "MODERATOR") return "is-moderator";
  return "";
}

function roleFromMetadata(metadata?: string): Role {
  try {
    const parsed = metadata ? (JSON.parse(metadata) as { role?: Role }) : {};
    return parsed.role ?? "GUEST";
  } catch {
    return "GUEST";
  }
}

function currentActorId(session: StoredRoom): string {
  const metadataSubject = session.participant.identity.split(":").slice(0, 2).join(":");
  return metadataSubject || session.participant.identity;
}

function restrictionMessage(restriction: Restriction, locale: string): string {
  if (restriction.action === "mute")
    return locale === "ru" ? "Вас замьютили в этом эфире." : "You were muted in this webinar.";
  if (restriction.action === "ban")
    return locale === "ru" ? "Вы забанены в этом эфире." : "You were banned from this webinar.";
  if (restriction.action === "unmute") return locale === "ru" ? "Мьют снят." : "Mute removed.";
  return locale === "ru" ? "Бан снят." : "Ban removed.";
}

function upsertRestriction(current: Restriction[], next: Restriction): Restriction[] {
  const normalizedAction = next.action.replace("un", "");
  const without = current.filter(
    (item) =>
      !(item.targetId === next.targetId && item.action.replace("un", "") === normalizedAction),
  );
  if (!next.active) return without;
  return [...without, next];
}

function formatRestrictionUntil(value: string, locale: string): string {
  return new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "en-US", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function isQuestion(item: ChatMessage | Question): item is Question {
  return "upvoteCount" in item && typeof item.upvoteCount === "number";
}

function canPublishMedia(role: Role): boolean {
  return role === "OWNER" || role === "HOST" || role === "COHOST" || role === "SPEAKER";
}

function canEndWebinar(role: Role): boolean {
  return role === "OWNER" || role === "HOST" || role === "COHOST";
}

function isViewerRole(role: string): boolean {
  return role === "ATTENDEE" || role === "GUEST";
}

function canModerate(role: string): boolean {
  return role === "OWNER" || role === "HOST" || role === "COHOST" || role === "MODERATOR";
}

function applyViewerQuality(publication: unknown, quality: QualityPreset): void {
  const preferred = qualityToLiveKitPreference(quality);
  const target = publication as {
    setVideoQuality?: (quality: VideoQuality) => void;
    setSubscribedQuality?: (quality: VideoQuality) => void;
    setVideoDimensions?: (dimensions: { width: number; height: number }) => void;
  };
  target.setVideoDimensions?.(qualityToDimensions(quality));
  target.setSubscribedQuality?.(preferred);
  target.setVideoQuality?.(preferred);
}

function qualityToLiveKitPreference(quality: QualityPreset): VideoQuality {
  if (quality === "144p" || quality === "240p") return VideoQuality.LOW;
  if (quality === "480p") return VideoQuality.MEDIUM;
  return VideoQuality.HIGH;
}

function qualityToDimensions(quality: QualityPreset): { width: number; height: number } {
  const height = Number.parseInt(quality, 10);
  return { width: Math.round((height * 16) / 9), height };
}
