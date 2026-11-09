"use client";

import { useEffect, useState } from "react";
import { VisualButton, VisualFrame } from "./shared";

const CAPACITY = 5;
const REFILL_MS = 1000;

type LogEntry = { id: number; ok: boolean };

export default function TokenBucket() {
  const [tokens, setTokens] = useState(CAPACITY);
  const [log, setLog] = useState<LogEntry[]>([]);

  useEffect(() => {
    const id = window.setInterval(() => setTokens((t) => Math.min(CAPACITY, t + 1)), REFILL_MS);
    return () => window.clearInterval(id);
  }, []);

  const send = (count: number) => {
    let left = tokens;
    const results: LogEntry[] = [];
    for (let i = 0; i < count; i++) {
      const ok = left >= 1;
      if (ok) left -= 1;
      results.push({ id: Date.now() + i, ok });
    }
    setTokens(left);
    setLog((prev) => [...results.reverse(), ...prev].slice(0, 8));
  };

  return (
    <VisualFrame
      title="Try it: send requests"
      hint={`The bucket holds ${CAPACITY} tokens and refills one per second. Each request takes a token; an empty bucket means 429.`}
    >
      <div className="flex flex-col gap-5 md:flex-row md:items-center">
        <div className="flex items-end gap-1.5" role="img" aria-label={`${tokens} of ${CAPACITY} tokens`}>
          {Array.from({ length: CAPACITY }, (_, i) => (
            <div
              key={i}
              className={`h-12 w-9 rounded-md border-2 transition-colors duration-300 ${
                i < tokens ? "border-accent bg-accent" : "border-line bg-transparent"
              }`}
            />
          ))}
          <span className="ml-3 text-2xl font-semibold text-fg">
            {tokens}
            <span className="text-sm font-normal text-muted"> / {CAPACITY}</span>
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <VisualButton primary onClick={() => send(1)}>
            Send 1 request
          </VisualButton>
          <VisualButton onClick={() => send(8)}>Burst of 8</VisualButton>
        </div>
      </div>

      <ul className="mt-4 flex flex-wrap gap-1.5" aria-live="polite">
        {log.map((entry) => (
          <li
            key={entry.id}
            className={`rounded-md px-2 py-1 font-mono text-xs ${
              entry.ok ? "bg-emerald-500/10 text-emerald-300" : "bg-rose-500/10 text-rose-300"
            }`}
          >
            {entry.ok ? "200 OK" : "429 Too Many"}
          </li>
        ))}
        {log.length === 0 && <li className="text-sm text-muted">Responses appear here.</li>}
      </ul>
      <p className="mt-3 text-sm text-muted">
        Bursts up to the bucket size are allowed; after that the client is held to the refill rate.
      </p>
    </VisualFrame>
  );
}
