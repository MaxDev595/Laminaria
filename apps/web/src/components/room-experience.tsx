"use client";

import {
  ConnectionStateToast,
  LiveKitRoom,
  RoomAudioRenderer,
  VideoTrack,
  useConnectionState,
  useParticipants,
  useRoomContext,
  useTracks,
} from "@livekit/components-react";
import {
  ConnectionState,
  DefaultReconnectPolicy,
  ParticipantEvent,
  ScreenSharePresets,
  Track,
  VideoPresets,
  VideoQuality,
} from "livekit-client";
import {
  AlertTriangle,
  ArrowLeft,
  Ban,
  Camera,
  CameraOff,
  Check,
  CheckCircle2,
  ChartNoAxesColumn,
  CircleDot,
  ChevronDown,
  HelpCircle,
  Link2,
  LoaderCircle,
  MessageCircleMore,
  Mic,
  MicOff,
  MonitorUp,
  Send,
  ShieldCheck,
  Signal,
  SlidersHorizontal,
  Settings,
  Square,
  Tv,
  UsersRound,
  VolumeX,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useLocale, useTranslations } from "next-intl";
import {
  type CSSProperties,
  type ComponentProps,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { io, type Socket } from "socket.io-client";

import { Link, useRouter } from "@/i18n/navigation";
import { api, type PrejoinPayload, type Recording } from "@/lib/api";
import { orderBroadcastTracks } from "@/lib/stage-tracks";
import { Badge, Button, Logo } from "@laminaria/ui";
import { ServiceState } from "./ui";
import { StyledSelect } from "./styled-select";

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
type StageOverlayPosition = "top-left" | "top-right" | "bottom-left" | "bottom-right";
type StageTrackReference = NonNullable<ComponentProps<typeof VideoTrack>["trackRef"]>;
type RoomPanel = "stage" | "chat" | "participants" | "stats" | "settings";

interface StageLayout {
  position: StageOverlayPosition;
  sizePercent: number;
  widthPercent: number;
  heightPercent: number;
}

interface StageLayoutEvent extends StageLayout {
  webinarId: string;
}
type Ack<T> =
  | { ok: true; data: T; replayed: boolean }
  | { ok: false; error: { code: string; message: string } };

const QUALITY_PRESETS = ["144p", "240p", "480p", "720p", "1080p"] as const;
const ROOM_RECONNECT_POLICY = new DefaultReconnectPolicy([
  0, 300, 900, 1_800, 3_000, 5_000, 7_000, 7_000, 7_000, 7_000, 7_000, 7_000, 7_000,
  7_000, 7_000, 7_000, 7_000, 7_000,
]);
const DEFAULT_STAGE_LAYOUT: StageLayout = {
  position: "bottom-right",
  sizePercent: 24,
  widthPercent: 24,
  heightPercent: 24,
};

export function RoomExperience({ slug }: { slug: string }) {
  const locale = useLocale();
  const [endedStatus, setEndedStatus] = useState<EndedStatus | null>(null);
  const [stageLayout, setStageLayout] = useState<StageLayout>(DEFAULT_STAGE_LAYOUT);
  const [activePanel, setActivePanel] = useState<RoomPanel>("chat");
  const [quality, setQuality] = useState<QualityPreset>("1080p");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [chatCollapsed, setChatCollapsed] = useState(false);
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
  const viewerRoom = session ? isViewerRole(session.participant.role) : false;

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
        reconnectPolicy: ROOM_RECONNECT_POLICY,
        videoCaptureDefaults: {
          resolution: VideoPresets.h1080.resolution,
          frameRate: 30,
        },
        publishDefaults: {
          simulcast: true,
          videoEncoding: { maxBitrate: 3_500_000, maxFramerate: 30 },
          videoSimulcastLayers: [VideoPresets.h216, VideoPresets.h540],
          screenShareEncoding: ScreenSharePresets.original.encoding,
          screenShareSimulcastLayers: [
            ScreenSharePresets.h720fps15,
            ScreenSharePresets.h1080fps30,
          ],
        },
      }}
      data-lk-theme="default"
      className={`webinar-room ${viewerRoom ? "webinar-room--viewer" : "webinar-room--host"}`}
    >
      <RoomTopbar
        slug={slug}
        session={session}
        chatCollapsed={chatCollapsed}
        onToggleChat={() => setChatCollapsed((value) => !value)}
        quality={quality}
        onQualityChange={setQuality}
      />
      <div className={`webinar-room__body ${chatCollapsed ? "is-chat-collapsed" : ""}`}>
        {viewerRoom ? null : <RoomRail activePanel={activePanel} onPanelChange={setActivePanel} />}
        <section className="live-stage">
          <RoomConnectionGuard session={session} />
          <BroadcastStage
            session={session}
            currentRole={session.participant.role}
            layout={stageLayout}
            quality={quality}
            onInvite={() => setInviteOpen(true)}
          />
          <RoomAudioRenderer />
          <ConnectionStateToast />
        </section>
        <RealtimePanel
          slug={slug}
          session={session}
          onEnded={handleEnded}
          onStageLayoutChange={setStageLayout}
          activePanel={activePanel}
          quality={quality}
          onQualityChange={setQuality}
          collapsed={chatCollapsed}
          onToggleCollapsed={() => setChatCollapsed((value) => !value)}
        />
        {inviteOpen ? <LiveInviteDialog session={session} onClose={() => setInviteOpen(false)} /> : null}
      </div>
    </LiveKitRoom>
  );
}

