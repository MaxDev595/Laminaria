"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WifiOff } from "lucide-react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { useLocale } from "next-intl";
import { useEffect, useState, type ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
          mutations: { retry: 0 },
        },
      }),
  );

  return (
    <MotionConfig reducedMotion="user" transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}>
      <QueryClientProvider client={queryClient}>
        {children}
        <NetworkNotice />
      </QueryClientProvider>
    </MotionConfig>
  );
}

function NetworkNotice() {
  const locale = useLocale();
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  return (
    <AnimatePresence>
      {!online ? (
        <motion.div
          className="network-notice"
          role="status"
          initial={{ opacity: 0, y: 18, scale: 0.96, filter: "blur(8px)" }}
          animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
          exit={{ opacity: 0, y: 12, scale: 0.98, filter: "blur(6px)" }}
        >
          <WifiOff size={17} aria-hidden="true" />
          {locale === "ru"
            ? "Нет сети. Ожидающие действия будут сохранены."
            : "You are offline. Pending actions will stay safe."}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
