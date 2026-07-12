import { Logo, Skeleton } from "@laminaria/ui";

export default function Loading() {
  return (
    <main className="route-loading" aria-busy="true" aria-label="Loading">
      <Logo />
      <div className="route-loading__grid">
        <Skeleton style={{ height: "2.5rem", width: "55%" }} />
        <Skeleton style={{ height: "1rem", width: "80%" }} />
        <Skeleton style={{ height: "12rem" }} />
      </div>
    </main>
  );
}