function RoomRail({
  activePanel,
  onPanelChange,
}: {
  activePanel: RoomPanel;
  onPanelChange: (panel: RoomPanel) => void;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const items = [
    { label: locale === "ru" ? "Сцена" : "Stage", icon: Tv, active: true },
    { label: t("room.chat"), icon: MessageCircleMore },
    { label: locale === "ru" ? "Участники" : "Participants", icon: UsersRound },
    { label: locale === "ru" ? "Статистика" : "Stats", icon: ChartNoAxesColumn },
    { label: locale === "ru" ? "Настройки" : "Settings", icon: Settings },
  ];

  const panelIds: RoomPanel[] = ["stage", "chat", "participants", "stats", "settings"];

  return (
    <nav className="room-rail" aria-label={locale === "ru" ? "Навигация эфира" : "Room navigation"}>
      {items.map((item, index) => {
        const Icon = item.icon;
        const panel = panelIds[index] ?? "chat";
        const active = activePanel === panel;
        return (
          <button
            type="button"
            key={item.label}
            className={active ? "is-active" : ""}
            aria-label={item.label}
            aria-pressed={active}
            title={item.label}
            onClick={() => onPanelChange(panel)}
          >
            <Icon size={18} />
            {active ? <CircleDot size={9} className="room-rail__dot" /> : null}
          </button>
        );
      })}
    </nav>
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
    const restoreMic = room.localParticipant.isMicrophoneEnabled;
    const restoreCamera = room.localParticipant.isCameraEnabled;
    const restoreScreen = room.localParticipant.isScreenShareEnabled;
    try {
      await room.disconnect();
      await room.connect(session.media.url, session.media.token);
      if (restoreMic) await room.localParticipant.setMicrophoneEnabled(true);
      if (restoreCamera) await room.localParticipant.setCameraEnabled(true);
      if (restoreScreen)
        await room.localParticipant.setScreenShareEnabled(true, {
          audio: true,
          resolution: ScreenSharePresets.original.resolution,
        });
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
            <Link href={`/w/${slug}`}>
              <Button>
                {locale === "ru" ? "Страница вебинара" : "Webinar page"}
              </Button>
            </Link>
          </div>
        }
      />
    </main>
  );
}

function BroadcastStage({
  session,
  currentRole,
  layout,
  quality,
  onInvite,
}: {
  session: StoredRoom;
  currentRole: Role;
  layout: StageLayout;
  quality: QualityPreset;
  onInvite: () => void;
}) {
  const locale = useLocale();
  const tracks = useTracks([Track.Source.ScreenShare, Track.Source.Camera], {
    onlySubscribed: false,
  });
  const orderedTracks = useMemo(() => orderBroadcastTracks(tracks), [tracks]);
  const hasScreenShare = orderedTracks.some((trackRef) => trackRef.source === Track.Source.ScreenShare);
  const screenTrack = orderedTracks.find((trackRef) => trackRef.source === Track.Source.ScreenShare);
  const cameraTracks = useMemo(
    () => orderedTracks.filter((trackRef) => trackRef.source === Track.Source.Camera),
    [orderedTracks],
  );
  const presenterCameras = useMemo(() => {
    const preferred = cameraTracks.filter((trackRef) =>
      canPublishMedia(roleFromMetadata(trackRef.participant.metadata)),
    );
    const fallback = cameraTracks.filter((trackRef) => !preferred.includes(trackRef));
    return [...preferred, ...fallback].slice(0, 3);
  }, [cameraTracks]);
  const hasSecondPresenter = presenterCameras.length > 1;
  const hasPresenterStack = presenterCameras.length > 0;
  const hasPresenterColumn = hasScreenShare && hasPresenterStack;
  const hasStageContent = Boolean(screenTrack);

  useEffect(() => {
    for (const trackRef of tracks) applyViewerQuality(trackRef.publication, quality);
  }, [quality, tracks]);

  return (
    <div className="broadcast-stage">
      {!hasPresenterStack && !screenTrack ? (
        <div className="viewer-stage-empty">
          <Tv size={34} />
          <h2>{locale === "ru" ? "Ожидаем ведущего" : "Waiting for the host"}</h2>
          <p>
            {locale === "ru"
              ? "Зрители не создают плитки на сцене. Здесь появится только камера, экран или спикер эфира."
              : "Viewers do not create stage tiles. Only host camera, screen share, or speakers appear here."}
          </p>
        </div>
      ) : !screenTrack ? (
        <div className={`camera-full-stage presenter-count-${presenterCameras.length}`}>
          {presenterCameras.map((trackRef, index) => (
            <StageVideoTile
              key={`${trackRef.participant.identity}:${trackRef.publication?.trackSid ?? index}`}
              trackRef={trackRef}
              label={presenterLabel(roleFromMetadata(trackRef.participant.metadata), locale, index)}
              className={index === 0 ? "is-host" : "is-featured"}
            />
          ))}
        </div>
      ) : (
        <div
          className={`broadcast-stage-layout ${hasStageContent ? "has-content" : "camera-only"} ${
            hasSecondPresenter ? "has-featured-speaker" : "single-presenter"
          } presenter-count-${presenterCameras.length} ${hasPresenterColumn ? "" : "no-presenter-stack"} ${
            hasScreenShare ? `has-screen-share overlay-${layout.position}` : ""
          }`}
          style={
            {
              "--stage-camera-size": `${Math.min(layout.sizePercent, 50)}%`,
            } as CSSProperties
          }
        >
          {hasPresenterColumn ? (
          <aside className="presenter-column" aria-label={locale === "ru" ? "Панель ведущего" : "Presenter panel"}>
            {hasPresenterStack ? (
            <div className="presenter-stack" aria-label={locale === "ru" ? "Ведущие эфира" : "On-stage speakers"}>
              {presenterCameras.map((trackRef, index) => (
                <StageVideoTile
                  key={`${trackRef.participant.identity}:${trackRef.publication?.trackSid ?? index}`}
                  trackRef={trackRef}
                  label={presenterLabel(roleFromMetadata(trackRef.participant.metadata), locale, index)}
                  className={index === 0 ? "is-host" : "is-featured"}
                />
              ))}
            </div>
            ) : null}
          </aside>
          ) : null}
          {screenTrack ? (
            <div className="stage-content-frame">
              <VideoTrack
                key={`${screenTrack.participant.identity}:${screenTrack.source}:${screenTrack.publication?.trackSid ?? "track"}`}
                trackRef={screenTrack}
                className="stage-screen-track"
                muted={screenTrack.participant.isLocal}
              />
            </div>
          ) : (
            <div className="stage-content-frame stage-content-frame--empty">
              <Tv size={38} />
              <span>{locale === "ru" ? "Контент появится здесь" : "Content will appear here"}</span>
              <small>{locale === "ru" ? "Включите демонстрацию экрана, чтобы зрители увидели материал." : "Start screen sharing to show your material to viewers."}</small>
            </div>
          )}
        </div>
      )}
      {canPublishMedia(currentRole) ? (
        <div className="host-bottom-controls">
          <HostMediaControls preferences={session.preferences} variant="bottom" />
          {canInviteOnStage(currentRole) ? (
            <button type="button" className="host-bottom-invite" onClick={onInvite}>
              <UsersRound size={17} />
              {locale === "ru" ? "Пригласить" : "Invite"}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function StageVideoTile({
  trackRef,
  label,
  className,
}: {
  trackRef: StageTrackReference;
  label: string;
  className: string;
}) {
  return (
    <figure className={`presenter-video-tile ${className}`}>
      <VideoTrack
        key={`${trackRef.participant.identity}:${trackRef.source}:${trackRef.publication?.trackSid ?? "track"}`}
        trackRef={trackRef}
        muted={trackRef.participant.isLocal}
      />
      <figcaption>
        <span>{trackRef.participant.name || trackRef.participant.identity || label}</span>
        <small>{label}</small>
      </figcaption>
    </figure>
  );
}

function QualityMenu({
  value,
  onChange,
  variant,
}: {
  value: QualityPreset;
  onChange: (quality: QualityPreset) => void;
  variant: "topbar" | "settings";
}) {
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={`quality-menu quality-menu--${variant}`}>
      <button
        type="button"
        className="quality-menu__trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <SlidersHorizontal size={16} aria-hidden="true" />
        <span>{locale === "ru" ? "Качество" : "Quality"}</span>
        <strong>{value}</strong>
        <ChevronDown size={15} className={open ? "is-open" : ""} aria-hidden="true" />
      </button>
      <AnimatePresence>
        {open ? (
          <motion.div
            className="quality-menu__popover"
            role="listbox"
            aria-label={locale === "ru" ? "Качество видео" : "Video quality"}
            initial={{ opacity: 0, y: -7, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -5, scale: 0.98 }}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
          >
            {QUALITY_PRESETS.map((preset) => (
              <button
                type="button"
                role="option"
                aria-selected={preset === value}
                className={preset === value ? "is-selected" : ""}
                key={preset}
                onClick={() => {
                  onChange(preset);
                  setOpen(false);
                }}
              >
                <span>
                  <strong>{preset}</strong>
                  <small>{qualityHint(preset, locale)}</small>
                </span>
                {preset === value ? <Check size={16} aria-hidden="true" /> : null}
              </button>
            ))}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function RecordingIndicator({ session }: { session: StoredRoom }) {
  const locale = useLocale();
  const [recording, setRecording] = useState<Recording | null>(null);
  const [retrying, setRetrying] = useState(false);

  const refresh = useCallback(async () => {
    if (!session.workspaceId) return;
    try {
      const result = await api.listRecordings(session.workspaceId, session.webinarId);
      setRecording(result.recordings[0] ?? null);
    } catch {
      // The room must stay usable even when the catalog API is temporarily unavailable.
    }
  }, [session.webinarId, session.workspaceId]);

  useEffect(() => {
    const initial = window.setTimeout(() => void refresh(), 0);
    const timer = window.setInterval(() => void refresh(), 6_000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, [refresh]);

  async function retry() {
    if (!session.workspaceId || retrying) return;
    setRetrying(true);
    try {
      const result = await api.startRecording(session.workspaceId, session.webinarId);
      setRecording(result.recordings[0] ?? null);
    } finally {
      setRetrying(false);
    }
  }

  const active = recording?.status === "RECORDING";
  const failed = recording?.status === "FAILED";
  if (session.recordingEnabled === false) {
    return (
      <span className="recording-indicator is-locked" title={locale === "ru" ? "Запись доступна в Pro и Business" : "Recording is available on Pro and Business"}>
        <span className="recording-indicator__dot" />
        {locale === "ru" ? "REC · PRO" : "REC · PRO"}
      </span>
    );
  }
  return (
    <button
      type="button"
      className={`recording-indicator ${active ? "is-active" : ""} ${failed ? "is-failed" : ""}`}
      onClick={failed ? () => void retry() : undefined}
      disabled={!failed || retrying}
      title={
        failed
          ? recording.failureMessage ?? (locale === "ru" ? "Повторить запуск записи" : "Retry recording")
          : active
            ? locale === "ru"
              ? "Запись эфира идёт"
              : "Webinar is being recorded"
            : locale === "ru"
              ? "Запись запускается"
              : "Recording is starting"
      }
    >
      <span className="recording-indicator__dot" />
      {retrying
        ? locale === "ru"
          ? "Запуск..."
          : "Starting..."
        : failed
          ? locale === "ru"
            ? "Запись: повторить"
            : "Recording: retry"
          : active
            ? "REC"
            : locale === "ru"
              ? "Запись..."
              : "Recording..."}
    </button>
  );
}

function RoomTopbar({
  slug,
  session,
  chatCollapsed,
  onToggleChat,
  quality,
  onQualityChange,
}: {
  slug: string;
  session: StoredRoom;
  chatCollapsed: boolean;
  onToggleChat: () => void;
  quality: QualityPreset;
  onQualityChange: (quality: QualityPreset) => void;
}) {
  const state = useConnectionState();
  const room = useRoomContext();
  const router = useRouter();
  const t = useTranslations();
  const locale = useLocale();
  const participants = useParticipants();
  const role = session.participant.role;
  const connected = state === ConnectionState.Connected;
  const reconnecting = state === ConnectionState.Reconnecting;
  const [ending, setEnding] = useState(false);
  const [endError, setEndError] = useState("");
  const viewerCount = participants.filter((participant) =>
    isViewerRole(roleFromMetadata(participant.metadata)),
  ).length;

  async function leaveRoom() {
    sessionStorage.removeItem(`laminaria-room:${slug}`);
    await room.disconnect();
    router.replace(roomExitHref(slug, role));
  }

  async function copyInviteLink() {
    const inviteUrl = `${window.location.origin}/${locale}/w/${slug}`;
    await navigator.clipboard.writeText(inviteUrl);
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
      router.replace(roomExitHref(slug, role));
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
      <div className="room-brand-cluster">
        <Logo />
        <div className="topbar-viewer-count" title={locale === "ru" ? "Зрители онлайн" : "Viewers online"}>
          <UsersRound size={16} />
          <span>{viewerCount}</span>
        </div>
      </div>
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
        {isViewerRole(role) ? (
          <QualityMenu value={quality} onChange={onQualityChange} variant="topbar" />
        ) : null}
        {canManageStage(role) && session.workspaceId ? (
          <RecordingIndicator session={session} />
        ) : null}
        <RoleBadge role={role} />
        <button type="button" className="room-chat-toggle" onClick={onToggleChat}>
          <MessageCircleMore size={16} />
          {chatCollapsed
            ? locale === "ru"
              ? "Показать чат"
              : "Show chat"
            : locale === "ru"
              ? "Скрыть чат"
              : "Hide chat"}
        </button>
        <button type="button" className="room-invite" onClick={() => void copyInviteLink()}>
          <Link2 size={16} />
          {locale === "ru" ? "Пригласить" : "Invite"}
        </button>
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

function EndWebinarButton({ slug, session }: { slug: string; session: StoredRoom }) {
  const room = useRoomContext();
  const router = useRouter();
  const locale = useLocale();
  const [ending, setEnding] = useState(false);
  const [endError, setEndError] = useState("");

  async function endWebinar() {
    if (ending || !canEndWebinar(session.participant.role)) return;
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
      router.replace(roomExitHref(slug, session.participant.role));
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
    <div className="presenter-end-wrap">
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
      {endError ? (
        <span className="room-end-error" role="alert">
          {endError}
        </span>
      ) : null}
    </div>
  );
}

void EndWebinarButton;

function HostMediaControls({
  preferences,
  variant = "topbar",
}: {
  preferences?: StoredRoom["preferences"];
  variant?: "topbar" | "panel" | "bottom";
}) {
  const locale = useLocale();
  const room = useRoomContext();
  const connectionState = useConnectionState();
  const screenShareTracks = useTracks([Track.Source.ScreenShare], {
    onlySubscribed: false,
  });
  const [cameraOn, setCameraOn] = useState(room.localParticipant.isCameraEnabled);
  const [micOn, setMicOn] = useState(room.localParticipant.isMicrophoneEnabled);
  const [screenOn, setScreenOn] = useState(room.localParticipant.isScreenShareEnabled);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const initialMediaApplied = useRef(false);
  const connected = connectionState === ConnectionState.Connected;
  const screenShareOwner = screenShareTracks.find((trackRef) => !trackRef.participant.isLocal);
  const screenBlockedByOther = Boolean(screenShareOwner && !screenOn);

  useEffect(() => {
    const participant = room.localParticipant;
    const syncMediaState = () => {
      setCameraOn(participant.isCameraEnabled);
      setMicOn(participant.isMicrophoneEnabled);
      setScreenOn(participant.isScreenShareEnabled);
    };

    participant.on(ParticipantEvent.TrackPublished, syncMediaState);
    participant.on(ParticipantEvent.TrackUnpublished, syncMediaState);
    participant.on(ParticipantEvent.TrackMuted, syncMediaState);
    participant.on(ParticipantEvent.TrackUnmuted, syncMediaState);

    return () => {
      participant.off(ParticipantEvent.TrackPublished, syncMediaState);
      participant.off(ParticipantEvent.TrackUnpublished, syncMediaState);
      participant.off(ParticipantEvent.TrackMuted, syncMediaState);
      participant.off(ParticipantEvent.TrackUnmuted, syncMediaState);
    };
  }, [room.localParticipant]);

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
    if (!connected || screenBlockedByOther) return;
    const next = !screenOn;
    if (next && !navigator.mediaDevices?.getDisplayMedia) {
      setMediaError(
        locale === "ru"
          ? "Этот мобильный браузер не разрешает сайтам захватывать экран. Откройте эфир в Android Chrome/Edge с поддержкой демонстрации или используйте компьютер."
          : "This mobile browser does not allow websites to capture the screen. Use a supported Android Chrome/Edge version or a computer.",
      );
      return;
    }
    try {
      const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      await room.localParticipant.setScreenShareEnabled(
        next,
        next
          ? {
              audio: !mobile,
              resolution: ScreenSharePresets.original.resolution,
              ...(mobile ? {} : { selfBrowserSurface: "exclude" as const }),
            }
          : undefined,
        next
          ? {
              simulcast: true,
              screenShareEncoding: ScreenSharePresets.original.encoding,
              screenShareSimulcastLayers: [
                ScreenSharePresets.h720fps15,
                ScreenSharePresets.h1080fps30,
              ],
            }
          : undefined,
      );
      if (next && !room.localParticipant.isCameraEnabled) {
        await room.localParticipant.setCameraEnabled(true);
        setCameraOn(true);
      }
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
    <div className={`host-media-controls-wrap host-media-controls-wrap--${variant}`}>
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
          disabled={!connected || screenBlockedByOther}
          title={
            screenBlockedByOther
              ? locale === "ru"
                ? "Демонстрацию уже показывает другой ведущий"
                : "Another presenter is already sharing"
              : undefined
          }
        >
          <MonitorUp size={17} />
          {locale === "ru" ? "Экран" : "Screen"}
        </button>
      </div>
      {mediaError ? <p className="host-media-controls__error">{mediaError}</p> : null}
    </div>
  );
}

function LiveInviteDialog({ session, onClose }: { session: StoredRoom; onClose: () => void }) {
  const locale = useLocale();
  const participants = useParticipants();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"COHOST" | "SPEAKER" | "MODERATOR">("SPEAKER");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const canAssign = Boolean(session.workspaceId) && canManageStage(session.participant.role);

  async function submit() {
    const cleanEmail = email.trim();
    if (!cleanEmail || !session.workspaceId || busy) return;
    setBusy(true);
    setStatus("");
    try {
      await api.assignWebinarHost(session.workspaceId, session.webinarId, { email: cleanEmail, role });
      setStatus(locale === "ru" ? "Роль назначена. Пользователь может зайти в эфир." : "Role assigned. User can join the live room.");
      setEmail("");
    } catch (reason) {
      setStatus(reason instanceof Error ? reason.message : locale === "ru" ? "Не удалось пригласить." : "Invite failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="live-invite-modal" role="dialog" aria-modal="true">
      <button type="button" className="live-invite-modal__backdrop" onClick={onClose} aria-label="Close" />
      <section className="live-invite-modal__panel">
        <header>
          <div>
            <strong>{locale === "ru" ? "Пригласить в эфир" : "Invite on stage"}</strong>
            <p>
              {locale === "ru"
                ? "Назначь спикера или соведущего по email. Если он уже назначен — просто заходит в трансляцию."
                : "Assign a speaker or co-host by email. If already assigned, they just join the broadcast."}
            </p>
          </div>
          <button type="button" onClick={onClose}>
            <X size={17} />
          </button>
        </header>
        <label>
          <span>Email</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder={liveRoleEmailPlaceholder(role, locale)}
          />
        </label>
        <label>
          <span>{locale === "ru" ? "Роль" : "Role"}</span>
          <StyledSelect value={role} ariaLabel={locale === "ru" ? "Роль" : "Role"} options={[{ value: "SPEAKER", label: locale === "ru" ? "Спикер" : "Speaker" }, { value: "COHOST", label: locale === "ru" ? "Соведущий" : "Co-host" }, { value: "MODERATOR", label: locale === "ru" ? "Модератор" : "Moderator" }]} onChange={setRole} />
        </label>
        <button type="button" className="live-invite-modal__submit" onClick={() => void submit()} disabled={!canAssign || !email.trim() || busy}>
          {busy ? <LoaderCircle className="spin" size={17} /> : <UsersRound size={17} />}
          {locale === "ru" ? "Назначить" : "Assign"}
        </button>
        {!canAssign ? (
          <p className="live-invite-modal__status">
            {locale === "ru" ? "Назначать роли может только главный ведущий/соведущий." : "Only host/co-host can assign stage roles."}
          </p>
        ) : null}
        {status ? <p className="live-invite-modal__status">{status}</p> : null}
        <div className="live-invite-modal__online">
          <strong>{locale === "ru" ? "Сейчас в комнате" : "In room now"}</strong>
          {participants.slice(0, 6).map((participant) => (
            <span key={participant.identity}>{participant.name || participant.identity}</span>
          ))}
        </div>
      </section>
    </div>
  );
}

function RealtimePanel({
  slug,
  session,
  onEnded,
  onStageLayoutChange,
  activePanel,
  quality,
  onQualityChange,
  collapsed,
  onToggleCollapsed,
}: {
  slug: string;
  session: StoredRoom;
  onEnded: (status: EndedStatus) => void;
  onStageLayoutChange: (layout: StageLayout) => void;
  activePanel: RoomPanel;
  quality: QualityPreset;
  onQualityChange: (quality: QualityPreset) => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}) {
  const locale = useLocale();
  const t = useTranslations();
  const room = useRoomContext();
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [restrictions, setRestrictions] = useState<Restriction[]>([]);
  const [text, setText] = useState("");
  const [connected, setConnected] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [viewerChatEnabled, setViewerChatEnabled] = useState(false);
  const [moderationTarget, setModerationTarget] = useState<Actor | null>(null);
  const [answeringQuestionId, setAnsweringQuestionId] = useState<string | null>(null);
  const [answerText, setAnswerText] = useState("");
  const [restrictionClock, setRestrictionClock] = useState(() => Date.now());
  const socketRef = useRef<Socket | null>(null);
  const viewer = isViewerRole(session.participant.role);
  const canModerateChat = canModerate(session.participant.role);
  const chatLocked = viewer && !viewerChatEnabled;
  const participants = useParticipants();

  useEffect(() => {
    if (!restrictions.some((restriction) => restriction.active && restriction.until)) return;
    const timer = window.setInterval(() => setRestrictionClock(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [restrictions]);

  useEffect(() => {
    const socket = io(api.realtimeOrigin, {
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
    socket.on("stage:layout", (layout: StageLayoutEvent) => {
      if (layout.webinarId !== session.webinarId) return;
      onStageLayoutChange({
        position: layout.position,
        sizePercent: layout.sizePercent,
        widthPercent: layout.widthPercent ?? layout.sizePercent,
        heightPercent: layout.heightPercent ?? layout.sizePercent,
      });
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
    return () => {
      socket.emit("webinar:leave", { webinarId: session.webinarId });
      socket.disconnect();
      socketRef.current = null;
    };
  }, [locale, onEnded, onStageLayoutChange, room, router, session, slug]);

  async function send() {
    const body = text.trim();
    const socket = socketRef.current;
    if (!body || !socket?.connected || chatLocked) return;
    setSending(true);
    setError("");
    socket.emit(
      "chat:send",
      { webinarId: session.webinarId, idempotencyKey: crypto.randomUUID(), body },
      (ack: Ack<ChatMessage>) => {
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

  const tab = "chat" as const;
  const items = messages;
  const activeRestrictions = restrictions.filter(
    (restriction) =>
      restriction.active &&
      (!restriction.until || new Date(restriction.until).getTime() > restrictionClock),
  );
  const viewerCount = participants.filter((participant) =>
    isViewerRole(roleFromMetadata(participant.metadata)),
  ).length;

  if (collapsed) {
    return (
      <aside className="realtime-panel realtime-panel--collapsed">
        <button type="button" onClick={onToggleCollapsed}>
          <MessageCircleMore size={18} />
          {locale === "ru" ? "Открыть чат" : "Open chat"}
        </button>
      </aside>
    );
  }

  return (
    <aside className="realtime-panel">
      <header className="room-panel-title">
        <div>
          <strong>{roomPanelTitle(activePanel, locale)}</strong>
          <span>{roomPanelSubtitle(activePanel, locale, messages.length, participants.length)}</span>
        </div>
        <button type="button" className="room-panel-collapse" onClick={onToggleCollapsed}>
          <X size={16} />
          {locale === "ru" ? "Свернуть" : "Collapse"}
        </button>
      </header>

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

      {activePanel === "settings" ? (
        <section className="room-settings-card">
          <header>
            <Settings size={16} />
            <strong>{locale === "ru" ? "Качество просмотра" : "Viewing quality"}</strong>
          </header>
          <QualityMenu value={quality} onChange={onQualityChange} variant="settings" />
        </section>
      ) : null}

      {activePanel === "settings" && canManageStage(session.participant.role) ? (
        <section className="room-side-card">
          <MonitorUp size={18} />
          <div>
            <strong>{locale === "ru" ? "Вебки регулируются автоматически" : "Cameras are automatic"}</strong>
            <p>
              {locale === "ru"
                ? "Слева показывается до 3 ведущих. Размеры меняются сами от количества активных камер."
                : "Up to 3 presenters appear on the left. Tile sizes adapt automatically."}
            </p>
          </div>
        </section>
      ) : null}

      {activePanel === "chat" && canModerateChat ? (
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

      {activePanel === "stage" ? (
        <RoomStagePanel locale={locale} viewerCount={viewerCount} canPublish={canPublishMedia(session.participant.role)} />
      ) : null}

      {activePanel === "participants" ? (
        <RoomParticipantsPanel participants={participants} locale={locale} />
      ) : null}

      {activePanel === "stats" ? (
        <RoomStatsPanel
          locale={locale}
          viewerCount={viewerCount}
          participantCount={participants.length}
          messageCount={messages.length}
          restrictionCount={activeRestrictions.length}
          chatEnabled={viewerChatEnabled}
        />
      ) : null}

      <div className={`realtime-list ${activePanel === "chat" ? "" : "is-hidden"}`} role="log" aria-live="polite">
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

      {activePanel === "settings" && canModerateChat && activeRestrictions.length > 0 ? (
        <div className="restriction-list">
          <strong>{locale === "ru" ? "Ограничения эфира" : "Live restrictions"}</strong>
          {activeRestrictions.map((restriction) => (
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
                  {locale === "ru" ? "Снять мьют" : "Unmute"}
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
                  {locale === "ru" ? "Разбанить" : "Unban"}
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
            restrictions={activeRestrictions.filter(
              (restriction) => restriction.targetId === moderationTarget.id,
            )}
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

      {activePanel === "chat" ? (
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
          onKeyDown={(event) => {
            if (
              event.key === "Enter" &&
              !event.shiftKey &&
              !event.nativeEvent.isComposing
            ) {
              event.preventDefault();
              void send();
            }
          }}
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
      ) : null}

      {activePanel === "chat" && chatLocked ? (
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

function RoomStagePanel({
  locale,
  viewerCount,
  canPublish,
}: {
  locale: string;
  viewerCount: number;
  canPublish: boolean;
}) {
  return (
    <section className="room-side-card">
      <Tv size={18} />
      <div>
        <strong>{locale === "ru" ? "Сцена эфира" : "Live stage"}</strong>
        <p>
          {canPublish
            ? locale === "ru"
              ? "Камера, микрофон и демонстрация включаются в панели ведущего слева."
              : "Camera, mic, and screen share are controlled from the presenter panel."
            : locale === "ru"
              ? "Вы смотрите сцену как зритель. Камера и микрофон для зрителей отключены."
              : "You are watching as an attendee. Camera and mic are disabled for viewers."}
        </p>
      </div>
      <span>{locale === "ru" ? `${viewerCount} зрителей` : `${viewerCount} viewers`}</span>
    </section>
  );
}

function RoomParticipantsPanel({
  participants,
  locale,
}: {
  participants: ReturnType<typeof useParticipants>;
  locale: string;
}) {
  return (
    <div className="room-participants-panel">
      {participants.map((participant) => {
        const role = roleFromMetadata(participant.metadata);
        const name = participant.name || participant.identity;
        return (
          <article key={participant.identity} className="room-participant-row">
            <span>{name.slice(0, 1).toUpperCase()}</span>
            <div>
              <strong>{name}</strong>
              <small>{roleLabel(role, locale)}</small>
            </div>
            <i className={participant.isSpeaking ? "is-speaking" : ""}>
              {participant.isSpeaking ? (locale === "ru" ? "говорит" : "speaking") : "online"}
            </i>
          </article>
        );
      })}
    </div>
  );
}

function RoomStatsPanel({
  locale,
  viewerCount,
  participantCount,
  messageCount,
  restrictionCount,
  chatEnabled,
}: {
  locale: string;
  viewerCount: number;
  participantCount: number;
  messageCount: number;
  restrictionCount: number;
  chatEnabled: boolean;
}) {
  const stats = [
    { label: locale === "ru" ? "Зрители" : "Viewers", value: viewerCount },
    { label: locale === "ru" ? "Всего в комнате" : "In room", value: participantCount },
    { label: locale === "ru" ? "Сообщения" : "Messages", value: messageCount },
    { label: locale === "ru" ? "Ограничения" : "Restrictions", value: restrictionCount },
  ];
  return (
    <div className="room-stats-panel">
      {stats.map((stat) => (
        <article key={stat.label}>
          <strong>{stat.value}</strong>
          <span>{stat.label}</span>
        </article>
      ))}
      <section className="room-side-card">
        <MessageCircleMore size={18} />
        <div>
          <strong>{locale === "ru" ? "Чат зрителей" : "Viewer chat"}</strong>
          <p>{chatEnabled ? (locale === "ru" ? "Открыт" : "Open") : locale === "ru" ? "Закрыт" : "Closed"}</p>
        </div>
      </section>
    </div>
  );
}

function roomPanelTitle(panel: RoomPanel, locale: string): string {
  if (panel === "stage") return locale === "ru" ? "Сцена" : "Stage";
  if (panel === "participants") return locale === "ru" ? "Участники" : "Participants";
  if (panel === "stats") return locale === "ru" ? "Статистика" : "Stats";
  if (panel === "settings") return locale === "ru" ? "Настройки" : "Settings";
  return locale === "ru" ? "Чат" : "Chat";
}

function roomPanelSubtitle(panel: RoomPanel, locale: string, messageCount: number, participantCount: number): string {
  if (panel === "chat") return locale === "ru" ? `${messageCount} сообщений` : `${messageCount} messages`;
  if (panel === "participants") return locale === "ru" ? `${participantCount} онлайн` : `${participantCount} online`;
  if (panel === "settings") return locale === "ru" ? "Качество и сцена" : "Quality and stage";
  if (panel === "stats") return locale === "ru" ? "Живые показатели" : "Live metrics";
  return locale === "ru" ? "Управление сценой" : "Stage control";
}

function ModerationDialog({
  actor,
  locale,
  restrictions,
  onClose,
  onRestrict,
}: {
  actor: Actor;
  locale: string;
  restrictions: Restriction[];
  onClose: () => void;
  onRestrict: (action: Restriction["action"], durationMinutes?: number | null) => void;
}) {
  const muted = restrictions.some((restriction) => restriction.action === "mute");
  const banned = restrictions.some((restriction) => restriction.action === "ban");
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
            {muted ? (
              <button type="button" className="is-release" onClick={() => onRestrict("unmute")}>
                {locale === "ru" ? "Снять мьют" : "Unmute"}
              </button>
            ) : null}
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
            {banned ? (
              <button type="button" className="is-release" onClick={() => onRestrict("unban")}>
                {locale === "ru" ? "Разбанить" : "Unban"}
              </button>
            ) : null}
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

function presenterLabel(role: Role, locale: string, index: number): string {
  if (role === "OWNER" || role === "HOST") return locale === "ru" ? "Ведущий" : "Host";
  if (role === "COHOST") return locale === "ru" ? "Соведущий" : "Co-host";
  if (role === "SPEAKER") return locale === "ru" ? "Спикер" : "Speaker";
  return index === 0 ? (locale === "ru" ? "Ведущий" : "Host") : locale === "ru" ? "Гость" : "Guest";
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

function canManageStage(role: Role): boolean {
  return role === "OWNER" || role === "HOST" || role === "COHOST";
}

function liveRoleEmailPlaceholder(
  role: "COHOST" | "SPEAKER" | "MODERATOR",
  locale: string,
): string {
  if (locale === "ru") {
    if (role === "SPEAKER") return "email спикера";
    if (role === "COHOST") return "email соведущего";
    return "email модератора";
  }

  if (role === "SPEAKER") return "speaker email";
  if (role === "COHOST") return "co-host email";
  return "moderator email";
}

function canInviteOnStage(role: Role): boolean {
  return role === "OWNER" || role === "HOST" || role === "COHOST";
}

function isViewerRole(role: string): boolean {
  return role === "ATTENDEE" || role === "GUEST";
}

function canModerate(role: string): boolean {
  return role === "OWNER" || role === "HOST" || role === "MODERATOR";
}

function roomExitHref(slug: string, role: Role): string {
  return canManageStage(role) || role === "MODERATOR" || role === "SPEAKER" ? "/dashboard" : `/w/${slug}`;
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

function qualityHint(quality: QualityPreset, locale: string): string {
  const hints: Record<QualityPreset, readonly [string, string]> = {
    "144p": ["Экономия трафика", "Data saver"],
    "240p": ["Слабая сеть", "Slow network"],
    "480p": ["Сбалансировано", "Balanced"],
    "720p": ["Высокое качество", "High quality"],
    "1080p": ["Максимум", "Maximum"],
  };
  return hints[quality][locale === "ru" ? 0 : 1];
}

function qualityToDimensions(quality: QualityPreset): { width: number; height: number } {
  const height = Number.parseInt(quality, 10);
  return { width: Math.round((height * 16) / 9), height };
}
