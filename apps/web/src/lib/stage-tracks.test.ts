import { Track } from "livekit-client";
import { describe, expect, it } from "vitest";

import { orderBroadcastTracks } from "./stage-tracks";

function stageTrack(identity: string, source: Track.Source) {
  return { source, participant: { identity } };
}

describe("orderBroadcastTracks", () => {
  it("keeps the presenter's camera directly after their screen share", () => {
    const guestCamera = stageTrack("guest", Track.Source.Camera);
    const presenterCamera = stageTrack("host", Track.Source.Camera);
    const presenterScreen = stageTrack("host", Track.Source.ScreenShare);

    expect(orderBroadcastTracks([guestCamera, presenterCamera, presenterScreen])).toEqual([
      presenterScreen,
      presenterCamera,
      guestCamera,
    ]);
  });

  it("preserves camera-only stages", () => {
    const hostCamera = stageTrack("host", Track.Source.Camera);
    const speakerCamera = stageTrack("speaker", Track.Source.Camera);

    expect(orderBroadcastTracks([hostCamera, speakerCamera])).toEqual([hostCamera, speakerCamera]);
  });
});
