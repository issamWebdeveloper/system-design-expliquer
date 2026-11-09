"use client";

import { useState } from "react";
import { VisualButton, VisualFrame, useCopy } from "./shared";

const EPOCH = BigInt(1288834974657); // Twitter's custom epoch (Nov 2010)
const WORKER = BigInt(7);
const segments = [
  { id: "sign", bits: 1, colour: "var(--faint)", start: 0 },
  { id: "time", bits: 41, colour: "#6366f1", start: 1 },
  { id: "worker", bits: 10, colour: "#f59e0b", start: 42 },
  { id: "sequence", bits: 12, colour: "#10b981", start: 52 },
] as const;

const copy = {
  en: {
    title: "Try it: generate IDs",
    hint: "64 bits: time first (so IDs sort by creation), then which machine made it, then a per-millisecond counter.",
    layout: "64-bit ID layout",
    segments: { sign: "Sign", time: "Timestamp (ms since epoch)", worker: "Worker id", sequence: "Sequence" },
    generate: "Generate ID",
    created: "Created",
    worker: "Worker",
    sequence: "Sequence",
    note: "Click quickly: within the same millisecond only the sequence changes, so one worker can mint 4,096 IDs per millisecond without asking anyone.",
  },
  fr: {
    title: "Essayez : générez des identifiants",
    hint: "64 bits : d'abord le temps (les ID se trient donc par date de création), puis la machine qui l'a créé, puis un compteur par milliseconde.",
    layout: "Structure d'un ID de 64 bits",
    segments: { sign: "Signe", time: "Horodatage (ms depuis l'époque)", worker: "ID du worker", sequence: "Séquence" },
    generate: "Générer un ID",
    created: "Créé le",
    worker: "Worker",
    sequence: "Séquence",
    note: "Cliquez vite : dans la même milliseconde, seule la séquence change — un worker peut donc produire 4 096 ID par milliseconde sans consulter personne.",
  },
};

// Fixed starting example so server and client render the same thing.
const START = { ms: BigInt(1793500000000), seq: BigInt(0) };

const build = (ms: bigint, seq: bigint) => ((ms - EPOCH) << BigInt(22)) | (WORKER << BigInt(12)) | seq;

export default function SnowflakeId() {
  const t = useCopy(copy);
  const [state, setState] = useState(START);
  const id = build(state.ms, state.seq);
  const binary = id.toString(2).padStart(64, "0");

  const generate = () => {
    const now = BigInt(Date.now());
    setState((prev) => ({ ms: now, seq: now === prev.ms ? (prev.seq + BigInt(1)) & BigInt(4095) : BigInt(0) }));
  };

  return (
    <VisualFrame
      title={t.title}
      hint={t.hint}
    >
      <div className="flex overflow-hidden rounded-lg border border-line" role="img" aria-label={t.layout}>
        {segments.map((seg) => {
          const bits = binary.slice(seg.start, seg.start + seg.bits);
          return (
            <div key={seg.id} style={{ flexGrow: seg.bits, borderTopColor: seg.colour }} className="min-w-0 border-t-4 bg-surface-2 px-1.5 py-1.5">
              <p className="truncate text-[10px] font-medium text-muted">
                {t.segments[seg.id]} · {seg.bits}
              </p>
              <p className="truncate font-mono text-[10px] text-fg-soft">{bits}</p>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <VisualButton primary onClick={generate}>
          {t.generate}
        </VisualButton>
        <code className="rounded-lg bg-surface-2 px-3 py-1.5 font-mono text-sm text-fg">{id.toString()}</code>
      </div>

      <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-muted">{t.created}</dt>
          <dd className="font-mono text-fg">{new Date(Number(state.ms)).toISOString().replace("T", " ").slice(0, 23)}</dd>
        </div>
        <div>
          <dt className="text-muted">{t.worker}</dt>
          <dd className="font-mono text-fg">{WORKER.toString()}</dd>
        </div>
        <div>
          <dt className="text-muted">{t.sequence}</dt>
          <dd className="font-mono text-fg">{state.seq.toString()}</dd>
        </div>
      </dl>
      <p className="mt-3 text-sm text-muted">
        {t.note}
      </p>
    </VisualFrame>
  );
}
