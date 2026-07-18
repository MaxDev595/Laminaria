import { Track } from "livekit-client";

interface StageTrack {
  source: Track.Source;
  participant: { identity: string };
}

export function orderBroadcastTracks<T extends StageTrack>(tracks: readonly T[]): T[] {
  const screenTracks = tracks.filter((track) => track.source === Track.Source.ScreenShare);
  if (screenTracks.length === 0) return [...tracks];

  const primaryScreen = screenTracks[0];
  const presenterCamera = tracks.find(
    (track) =>
      track.source === Track.Source.Camera &&
      track.participant.identity === primaryScreen.participant.identity,
  );

  return [
    primaryScreen,
    ...(presenterCamera ? [presenterCamera] : []),
    ...screenTracks.slice(1),
    ...tracks.filter((track) => track.source === Track.Source.Camera && track !== presenterCamera),
  ];
}
