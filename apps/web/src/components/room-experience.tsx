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
import { ConnectionState, Track } from "livekit-client";
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
  Radio,
  Send,
  ShieldCheck,
  Signal,
  Sparkles,
  Tv,
  UserRoundX,
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
type Ack<T> = { ok: true; data: T; replayed: boolean } | { ok: false; error: { code: string; message: string } };

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
              <Button><ArrowLeft size={17} />{locale === "ru" ? "Ко входу" : "Go to entry"}</Button>
            </Link>
          }
        />
      </main>
    );
  }

  const publishAllowed = canPublishMedia(session.participant.role);

  return (
    <LiveKitRoom
      token={session.media.token}
      serverUrl={session.media.url}
      connect
      audio={publishAllowed && (session.preferences?.micOn ?? false)}
      video={publishAllowed && (session.preferences?.cameraOn ?? false)}
      options={{
        videoCaptureDefaults: {
          resolution: { width: 1280, height: 720 },
        },
        publishDefaults: {
          simulcast: true,
          videoEncoding: { maxBitrate: 2_500_000 },
        },
      }}
      data-lk-theme="default"
      className="webinar-room"
    >
      <RoomTopbar slug={slug} role={session.participant.role} />
      <div className="webinar-room__body">
        <section className="live-stage">
          <BroadcastStage currentRole={session.participant.role} />
          <RoomAudioRenderer />
          <ConnectionStateToast />
        </section>
        <RealtimePanel session={session} onEnded={handleEnded} />
      </div>
    </LiveKitRoom>
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
        title={locale === "ru" ? (cancelled ? "Вебинар закрыт" : "Вебинар завершён") : cancelled ? "The webinar is closed" : "The webinar has ended"}
        description={locale === "ru" ? "Организатор завершил трансляцию." : "The host ended the broadcast."}
        action={
          <div className="service-actions">
            <Link href="/dashboard"><Button><ArrowLeft size={17} />Dashboard</Button></Link>
            <Link href={`/w/${slug}`}><Button variant="secondary">{locale === "ru" ? "Страница вебинара" : "Webinar page"}</Button></Link>
          </div>
        }
      />
    </main>
  );
}

