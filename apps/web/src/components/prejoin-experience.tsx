"use client";

import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Camera,
  CameraOff,
  Check,
  Headphones,
  LoaderCircle,
  Mic,
  MicOff,
  Radio,
  RefreshCw,
  Settings2,
  ShieldCheck,
  Video,
} from "lucide-react";
import { motion } from "motion/react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

import { Link, useRouter } from "@/i18n/navigation";
import { api, friendlyError } from "@/lib/api";
import { Badge, Button, Logo, Skeleton } from "@laminaria/ui";
import { LanguageSwitcher } from "./language-switcher";
import { Field, Input, Select, ServiceState } from "./ui";

export function PrejoinExperience({ slug }: { slug: string }) {
  const locale = useLocale();
  const t = useTranslations();
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const query = useQuery({
    queryKey: ["public-webinar", slug],
    queryFn: ({ signal }) => api.publicWebinar(slug, signal),
  });
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [cameraId, setCameraId] = useState("");
  const [micId, setMicId] = useState("");
  const [cameraOn, setCameraOn] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const [permission, setPermission] = useState<"idle" | "requesting" | "granted" | "denied" | "unavailable">("idle");
  const [name, setName] = useState("");
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState("");

  const subscribeStorage = useCallback(() => () => undefined, []);
  const accessToken = useSyncExternalStore(
    subscribeStorage,
    () => sessionStorage.getItem(`laminaria-access:${slug}`),
    () => null,
  );

  useEffect(
    () => () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    },
    [],
  );

  const startPreview = useCallback(
    async (nextCameraId = cameraId, nextMicId = micId) => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setPermission("unavailable");
        return;
      }
      setPermission("requesting");
      setError("");
      try {
        streamRef.current?.getTracks().forEach((track) => track.stop());
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
        setPermission("granted");
      } catch (reason) {
        setPermission(reason instanceof DOMException && reason.name === "NotFoundError" ? "unavailable" : "denied");
        setCameraOn(false);
        setMicOn(false);
        if (videoRef.current) videoRef.current.srcObject = null;
      }
    },
    [cameraId, cameraOn, micId, micOn],
  );

  function toggleTrack(kind: "video" | "audio") {
    const on = kind === "video" ? cameraOn : micOn;
    const next = !on;
    if (kind === "video") setCameraOn(next);
    else setMicOn(next);
    const track = kind === "video" ? streamRef.current?.getVideoTracks()[0] : streamRef.current?.getAudioTracks()[0];
    if (track) track.enabled = next;
  }

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

  async function join() {
    setJoining(true);
    setError("");
    try {
      const webinar = query.data?.webinar;
      if (!webinar) return;
      const input = accessToken ? { accessToken } : { guestName: name.trim() };
      const payload = await api.prejoin(slug, input);
      sessionStorage.setItem(
        `laminaria-room:${slug}`,
        JSON.stringify({
          ...payload,
          preferences: {
            cameraOn: permission === "granted" && cameraOn,
            micOn: permission === "granted" && micOn,
          },
        }),
      );
      router.push(`/room/${slug}`);
    } catch (reason) {
      setError(friendlyError(reason, locale));
    } finally {
      setJoining(false);
    }
  }

  if (query.isLoading) {
    return (
      <main className="prejoin-shell">
        <Skeleton style={{ height: 500 }} />
      </main>
    );
  }

  if (query.isError) {
    return (
      <main className="dashboard-gate">
        <Logo />
        <ServiceState
          icon={<AlertTriangle size={20} />}
          title={locale === "ru" ? "Pre-join недоступен" : "Pre-join is unavailable"}
          description={friendlyError(query.error, locale)}
        />
      </main>
    );
  }

  const webinar = query.data!.webinar;
  const live = webinar.status === "LIVE";
  const canEnter = live && (Boolean(accessToken) || (webinar.allowGuests && name.trim().length > 0));
  const videoDevices = devices.filter((device) => device.kind === "videoinput");
  const audioDevices = devices.filter((device) => device.kind === "audioinput");

  return (
    <main className="prejoin-shell">
      <header className="prejoin-header">
        <Link href={`/w/${slug}`} className="auth-back">
          <ArrowLeft size={16} />
          {t("common.back")}
        </Link>
        <Logo />
        <LanguageSwitcher />
      </header>

      <div className="prejoin-grid">
        <motion.section className="preview-card" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}>
          <div className="preview-frame">
            {permission === "granted" && cameraOn ? (
              <video ref={videoRef} autoPlay muted playsInline />
            ) : (
              <div className="preview-empty">
                <span>{name.trim().slice(0, 1).toUpperCase() || <Video size={28} />}</span>
                <p>
                  {permission === "idle"
                    ? locale === "ru" ? "Включите проверку устройств" : "Start the device check"
                    : permission === "requesting"
                      ? locale === "ru" ? "Ждём разрешение браузера…" : "Waiting for browser permission…"
                      : permission === "unavailable"
                        ? locale === "ru" ? "Камера или микрофон не найдены" : "No camera or microphone found"
                        : locale === "ru" ? "Доступ к устройствам заблокирован" : "Device access is blocked"}
                </p>
              </div>
            )}
            <div className="preview-name">{name.trim() || (locale === "ru" ? "Ваше имя" : "Your name")}</div>
          </div>

          <div className="preview-controls">
            <button type="button" className={micOn ? "is-on" : ""} onClick={() => toggleTrack("audio")} disabled={permission !== "granted"} aria-label={t("room.microphone")}>
              {micOn ? <Mic size={19} /> : <MicOff size={19} />}
            </button>
            <button type="button" className={cameraOn ? "is-on" : ""} onClick={() => toggleTrack("video")} disabled={permission !== "granted"} aria-label={t("room.camera")}>
              {cameraOn ? <Camera size={19} /> : <CameraOff size={19} />}
            </button>
            <button type="button" onClick={() => void testSpeaker()} aria-label={t("room.speaker")}>
              <Headphones size={19} />
            </button>
            <button type="button" onClick={() => void startPreview()} aria-label={locale === "ru" ? "Проверить устройства снова" : "Check devices again"}>
              {permission === "requesting" ? <LoaderCircle className="spin" size={19} /> : <RefreshCw size={19} />}
            </button>
          </div>
        </motion.section>

        <motion.aside className="prejoin-panel" initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }}>
          <Badge tone={live ? "danger" : "primary"}>{live ? t("dashboard.liveNow") : t("dashboard.scheduled")}</Badge>
          <h1>{t("room.prejoinTitle")}</h1>
          <p>{t("room.prejoinSubtitle")}</p>

          <div className="prejoin-event">
            <strong>{webinar.title}</strong>
            <span>
              <Radio size={15} />
              {live ? (locale === "ru" ? "Комната открыта" : "Room is open") : (locale === "ru" ? "Комната ещё не открыта" : "Room is not open yet")}
            </span>
          </div>

          {!accessToken ? (
            <Field
              label={t("room.displayName")}
              hint={
                webinar.allowGuests
                  ? locale === "ru" ? "Имя увидят другие участники" : "Other participants will see this name"
                  : locale === "ru" ? "Для входа нужна подтверждённая регистрация" : "A confirmed registration is required"
              }
            >
              <Input value={name} onChange={(event) => setName(event.target.value)} disabled={!webinar.allowGuests} />
            </Field>
          ) : (
            <div className="access-ready">
              <Check size={17} />
              {locale === "ru" ? "Защищённая регистрация найдена" : "Secure registration found"}
            </div>
          )}

          {permission === "granted" ? (
            <div className="device-selectors">
              <Field label={locale === "ru" ? "Камера" : "Camera"}>
                <Select value={cameraId} onChange={(event) => { const value = event.target.value; setCameraId(value); void startPreview(value, micId); }}>
                  {videoDevices.map((device, index) => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {device.label || `${locale === "ru" ? "Камера" : "Camera"} ${index + 1}`}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={locale === "ru" ? "Микрофон" : "Microphone"}>
                <Select value={micId} onChange={(event) => { const value = event.target.value; setMicId(value); void startPreview(cameraId, value); }}>
                  {audioDevices.map((device, index) => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {device.label || `${locale === "ru" ? "Микрофон" : "Microphone"} ${index + 1}`}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          ) : null}

          {permission === "idle" ? (
            <Button variant="secondary" onClick={() => void startPreview()}>
              <Settings2 size={17} />
              {locale === "ru" ? "Проверить камеру и микрофон" : "Check camera and microphone"}
            </Button>
          ) : null}

          {permission === "denied" || permission === "unavailable" ? (
            <ServiceState
              icon={<AlertTriangle size={18} />}
              title={t("room.permissionDenied")}
              description={locale === "ru" ? "Можно войти только для просмотра — доступ к устройствам не требуется." : "You can still join receive-only without granting device access."}
            />
          ) : null}

          <div className="recording-notice">
            <ShieldCheck size={18} />
            <span>
              {locale === "ru"
                ? "Перед началом записи Laminaria покажет заметное уведомление и запросит подтверждение."
                : "Before recording begins, Laminaria shows a visible notice and requests consent."}
            </span>
          </div>

          {error ? (
            <div className="form-alert">
              <AlertTriangle size={17} />
              {error}
            </div>
          ) : null}

          <Button size="lg" onClick={() => void join()} disabled={!canEnter || joining}>
            {joining ? <LoaderCircle className="spin" size={18} /> : <ArrowRight size={18} />}
            {t("room.join")}
          </Button>

          {live && !accessToken && !webinar.allowGuests ? (
            <Link href={`/w/${slug}`} className="guest-entry">
              {locale === "ru" ? "Вернуться к регистрации" : "Return to registration"}
            </Link>
          ) : null}
        </motion.aside>
      </div>
    </main>
  );
}
