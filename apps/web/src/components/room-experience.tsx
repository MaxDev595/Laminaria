"use client";

import {
  ConnectionStateToast,
  LiveKitRoom,
  RoomAudioRenderer,
  VideoConference,
  useConnectionState,
  useRoomContext,
} from "@livekit/components-react";
import { ConnectionState } from "livekit-client";
import {
  AlertTriangle,
  ArrowLeft,
  Camera,
  CameraOff,
  CheckCircle2,
  Headphones,
  HelpCircle,
  LoaderCircle,
  MessageCircleMore,
  Mic,
  MicOff,
  RefreshCw,
  Send,
  Settings2,
  Signal,
  Sparkles,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useLocale, useTranslations } from "next-intl";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { io, type Socket } from "socket.io-client";

import { Link, useRouter } from "@/i18n/navigation";
import { api, type PrejoinPayload } from "@/lib/api";
import { Badge, Button, Logo } from "@laminaria/ui";
import { ServiceState } from "./ui";

interface StoredRoom extends PrejoinPayload {
  preferences?: { cameraOn: boolean; micOn: boolean };
}

type EndedStatus = "ENDED" | "CANCELLED" | "ARCHIVED";

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

  if (endedStatus) {
    return <RoomEnded slug={slug} status={endedStatus} />;
  }

  if (!session) {
    return (
      <main className="room-gate">
        <Logo />
        <ServiceState
          icon={<AlertTriangle size={20} />}
          title={locale === "ru" ? "Нужна проверка входа" : "Pre-join is required"}
          description={
            locale === "ru"
              ? "Медиатокен хранится только в текущей вкладке. Вернитесь через pre-join или зайдите из dashboard заново."
              : "The media token stays only in this tab. Return through pre-join or enter again from the dashboard."
          }
          action={
            <Link href={`/w/${slug}/prejoin`}>
              <Button>
                <ArrowLeft size={17} />
                {locale === "ru" ? "Перейти к pre-join" : "Go to pre-join"}
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
      audio={session.preferences?.micOn ?? false}
      video={session.preferences?.cameraOn ?? false}
      data-lk-theme="default"
      className="webinar-room"
    >
      <RoomTopbar slug={slug} role={session.participant.role} />
      <div className="webinar-room__body">
        <section className="live-stage">
          <VideoConference />
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
          locale === "ru"
            ? "Организатор завершил трансляцию. Комната отключена для всех участников."
            : "The host ended the broadcast. The room has been disconnected for every participant."
        }
        action={
          <div className="service-actions">
            <Link href="/dashboard">
              <Button>
                <ArrowLeft size={17} />
                {locale === "ru" ? "В dashboard" : "Back to dashboard"}
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

function RoomTopbar({ slug, role }: { slug: string; role: string }) {
  const state = useConnectionState();
  const room = useRoomContext();
  const router = useRouter();
  const t = useTranslations();
  const locale = useLocale();
  const [deviceTestOpen, setDeviceTestOpen] = useState(false);
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
        <Badge tone={role === "ATTENDEE" || role === "GUEST" ? "neutral" : "primary"}>{role}</Badge>
        <button type="button" className="room-device-test" onClick={() => setDeviceTestOpen(true)}>
          <Settings2 size={17} />
          {locale === "ru" ? "Камера и микрофон" : "Camera and mic"}
        </button>
        <button type="button" className="room-leave" onClick={() => void leaveRoom()}>
          <X size={17} />
          {t("room.leave")}
        </button>
      </div>
      <DeviceTestModal open={deviceTestOpen} onClose={() => setDeviceTestOpen(false)} />
    </header>
  );
}

function DeviceTestModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const locale = useLocale();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [cameraId, setCameraId] = useState("");
  const [micId, setMicId] = useState("");
  const [cameraOn, setCameraOn] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const [state, setState] = useState<"idle" | "requesting" | "granted" | "denied" | "unavailable">("idle");

  const stopPreview = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const startPreview = useCallback(
    async (nextCameraId = cameraId, nextMicId = micId) => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setState("unavailable");
        return;
      }
      setState("requesting");
      try {
        stopPreview();
        const stream = await navigator.mediaDevices.getUserMedia({
          video: cameraOn
            ? {
                ...(nextCameraId ? { deviceId: { exact: nextCameraId } } : {}),
                width: { ideal: 1280 },
                height: { ideal: 720 },
              }
            : false,
          audio: micOn ? (nextMicId ? { deviceId: { exact: nextMicId } } : true) : false,
        });
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        const list = await navigator.mediaDevices.enumerateDevices();
        setDevices(list);
        const videoTrack = stream.getVideoTracks()[0];
        const audioTrack = stream.getAudioTracks()[0];
        if (!nextCameraId && videoTrack?.getSettings().deviceId) setCameraId(videoTrack.getSettings().deviceId!);
        if (!nextMicId && audioTrack?.getSettings().deviceId) setMicId(audioTrack.getSettings().deviceId!);
        setState("granted");
      } catch (reason) {
        setState(reason instanceof DOMException && reason.name === "NotFoundError" ? "unavailable" : "denied");
        if (videoRef.current) videoRef.current.srcObject = null;
      }
    },
    [cameraId, micId, cameraOn, micOn, stopPreview],
  );

  useEffect(() => {
    if (open) queueMicrotask(() => void startPreview());
    return () => stopPreview();
  }, [open, startPreview, stopPreview]);

  async function testSpeaker() {
    const AudioContextClass =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.12, context.currentTime + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.34);
    oscillator.frequency.value = 520;
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.36);
    oscillator.addEventListener("ended", () => void context.close());
  }

  function close() {
    stopPreview();
    onClose();
  }

  const videoDevices = devices.filter((device) => device.kind === "videoinput");
  const audioDevices = devices.filter((device) => device.kind === "audioinput");

  if (!open) return null;

  return (
    <div className="device-modal" role="dialog" aria-modal="true" aria-label={locale === "ru" ? "Тест камеры и микрофона" : "Camera and microphone test"}>
      <motion.button
        className="device-modal__backdrop"
        type="button"
        onClick={close}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        aria-label={locale === "ru" ? "Закрыть" : "Close"}
      />
      <motion.div className="device-modal__panel" initial={{ opacity: 0, y: 18, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}>
        <header>
          <div>
            <h2>{locale === "ru" ? "Камера и микрофон" : "Camera and microphone"}</h2>
            <p>{locale === "ru" ? "Проверьте устройства, не выходя из трансляции." : "Check your devices without leaving the live room."}</p>
          </div>
          <button type="button" onClick={close} aria-label={locale === "ru" ? "Закрыть" : "Close"}>
            <X size={18} />
          </button>
        </header>
        <div className="device-preview">
          {state === "granted" && cameraOn ? (
            <video ref={videoRef} autoPlay muted playsInline />
          ) : (
            <div className="device-preview__empty">
              {state === "requesting" ? <LoaderCircle className="spin" size={28} /> : cameraOn ? <Camera size={30} /> : <CameraOff size={30} />}
              <span>
                {state === "requesting"
                  ? locale === "ru"
                    ? "Запрашиваем доступ..."
                    : "Requesting access..."
                  : state === "denied"
                    ? locale === "ru"
                      ? "Доступ заблокирован браузером"
                      : "Browser access is blocked"
                    : state === "unavailable"
                      ? locale === "ru"
                        ? "Устройство не найдено"
                        : "Device not found"
                      : locale === "ru"
                        ? "Камера выключена"
                        : "Camera is off"}
              </span>
            </div>
          )}
        </div>
        <div className="device-controls">
          <button type="button" className={micOn ? "is-on" : ""} onClick={() => setMicOn((value) => !value)}>
            {micOn ? <Mic size={18} /> : <MicOff size={18} />}
            {locale === "ru" ? "Микрофон" : "Microphone"}
          </button>
          <button type="button" className={cameraOn ? "is-on" : ""} onClick={() => setCameraOn((value) => !value)}>
            {cameraOn ? <Camera size={18} /> : <CameraOff size={18} />}
            {locale === "ru" ? "Камера" : "Camera"}
          </button>
          <button type="button" onClick={() => void testSpeaker()}>
            <Headphones size={18} />
            {locale === "ru" ? "Звук" : "Speaker"}
          </button>
          <button type="button" onClick={() => void startPreview()}>
            <RefreshCw size={18} />
            {locale === "ru" ? "Проверить" : "Retest"}
          </button>
        </div>
        <div className="device-selectors">
          <label>
            <span>{locale === "ru" ? "Камера" : "Camera"}</span>
            <select
              className="select input"
              value={cameraId}
              onChange={(event) => {
                const value = event.target.value;
                setCameraId(value);
                void startPreview(value, micId);
              }}
            >
              {videoDevices.length === 0 ? (
                <option value="">{locale === "ru" ? "Камеры не найдены" : "No cameras found"}</option>
              ) : (
                videoDevices.map((device, index) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label || `${locale === "ru" ? "Камера" : "Camera"} ${index + 1}`}
                  </option>
                ))
              )}
            </select>
          </label>
          <label>
            <span>{locale === "ru" ? "Микрофон" : "Microphone"}</span>
            <select
              className="select input"
              value={micId}
              onChange={(event) => {
                const value = event.target.value;
                setMicId(value);
                void startPreview(cameraId, value);
              }}
            >
              {audioDevices.length === 0 ? (
                <option value="">{locale === "ru" ? "Микрофоны не найдены" : "No microphones found"}</option>
              ) : (
                audioDevices.map((device, index) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label || `${locale === "ru" ? "Микрофон" : "Microphone"} ${index + 1}`}
                  </option>
                ))
              )}
            </select>
          </label>
        </div>
      </motion.div>
    </div>
  );
}

