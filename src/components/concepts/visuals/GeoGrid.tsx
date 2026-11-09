"use client";

import { useState } from "react";
import { VisualFrame, useCopy } from "./shared";

const copy = {
  en: {
    title: "Try it: move the rider",
    hint: "The city is split into cells. Click a cell to move the rider; matching only looks in that cell and its neighbours.",
    grid: "City grid",
    cell: (c: number, r: number, drivers: number, rider: boolean) =>
      `Cell ${c},${r}${drivers ? `, ${drivers} driver` : ""}${rider ? ", rider here" : ""}`,
    searched: "Searched",
    ofCells: (n: number) => `of ${n} cells and checked`,
    ofDrivers: (n: number) => `of ${n} drivers. Those few candidates are then ranked by real road ETA.`,
  },
  fr: {
    title: "Essayez : déplacez le passager",
    hint: "La ville est découpée en cellules. Cliquez sur une cellule pour déplacer le passager ; la recherche ne regarde que cette cellule et ses voisines.",
    grid: "Grille de la ville",
    cell: (c: number, r: number, drivers: number, rider: boolean) =>
      `Cellule ${c},${r}${drivers ? `, ${drivers} chauffeur${drivers > 1 ? "s" : ""}` : ""}${rider ? ", passager ici" : ""}`,
    searched: "Parcouru",
    ofCells: (n: number) => `cellules sur ${n} et vérifié`,
    ofDrivers: (n: number) =>
      `chauffeurs sur ${n}. Ces quelques candidats sont ensuite classés selon le temps de trajet réel.`,
  },
};

const COLS = 8;
const ROWS = 6;
// Driver positions as [col, row] — fixed so the page renders identically everywhere.
const DRIVERS: [number, number][] = [
  [0, 0], [1, 3], [2, 1], [2, 2], [3, 4], [4, 1], [4, 2], [4, 3], [5, 0], [5, 5],
  [6, 2], [6, 4], [7, 1], [1, 5], [3, 0], [7, 5], [0, 3], [5, 3],
];

export default function GeoGrid() {
  const t = useCopy(copy);
  const [rider, setRider] = useState<[number, number]>([3, 2]);
  const near = (c: number, r: number) => Math.abs(c - rider[0]) <= 1 && Math.abs(r - rider[1]) <= 1;
  const candidates = DRIVERS.filter(([c, r]) => near(c, r)).length;
  const cellsSearched = Array.from({ length: COLS * ROWS }).filter((_, i) => near(i % COLS, Math.floor(i / COLS))).length;

  return (
    <VisualFrame
      title={t.title}
      hint={t.hint}
    >
      <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))` }} role="grid" aria-label={t.grid}>
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
              aria-label={t.cell(c, r, drivers, isRider)}
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
        {t.searched} <span className="font-semibold text-fg">{cellsSearched}</span> {t.ofCells(COLS * ROWS)}{" "}
        <span className="font-semibold text-fg">{candidates}</span> {t.ofDrivers(DRIVERS.length)}
      </p>
    </VisualFrame>
  );
}
