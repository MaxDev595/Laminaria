import { RecordingPlayback } from "@/components/recording-playback";

export default async function RecordingPage({
  params,
}: {
  params: Promise<{ recordingId: string }>;
}) {
  const { recordingId } = await params;
  return <RecordingPlayback recordingId={recordingId} />;
}
