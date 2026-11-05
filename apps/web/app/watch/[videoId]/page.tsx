import { WatchPage } from "@/components/watch-page";

export default async function Page({ params }: { params: Promise<{ videoId: string }> }) {
  const { videoId } = await params;
  return <WatchPage videoId={videoId} />;
}