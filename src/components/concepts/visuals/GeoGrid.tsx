"use client";

import { useState } from "react";
import { VisualFrame } from "./shared";

const COLS = 8;
const ROWS = 6;
// Driver positions as [col, row] — fixed so the page renders identically everywhere.
const DRIVERS: [number, number][] = [
  [0, 0], [1, 3], [2, 1], [2, 2], [3, 4], [4, 1], [4, 2], [4, 3], [5, 0], [5, 5],
  [6, 2], [6, 4], [7, 1], [1, 5], [3, 0], [7, 5], [0, 3], [5, 3],
];

export default function GeoGrid() {
  const [rider, setRider] = useState<[number, number]>([3, 2]);
  const near = (c: number, r: number) => Math.abs(c - rider[0]) <= 1 && Math.abs(r - rider[1]) <= 1;
  const candidates = DRIVERS.filter(([c, r]) => near(c, r)).length;
  const cellsSearched = Array.from({ length: COLS * ROWS }).filter((_, i) => near(i % COLS, Math.floor(i / COLS))).length;

  return (
    <VisualFrame
      title="Try it: move the rider"
      hint="The city is split into cells. Click a cell to move the rider; matching only looks in that cell and its neighbours."
    >
      <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))` }} role="grid" aria-label="City grid">
        {Array.from({ length: COLS * ROWS }, (_, i) => {
          const c = i % COLS;
          const r = Math.floor(i / COLS);
          const isRider = rider[0] === c && rider[1] === r;
          const drivers = DRIVERS.filter(([dc, dr]) => dc === c && dr === r).length;
          return (
            <button
              key={i}
              type="button"
              onClick={() => setRider([c, r])}
              aria-label={`Cell ${c},${r}${drivers ? `, ${drivers} driver` : ""}${isRider ? ", rider here" : ""}`}
              className={`flex aspect-square items-center justify-center rounded-md text-base transition-colors ${
                near(c, r) ? "bg-accent-soft ring-1 ring-accent/40" : "bg-surface-2 hover:bg-line"
              }`}
            >
              {isRider ? "🧍" : drivers ? "🚗" : ""}
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-sm text-fg-soft" aria-live="polite">
        Searched <span className="font-semibold text-fg">{cellsSearched}</span> of {COLS * ROWS} cells and checked{" "}
        <span className="font-semibold text-fg">{candidates}</span> of {DRIVERS.length} drivers. Those few candidates are then
        ranked by real road ETA.
      </p>
    </VisualFrame>
  );
}