function BroadcastStage({ currentRole }: { currentRole: Role }) {
  const locale = useLocale();
  const [quality, setQuality] = useState<"low" | "medium" | "high">("high");
  const participants = useParticipants();
  const tracks = useTracks(
    [
      { source: Track.Source.ScreenShare, withPlaceholder: false },
      { source: Track.Source.Camera, withPlaceholder: false },
    ],
    { onlySubscribed: true },
  );

  useEffect(() => {
    for (const trackRef of tracks) {
      const publication = trackRef.publication as unknown as { setVideoQuality?: (quality: string) => void };
      publication.setVideoQuality?.(quality);
    }
  }, [quality, tracks]);

  const viewerCount = participants.filter((participant) => isViewerRole(roleFromMetadata(participant.metadata))).length;

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
            <select value={quality} onChange={(event) => setQuality(event.target.value as "low" | "medium" | "high")}>
              <option value="low">{locale === "ru" ? "Эконом" : "Low"}</option>
              <option value="medium">{locale === "ru" ? "Среднее" : "Medium"}</option>
              <option value="high">{locale === "ru" ? "Максимум" : "High"}</option>
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
              ? "Зрительские подключения не создают плитки на сцене. Здесь появится только камера или демонстрация ведущего."
              : "Viewer connections do not create stage tiles. Only host camera or screen share appears here."}
          </p>
        </div>
      ) : (
        <div className="viewer-stage-grid">
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

function RoomTopbar({ slug, role }: { slug: string; role: Role }) {
  const state = useConnectionState();
  const room = useRoomContext();
  const router = useRouter();
  const t = useTranslations();
  const connected = state === ConnectionState.Connected;
  const reconnecting = state === ConnectionState.Reconnecting;

  async function leaveRoom() {
    sessionStorage.removeItem(`laminaria-room:${slug}`);
    await room.disconnect();
    router.replace("/dashboard");
  }

  return (
    <header className="room-topbar">
      <Logo />
      <div className={`room-connection ${connected ? "is-connected" : reconnecting ? "is-reconnecting" : ""}`}>
        <Signal size={16} />
        <span>{connected ? t("room.connected") : reconnecting ? t("room.reconnecting") : t("room.connecting")}</span>
      </div>
      <div className="room-topbar__actions">
        <RoleBadge role={role} />
        {canPublishMedia(role) ? <HostMediaControls /> : null}
        <button type="button" className="room-leave" onClick={() => void leaveRoom()}>
          <X size={17} />
          {t("room.leave")}
        </button>
      </div>
    </header>
  );
}

function HostMediaControls() {
  const locale = useLocale();
  const room = useRoomContext();
  const [cameraOn, setCameraOn] = useState(room.localParticipant.isCameraEnabled);
  const [micOn, setMicOn] = useState(room.localParticipant.isMicrophoneEnabled);

  async function toggleCamera() {
    const next = !cameraOn;
    setCameraOn(next);
    await room.localParticipant.setCameraEnabled(next);
  }

  async function toggleMic() {
    const next = !micOn;
    setMicOn(next);
    await room.localParticipant.setMicrophoneEnabled(next);
  }

  return (
    <div className="host-media-controls">
      <button type="button" className={cameraOn ? "is-on" : ""} onClick={() => void toggleCamera()}>
        {cameraOn ? <Camera size={17} /> : <CameraOff size={17} />}
        {locale === "ru" ? "Камера" : "Camera"}
      </button>
      <button type="button" className={micOn ? "is-on" : ""} onClick={() => void toggleMic()}>
        {micOn ? <Mic size={17} /> : <MicOff size={17} />}
        {locale === "ru" ? "Микрофон" : "Mic"}
      </button>
    </div>
  );
}

function RealtimePanel({ session, onEnded }: { session: StoredRoom; onEnded: (status: EndedStatus) => void }) {
  const locale = useLocale();
  const t = useTranslations();
  const [tab, setTab] = useState<"chat" | "questions">("chat");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [restrictions, setRestrictions] = useState<Restriction[]>([]);
  const [text, setText] = useState("");
  const [connected, setConnected] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [viewerChatEnabled, setViewerChatEnabled] = useState(false);
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
      if (restriction.targetId === currentActorId(session)) setError(restrictionMessage(restriction, locale));
      setRestrictions((current) => upsertRestriction(current, restriction));
    });
    socket.on("chat:created", (message: ChatMessage) =>
      setMessages((current) => (current.some((item) => item.id === message.id) ? current : [...current, message])),
    );
    socket.on("chat:deleted", (payload: { messageId: string }) =>
      setMessages((current) => current.filter((item) => item.id !== payload.messageId)),
    );
    socket.on("question:created", (question: Question) =>
      setQuestions((current) => (current.some((item) => item.id === question.id) ? current : [...current, question])),
    );
    socket.on("question:updated", (question: Question) =>
      setQuestions((current) => current.map((item) => (item.id === question.id ? question : item))),
    );
    return () => {
      socket.emit("webinar:leave", { webinarId: session.webinarId });
      socket.disconnect();
      socketRef.current = null;
    };
  }, [locale, onEnded, session]);

  async function send() {
    const body = text.trim();
    const socket = socketRef.current;
    if (!body || !socket?.connected || chatLocked) return;
    setSending(true);
    setError("");
    const event = tab === "chat" ? "chat:send" : "question:ask";
    socket.emit(event, { webinarId: session.webinarId, idempotencyKey: crypto.randomUUID(), body }, (ack: Ack<ChatMessage | Question>) => {
      setSending(false);
      if (!ack.ok) {
        setError(ack.error.message);
        return;
      }
      setText("");
    });
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
        if (!ack.ok) setError(ack.error.message);
      },
    );
  }

  const items = tab === "chat" ? messages : questions;

  return (
    <aside className="realtime-panel">
      <div className="realtime-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === "chat"} onClick={() => setTab("chat")}>
          <MessageCircleMore size={17} />
          {t("room.chat")}
          <span>{messages.length}</span>
          {tab === "chat" ? <motion.i layoutId="realtime-tab" /> : null}
        </button>
        <button type="button" role="tab" aria-selected={tab === "questions"} onClick={() => setTab("questions")}>
          <HelpCircle size={17} />
          {t("room.questions")}
          <span>{questions.length}</span>
          {tab === "questions" ? <motion.i layoutId="realtime-tab" /> : null}
        </button>
      </div>

      <div className="realtime-status">
        <span className={connected ? "is-live" : ""} />
        {connected ? (locale === "ru" ? "Realtime подключён" : "Realtime connected") : (locale === "ru" ? "Восстанавливаем realtime..." : "Restoring realtime...")}
      </div>

      {canModerateChat ? (
        <button type="button" className="chat-gate-toggle" onClick={toggleViewerChat} disabled={!connected}>
          {viewerChatEnabled ? (locale === "ru" ? "Закрыть чат зрителям" : "Close viewer chat") : (locale === "ru" ? "Открыть чат зрителям" : "Open viewer chat")}
        </button>
      ) : null}

      <div className="realtime-list" role="log" aria-live="polite">
        <AnimatePresence initial={false}>
          {items.length === 0 ? (
            <motion.div className="realtime-empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <span>{tab === "chat" ? <MessageCircleMore /> : <HelpCircle />}</span>
              <h3>{tab === "chat" ? (locale === "ru" ? "Чат пока пуст" : "The conversation starts here") : (locale === "ru" ? "Вопросов пока нет" : "No questions yet")}</h3>
              <p>{locale === "ru" ? "Здесь появятся сообщения текущего эфира." : "Only messages from this live session appear here."}</p>
            </motion.div>
          ) : (
            items.map((item) => (
              <motion.article className={`realtime-message ${roleClass(item.author.role)}`} key={item.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <span>{item.author.displayName.slice(0, 1).toUpperCase()}</span>
                <div>
                  <header>
                    <strong>{item.author.displayName}</strong>
                    <RoleInline role={item.author.role} />
                  </header>
                  <p>{item.body}</p>
                  {canModerateChat && !canModerate(item.author.role) ? (
                    <div className="message-moderation-actions">
                      <button type="button" onClick={() => restrict(item.author, "mute", 10)}><VolumeX size={13} />10m</button>
                      <button type="button" onClick={() => restrict(item.author, "mute", 60)}><VolumeX size={13} />1h</button>
                      <button type="button" onClick={() => restrict(item.author, "ban", 60)}><Ban size={13} />1h</button>
                      <button type="button" onClick={() => restrict(item.author, "ban", null)}><UserRoundX size={13} />∞</button>
                    </div>
                  ) : null}
                  {isQuestion(item) ? (
                    <button
                      type="button"
                      onClick={() => {
                        const socket = socketRef.current;
                        if (!socket?.connected) return;
                        socket.emit(
                          "question:upvote",
                          { webinarId: session.webinarId, idempotencyKey: crypto.randomUUID(), questionId: item.id },
                          (ack: Ack<Question>) => {
                            if (!ack.ok) setError(ack.error.message);
                          },
                        );
                      }}
                    >
                      <CheckCircle2 size={14} />
                      {item.upvoteCount}
                    </button>
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
              <span>{restriction.targetName} · {restriction.action}</span>
              {restriction.action === "mute" ? <button type="button" onClick={() => restrict({ id: restriction.targetId, displayName: restriction.targetName, role: "ATTENDEE" }, "unmute")}>unmute</button> : null}
              {restriction.action === "ban" ? <button type="button" onClick={() => restrict({ id: restriction.targetId, displayName: restriction.targetName, role: "ATTENDEE" }, "unban")}>unban</button> : null}
            </div>
          ))}
        </div>
      ) : null}

      {error ? <div className="realtime-error" role="alert"><AlertTriangle size={15} />{error}</div> : null}

      <form className="realtime-composer" onSubmit={(event) => { event.preventDefault(); void send(); }}>
        <label className="lm-sr-only" htmlFor="realtime-message">{tab === "chat" ? t("room.sendMessage") : t("room.askQuestion")}</label>
        <textarea id="realtime-message" value={text} onChange={(event) => setText(event.target.value)} placeholder={tab === "chat" ? t("room.sendMessage") : t("room.askQuestion")} maxLength={2000} rows={2} disabled={!connected || sending || chatLocked} />
        <button type="submit" disabled={!connected || sending || !text.trim() || chatLocked} aria-label={tab === "chat" ? t("room.sendMessage") : t("room.askQuestion")}>
          {sending ? <LoaderCircle className="spin" size={18} /> : <Send size={18} />}
        </button>
      </form>

      {chatLocked ? (
        <div className="realtime-error" role="status">
          <AlertTriangle size={15} />
          {locale === "ru" ? "Чат для зрителей закрыт. Его может открыть организатор или модератор." : "Viewer chat is closed. A host or moderator can open it."}
        </div>
      ) : null}
      <div className="ai-room-note"><Sparkles size={14} /><span>{locale === "ru" ? "AI-ответы всегда будут явно помечены" : "AI answers will always be clearly labeled"}</span></div>
    </aside>
  );
}

function RoleBadge({ role }: { role: Role }) {
  return <Badge tone={canModerate(role) ? "primary" : "neutral"}>{roleLabel(role, "en") || role}</Badge>;
}

function RoleInline({ role }: { role: Role }) {
  const locale = useLocale();
  const label = roleLabel(role, locale);
  if (!label) return null;
  return <small className={`role-chip ${roleClass(role)}`}><ShieldCheck size={12} />{label}</small>;
}

function roleLabel(role: Role, locale: string): string {
  if (role === "OWNER" || role === "HOST" || role === "COHOST") return locale === "ru" ? "админ" : "admin";
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
    const parsed = metadata ? JSON.parse(metadata) as { role?: Role } : {};
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
  if (restriction.action === "mute") return locale === "ru" ? "Вас замьютили в этом эфире." : "You were muted in this webinar.";
  if (restriction.action === "ban") return locale === "ru" ? "Вы забанены в этом эфире." : "You were banned from this webinar.";
  if (restriction.action === "unmute") return locale === "ru" ? "Мьют снят." : "Mute removed.";
  return locale === "ru" ? "Бан снят." : "Ban removed.";
}

function upsertRestriction(current: Restriction[], next: Restriction): Restriction[] {
  const without = current.filter((item) => !(item.targetId === next.targetId && item.action.replace("un", "") === next.action.replace("un", "")));
  if (!next.active) return without;
  return [...without, next];
}

function isQuestion(item: ChatMessage | Question): item is Question {
  return "upvoteCount" in item && typeof item.upvoteCount === "number";
}

function canPublishMedia(role: Role): boolean {
  return role === "OWNER" || role === "HOST" || role === "COHOST" || role === "SPEAKER";
}

function isViewerRole(role: string): boolean {
  return role === "ATTENDEE" || role === "GUEST";
}

function canModerate(role: string): boolean {
  return role === "OWNER" || role === "HOST" || role === "COHOST" || role === "MODERATOR";
}
