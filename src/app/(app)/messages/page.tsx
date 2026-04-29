"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useMessageThreads, useSendMessage } from "@/hooks/use-competitions";
import { useI18n } from "@/lib/i18n";
import { formatTimeStable } from "@/lib/utils/date";

function MessagesPageContent() {
  const { t } = useI18n();
  const threadsQuery = useMessageThreads();
  const sendMessage = useSendMessage();
  const searchParams = useSearchParams();
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const threads = threadsQuery.data ?? [];
  const queryThreadId = searchParams.get("threadId");
  const preferredThreadId = activeThreadId ?? queryThreadId;
  const active = threads.length ? threads.find((thread) => thread.id === preferredThreadId) ?? threads[0] : null;

  const onSend = async () => {
    if (!active || !draft.trim() || sendMessage.isPending) return;
    await sendMessage.mutateAsync({ threadId: active.id, body: draft.trim() });
    setDraft("");
  };

  return (
    <div className="space-y-4">
      <PageHeader title={t("messages.title")} description={t("messages.description")} actions={<Button variant="primary">{t("messages.new")}</Button>} />
      <div className="grid gap-4 xl:grid-cols-[320px_1fr_300px]">
        <Card className="p-3">
          <Input placeholder={t("messages.search")} />
          <div className="mt-3 space-y-2">
            {threads.map((thread) => (
              <button
                key={thread.id}
                type="button"
                onClick={() => setActiveThreadId(thread.id)}
                className="w-full rounded-xl border p-3 text-left"
                style={{
                  borderColor: "var(--border)",
                  backgroundColor: thread.id === active?.id ? "color-mix(in srgb,var(--primary) 10%, transparent)" : "var(--surface-2)",
                }}
              >
                <div className="flex items-center justify-between"><p className="font-medium">{thread.name}</p><p className="text-xs" style={{ color: "var(--text-secondary)" }}>{formatTimeStable(thread.updatedAt)}</p></div>
                <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>{thread.preview}</p>
              </button>
            ))}
          </div>
          {threadsQuery.isLoading ? <p className="mt-3 text-sm" style={{ color: "var(--text-secondary)" }}>{t("messages.loading")}</p> : null}
        </Card>

        <Card className="flex flex-col p-3">
          <p className="border-b pb-3 text-lg font-semibold" style={{ borderColor: "var(--border)" }}>{active?.name ?? t("messages.conversation")}</p>
          <div className="flex-1 space-y-3 overflow-y-auto py-3 lp-scrollbar">
            {(active?.messages ?? []).map((msg) => (
              <div key={msg.id} className={`max-w-[78%] rounded-2xl px-3 py-2 text-sm ${msg.mine ? "ml-auto" : ""}`} style={msg.mine ? { backgroundColor: "color-mix(in srgb,var(--primary) 18%, transparent)" } : { backgroundColor: "var(--surface-2)", border: "1px solid var(--border)" }}>
                <p>{msg.content}</p>
                <p className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>{formatTimeStable(msg.timestamp)}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <Input
              placeholder={t("messages.type")}
              value={draft}
              onChange={(event) => setDraft(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void onSend();
                }
              }}
            />
            <Button variant="primary" onClick={() => void onSend()} disabled={!active || sendMessage.isPending || !draft.trim()}>
              {sendMessage.isPending ? t("messages.sending") : t("messages.send")}
            </Button>
          </div>
        </Card>

        <Card className="space-y-4 p-4 text-sm">
          <div>
            <p className="font-semibold">{t("messages.participants")}</p>
            <p style={{ color: "var(--text-secondary)" }}>{active?.name ?? "-"}</p>
          </div>
          <div>
            <p className="font-semibold">{t("messages.files")}</p>
            <ul className="mt-2 space-y-1" style={{ color: "var(--text-secondary)" }}><li>Team Roster 2024.pdf</li><li>Travel Itinerary.pdf</li></ul>
          </div>
          <div>
            <p className="font-semibold">{t("messages.media")}</p>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-14 rounded-lg" style={{ backgroundColor: "var(--surface-2)" }} />)}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

export default function MessagesPage() {
  return (
    <Suspense fallback={null}>
      <MessagesPageContent />
    </Suspense>
  );
}