interface Actor {
  id: string;
  displayName: string;
  role: string;
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
type Ack<T> = { ok: true; data: T; replayed: boolean } | { ok: false; error: { code: string; message: string } };

function isQuestion(item: ChatMessage | Question): item is Question {
  return "upvoteCount" in item && typeof item.upvoteCount === "number";
}

function RealtimePanel({ session, onEnded }: { session: StoredRoom; onEnded: (status: EndedStatus) => void }) {
  const locale = useLocale();
  const t = useTranslations();
  const [tab, setTab] = useState<"chat" | "questions">("chat");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [text, setText] = useState("");
  const [connected, setConnected] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const socketRef = useRef<Socket | null>(null);

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
  }, [onEnded, session.realtimeToken, session.webinarId]);

  async function send() {
    const body = text.trim();
    const socket = socketRef.current;
    if (!body || !socket?.connected) return;
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
        {connected
          ? locale === "ru"
            ? "Realtime подключён"
            : "Realtime connected"
          : locale === "ru"
            ? "Восстанавливаем realtime..."
            : "Restoring realtime..."}
      </div>
      <div className="realtime-list" role="log" aria-live="polite">
        <AnimatePresence initial={false}>
          {items.length === 0 ? (
            <motion.div className="realtime-empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <span>{tab === "chat" ? <MessageCircleMore /> : <HelpCircle />}</span>
              <h3>
                {tab === "chat"
                  ? locale === "ru"
                    ? "Разговор начнётся здесь"
                    : "The conversation starts here"
                  : locale === "ru"
                    ? "Вопросов пока нет"
                    : "No questions yet"}
              </h3>
              <p>
                {locale === "ru"
                  ? "Здесь появятся только реальные сообщения этой сессии."
                  : "Only real messages from this session will appear here."}
              </p>
            </motion.div>
          ) : (
            items.map((item) => (
              <motion.article
                className="realtime-message"
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
                    <small>{item.author.role}</small>
                  </header>
                  <p>{item.body}</p>
                  {isQuestion(item) ? (
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
                  ) : null}
                </div>
              </motion.article>
            ))
          )}
        </AnimatePresence>
      </div>
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
          disabled={!connected || sending}
        />
        <button
          type="submit"
          disabled={!connected || sending || !text.trim()}
          aria-label={tab === "chat" ? t("room.sendMessage") : t("room.askQuestion")}
        >
          {sending ? <LoaderCircle className="spin" size={18} /> : <Send size={18} />}
        </button>
      </form>
      <div className="ai-room-note">
        <Sparkles size={14} />
        <span>{locale === "ru" ? "AI-ответы всегда будут явно помечены" : "AI answers will always be clearly labeled"}</span>
      </div>
    </aside>
  );
}
