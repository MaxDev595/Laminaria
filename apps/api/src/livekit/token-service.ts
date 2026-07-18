import { AccessToken, RoomServiceClient, TrackSource, type VideoGrant } from "livekit-server-sdk";
import type { ParticipantRole, WebinarRecord } from "../domain/models.js";
import { AppError, ServiceNotConfiguredError } from "../errors.js";
import { hasWebinarPermission } from "../auth/rbac.js";

export interface LiveKitTokenResult {
  token: string;
  url: string;
  expiresInSeconds: number;
  roomName: string;
  identity: string;
}

export class LiveKitTokenService {
  public constructor(
    private readonly config: {
      url: string;
      apiKey: string;
      apiSecret: string;
      tokenTtlSeconds: number;
    } | null,
  ) {}

  public get configured(): boolean {
    return this.config !== null;
  }

  public async countParticipants(roomName: string): Promise<number> {
    if (!this.config) throw new ServiceNotConfiguredError("LiveKit");
    const rooms = this.roomService();
    try {
      return (await rooms.listParticipants(roomName)).length;
    } catch (error) {
      if (isMissingRoomError(error)) return 0;
      throw error;
    }
  }

  public async removeParticipantsBySubject(roomName: string, subject: string): Promise<void> {
    if (!this.config) return;
    const rooms = this.roomService();
    let participants;
    try {
      participants = await rooms.listParticipants(roomName);
    } catch (error) {
      if (isMissingRoomError(error)) return;
      throw error;
    }
    const matching = participants.filter(
      (participant) => participantSubject(participant.metadata) === subject,
    );
    await Promise.all(
      matching.map((participant) => rooms.removeParticipant(roomName, participant.identity)),
    );
  }

  public async closeRoom(roomName: string): Promise<void> {
    if (!this.config) return;
    const rooms = this.roomService();

    try {
      await rooms.deleteRoom(roomName);
    } catch (error) {
      if (isMissingRoomError(error)) return;
      throw error;
    }
  }

  public async issue(input: {
    webinar: WebinarRecord;
    identity: string;
    displayName: string;
    role: ParticipantRole;
    metadata?: Readonly<Record<string, string>>;
  }): Promise<LiveKitTokenResult> {
    if (!this.config) throw new ServiceNotConfiguredError("LiveKit");
    if (input.webinar.status !== "LIVE") {
      throw new AppError(409, "CONFLICT", "The webinar room is not open", {
        status: input.webinar.status,
      });
    }

    const canPublish = hasWebinarPermission(input.role, "webinar:publish_media");
    const canModerate = hasWebinarPermission(input.role, "webinar:moderate");
    const grant: VideoGrant = {
      roomJoin: true,
      room: input.webinar.livekitRoomName,
      canSubscribe: true,
      canPublish,
      canPublishData: canPublish || canModerate,
      canUpdateOwnMetadata: false,
      ...(canPublish
        ? {
            canPublishSources: [
              TrackSource.CAMERA,
              TrackSource.MICROPHONE,
              TrackSource.SCREEN_SHARE,
              TrackSource.SCREEN_SHARE_AUDIO,
            ],
          }
        : {}),
      ...(canModerate ? { roomAdmin: true } : {}),
    };
    const token = new AccessToken(this.config.apiKey, this.config.apiSecret, {
      identity: input.identity,
      name: input.displayName,
      ttl: this.config.tokenTtlSeconds,
      metadata: JSON.stringify({ role: input.role, ...input.metadata }),
    });
    token.addGrant(grant);

    return {
      token: await token.toJwt(),
      url: this.config.url,
      expiresInSeconds: this.config.tokenTtlSeconds,
      roomName: input.webinar.livekitRoomName,
      identity: input.identity,
    };
  }

  private roomService(): RoomServiceClient {
    if (!this.config) throw new ServiceNotConfiguredError("LiveKit");
    return new RoomServiceClient(
      toLiveKitApiUrl(this.config.url),
      this.config.apiKey,
      this.config.apiSecret,
    );
  }
}

function toLiveKitApiUrl(url: string): string {
  if (url.startsWith("wss://")) return `https://${url.slice("wss://".length)}`;
  if (url.startsWith("ws://")) return `http://${url.slice("ws://".length)}`;
  return url;
}

function isMissingRoomError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const record = error as Record<string, unknown>;
  const code = record["code"] ?? record["status"] ?? record["statusCode"];
  if (code === 404 || code === "404" || code === 5 || code === "not_found") {
    return true;
  }
  const message = typeof record["message"] === "string" ? record["message"] : "";
  return /not\s*found|room.*does.*not.*exist/i.test(message);
}

function participantSubject(metadata: string): string | null {
  try {
    const parsed = JSON.parse(metadata) as { subject?: unknown };
    return typeof parsed.subject === "string" ? parsed.subject : null;
  } catch {
    return null;
  }
}
