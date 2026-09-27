"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { askAssistant, type AssistantReply } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { IconSend, IconSparkles } from "@tabler/icons-react";

type Message = { role: "user" | "assistant"; text: string };

const GREETING: Message = {
  role: "assistant",
  text: "Ask me anything about this order — its status, payment, or delivery.",
};

export function OrderAssistant({ orderId }: { orderId: string }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([GREETING]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
    }
  }, [messages, open]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;

    setInput("");
    const next = [...messages, { role: "user" as const, text }];
    setMessages(next);
    setBusy(true);
    try {
      const reply: AssistantReply = await askAssistant(orderId, text);
      setMessages([...next, { role: "assistant", text: reply.answer }]);
    } catch (err) {
      setMessages([
        ...next,
        {
          role: "assistant",
          text: "Sorry — I could not reach the assistant right now. Try again in a moment.",
        },
      ]);
      if (err instanceof Error && err.message) {
        toast.error(err.message);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-border/60 bg-card p-6 shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 text-left"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <IconSparkles className="size-4 text-primary" />
          Ask about this order
        </span>
        <span className="text-xs font-medium text-primary">
          {open ? "Hide" : "Open"}
        </span>
      </button>

      <div
        className={
          open
            ? "mt-4 block transition-[opacity] duration-200"
            : "hidden transition-[opacity] duration-200"
        }
      >
        <div
          ref={scrollRef}
          className="max-h-64 space-y-3 overflow-y-auto rounded-lg border border-dashed border-border/60 bg-muted/20 p-3"
        >
          {messages.map((message, i) => (
            <div
              key={`${i}-${message.role}`}
              className={
                message.role === "user"
                  ? "ml-auto max-w-[85%] rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground"
                  : "max-w-[85%] rounded-lg border border-border/60 bg-card px-3 py-2 text-sm"
              }
            >
              {message.text}
            </div>
          ))}
          {busy && (
            <div className="max-w-[85%] rounded-lg border border-border/60 bg-card px-3 py-2 text-sm text-muted-foreground">
              Thinking...
            </div>
          )}
        </div>

        <form onSubmit={send} className="mt-3 flex items-center gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="e.g. When will my order arrive?"
            maxLength={1000}
            aria-label="Message the order assistant"
            className="flex h-9 w-full min-w-0 rounded-3xl border border-transparent bg-input/50 px-3 py-1 text-base outline-none transition-[color,box-shadow,background-color] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 md:text-sm"
          />
          <Button type="submit" size="sm" disabled={busy || !input.trim()}>
            <IconSend className="size-4" />
            Send
          </Button>
        </form>
      </div>
    </section>
  );
}
