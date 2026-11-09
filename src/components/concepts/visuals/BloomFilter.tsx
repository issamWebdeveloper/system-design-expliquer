"use client";

import { useState } from "react";
import { VisualButton, VisualFrame, fnv1a } from "./shared";

const BITS = 32;
const SEEDS = [0x811c9dc5, 0x01000193, 0x9e3779b9];
const positions = (item: string) => [...new Set(SEEDS.map((seed) => fnv1a(item, seed) % BITS))];

const START = ["example.com/a", "example.com/b", "news.site/today"];

export default function BloomFilter() {
  const [items, setItems] = useState(START);
  const [input, setInput] = useState("example.com/c");
  const [checked, setChecked] = useState<string | null>(null);

  const bits = new Set(items.flatMap(positions));
  const probe = positions(input.trim());
  const maybe = probe.every((p) => bits.has(p));

  return (
    <VisualFrame
      title="Try it: add and check URLs"
      hint="Each URL sets 3 bits. A lookup is 'definitely new' if any of its bits is 0, otherwise 'probably seen'."
    >
      <div className="grid grid-cols-8 gap-1 sm:grid-cols-16" role="img" aria-label="Bit array">
        {Array.from({ length: BITS }, (_, i) => {
          const set = bits.has(i);
          const probed = probe.includes(i);
          return (
            <div
              key={i}
              className={`flex h-8 items-center justify-center rounded font-mono text-xs transition-colors ${
                set ? "bg-accent text-[#fff]" : "bg-surface-2 text-faint"
              } ${probed ? "ring-2 ring-amber-400" : ""}`}
              title={`bit ${i}`}
            >
              {set ? 1 : 0}
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <input
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setChecked(null);
          }}
          aria-label="URL"
          className="h-9 min-w-0 flex-1 rounded-lg border border-line bg-bg px-3 font-mono text-sm text-fg focus:border-accent focus:outline-none"
        />
        <VisualButton onClick={() => setChecked(input.trim())} disabled={!input.trim()}>
          Check
        </VisualButton>
        <VisualButton
          primary
          disabled={!input.trim() || items.includes(input.trim())}
          onClick={() => {
            setItems([...items, input.trim()]);
            setChecked(null);
          }}
        >
          Add
        </VisualButton>
      </div>

      <p className="mt-3 text-sm" aria-live="polite">
        Bits for this URL (amber): {probe.join(", ")}.{" "}
        {checked !== null &&
          (maybe ? (
            <span className="font-semibold text-amber-300">
              Probably seen{items.includes(checked) ? "" : " — a false positive: it was never added!"}
            </span>
          ) : (
            <span className="font-semibold text-emerald-300">Definitely not seen — skip the database.</span>
          ))}
      </p>
      <p className="mt-2 text-xs text-muted">Added so far: {items.join(" · ")}</p>
    </VisualFrame>
  );
}
