"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";
import { useLocale } from "next-intl";
import { Button } from "@laminaria/ui";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const locale = useLocale();
  return (
    <main className="centered-state">
      <div className="centered-state__icon"><AlertTriangle size={28} aria-hidden="true" /></div>
      <h1>{locale === "ru" ? "Поток прервался" : "The flow was interrupted"}</h1>
      <p>{locale === "ru" ? "Сохранённые данные не потеряны. Попробуйте открыть раздел снова." : "Your saved work is safe. Try opening this section again."}</p>
      <Button onClick={reset}><RotateCcw size={17} aria-hidden="true" />{locale === "ru" ? "Попробовать снова" : "Try again"}</Button>
    </main>
  );
}
