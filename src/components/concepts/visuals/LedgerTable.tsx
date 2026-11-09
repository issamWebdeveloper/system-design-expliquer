"use client";

import { useState } from "react";
import { VisualButton, VisualFrame } from "./shared";

type Entry = { txn: string; account: string; debit: number; credit: number };

const PAYMENT: Entry[] = [
  { txn: "Payment #1001", account: "Card clearing", debit: 100, credit: 0 },
  { txn: "Payment #1001", account: "Merchant payable", debit: 0, credit: 97 },
  { txn: "Payment #1001", account: "Fee revenue", debit: 0, credit: 3 },
];
const REFUND: Entry[] = [
  { txn: "Refund #1001-R", account: "Merchant payable", debit: 97, credit: 0 },
  { txn: "Refund #1001-R", account: "Fee revenue", debit: 3, credit: 0 },
  { txn: "Refund #1001-R", account: "Card clearing", debit: 0, credit: 100 },
];

const money = (n: number) => (n ? `$${n.toFixed(2)}` : "");

export default function LedgerTable() {
  const [refunded, setRefunded] = useState(false);
  const entries = refunded ? [...PAYMENT, ...REFUND] : PAYMENT;
  const totalDebit = entries.reduce((s, e) => s + e.debit, 0);
  const totalCredit = entries.reduce((s, e) => s + e.credit, 0);
  const balances = [...new Set(entries.map((e) => e.account))].map((account) => ({
    account,
    balance: entries.filter((e) => e.account === account).reduce((s, e) => s + e.debit - e.credit, 0),
  }));

  return (
    <VisualFrame
      title="Try it: post a refund"
      hint="Nothing is ever edited. A refund is new entries that reverse the payment — and debits always equal credits."
    >
      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full min-w-[460px] text-left text-sm">
          <thead className="bg-surface-2 text-xs text-muted">
            <tr>
              <th className="px-3 py-2 font-medium">Transaction</th>
              <th className="px-3 py-2 font-medium">Account</th>
              <th className="px-3 py-2 text-right font-medium">Debit</th>
              <th className="px-3 py-2 text-right font-medium">Credit</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {entries.map((e, i) => (
              <tr key={i} className={i >= PAYMENT.length ? "bg-amber-500/5" : ""}>
                <td className="px-3 py-2 text-muted">{e.txn}</td>
                <td className="px-3 py-2 text-fg">{e.account}</td>
                <td className="px-3 py-2 text-right font-mono text-fg-soft">{money(e.debit)}</td>
                <td className="px-3 py-2 text-right font-mono text-fg-soft">{money(e.credit)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 border-line-strong">
            <tr>
              <td className="px-3 py-2 font-semibold text-fg" colSpan={2}>
                Totals {totalDebit === totalCredit && <span className="ml-1 text-emerald-300">✓ balanced</span>}
              </td>
              <td className="px-3 py-2 text-right font-mono font-semibold text-fg">{money(totalDebit)}</td>
              <td className="px-3 py-2 text-right font-mono font-semibold text-fg">{money(totalCredit)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-4">
        <VisualButton primary={!refunded} onClick={() => setRefunded(!refunded)}>
          {refunded ? "Undo refund" : "Post a refund"}
        </VisualButton>
        <p className="text-sm text-muted">
          Balances (derived from entries):{" "}
          {balances.map((b) => (
            <span key={b.account} className="mr-3 whitespace-nowrap">
              {b.account} <span className="font-mono text-fg">{b.balance >= 0 ? `$${b.balance}` : `−$${-b.balance}`}</span>
            </span>
          ))}
        </p>
      </div>
    </VisualFrame>
  );
}
