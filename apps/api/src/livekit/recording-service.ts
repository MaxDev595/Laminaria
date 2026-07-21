import {
  EgressClient,
  EncodedFileOutput,
  EncodedFileType,
  EncodingOptionsPreset,
  S3Upload,
} from "livekit-server-sdk";
import type { AppConfig } from "../config.js";

export interface CompletedRecording {
  externalId: string;
  storageKey: string;
  playbackUrl: string | null;
  sizeBytes: number | null;
  durationSeconds: number | null;
}

export class LiveKitRecordingService {
  readonly #client: EgressClient | null;
  readonly #storage: AppConfig["storage"];

  constructor(livekit: AppConfig["livekit"], storage: AppConfig["storage"]) {
    this.#storage = storage;
    this.#client =
      livekit && storage
        ? new EgressClient(toHttpUrl(livekit.url), livekit.apiKey, livekit.apiSecret)
        : null;
  }

  get configured(): boolean {
    return this.#client !== null && this.#storage !== null;
  }

  async start(roomName: string, webinarId: string): Promise<CompletedRecording> {
    if (!this.#client || !this.#storage) throw new Error("LiveKit Egress storage is not configured");
    const storageKey = `recordings/${webinarId}/${Date.now()}.mp4`;
    const output = new EncodedFileOutput({
      fileType: EncodedFileType.MP4,
      filepath: storageKey,
      output: {
        case: "s3",
        value: new S3Upload({
          accessKey: this.#storage.accessKeyId,
          secret: this.#storage.secretAccessKey,
          region: this.#storage.region,
          endpoint: this.#storage.endpoint,
          bucket: this.#storage.bucket,
          forcePathStyle: true,
        }),
      },
    });
    const info = await this.#client.startRoomCompositeEgress(roomName, output, {
      layout: "speaker",
      encodingOptions: EncodingOptionsPreset.H264_1080P_30,
    });
    return {
      externalId: info.egressId,
      storageKey,
      playbackUrl: publicObjectUrl(this.#storage, storageKey),
      sizeBytes: null,
      durationSeconds: null,
    };
  }

  async stop(externalId: string, storageKey: string): Promise<CompletedRecording> {
    if (!this.#client || !this.#storage) throw new Error("LiveKit Egress storage is not configured");
    const info = await this.#client.stopEgress(externalId);
    const file = info.fileResults[0];
    const finalKey = file?.filename || storageKey;
    return {
      externalId,
      storageKey: finalKey,
      playbackUrl:
        file?.location && /^https?:\/\//i.test(file.location)
          ? file.location
          : publicObjectUrl(this.#storage, finalKey),
      sizeBytes: file ? safeBigIntNumber(file.size) : null,
      durationSeconds: file ? Math.max(0, Math.round(safeBigIntNumber(file.duration) / 1_000_000_000)) : null,
    };
  }
}

function toHttpUrl(value: string): string {
  return value.replace(/^wss:/, "https:").replace(/^ws:/, "http:");
}

function publicObjectUrl(storage: NonNullable<AppConfig["storage"]>, key: string): string | null {
  if (!storage.publicUrl) return null;
  return `${storage.publicUrl.replace(/\/$/, "")}/${key
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
}

function safeBigIntNumber(value: bigint): number {
  const number = Number(value);
  return Number.isSafeInteger(number) ? number : Number.MAX_SAFE_INTEGER;
}
