"use client";

import { useState } from "react";
import { VisualButton, VisualFrame, useCopy } from "./shared";

type Account = "clearing" | "payable" | "fees";
type Entry = { txn: "payment" | "refund"; account: Account; debit: number; credit: number };

const PAYMENT: Entry[] = [
  { txn: "payment", account: "clearing", debit: 100, credit: 0 },
  { txn: "payment", account: "payable", debit: 0, credit: 97 },
  { txn: "payment", account: "fees", debit: 0, credit: 3 },
];
const REFUND: Entry[] = [
  { txn: "refund", account: "payable", debit: 97, credit: 0 },
  { txn: "refund", account: "fees", debit: 3, credit: 0 },
  { txn: "refund", account: "clearing", debit: 0, credit: 100 },
];

const copy = {
  en: {
    title: "Try it: post a refund",
    hint: "Nothing is ever edited. A refund is new entries that reverse the payment — and debits always equal credits.",
    txn: { payment: "Payment #1001", refund: "Refund #1001-R" },
    accounts: { clearing: "Card clearing", payable: "Merchant payable", fees: "Fee revenue" } as Record<Account, string>,
    transaction: "Transaction",
    account: "Account",
    debit: "Debit",
    credit: "Credit",
    totals: "Totals",
    balanced: "✓ balanced",
    undo: "Undo refund",
    post: "Post a refund",
    balances: "Balances (derived from entries):",
  },
  fr: {
    title: "Essayez : enregistrez un remboursement",
    hint: "Rien n'est jamais modifié. Un remboursement, ce sont de nouvelles écritures qui annulent le paiement — et les débits égalent toujours les crédits.",
    txn: { payment: "Paiement n° 1001", refund: "Remboursement n° 1001-R" },
    accounts: {
      clearing: "Compensation carte",
      payable: "Dû au marchand",
      fees: "Revenus de commission",
    } as Record<Account, string>,
    transaction: "Transaction",
    account: "Compte",
    debit: "Débit",
    credit: "Crédit",
    totals: "Totaux",
    balanced: "✓ équilibré",
    undo: "Annuler le remboursement",
    post: "Enregistrer un remboursement",
    balances: "Soldes (calculés à partir des écritures) :",
  },
};

const money = (n: number) => (n ? `$${n.toFixed(2)}` : "");

export default function LedgerTable() {
  const t = useCopy(copy);
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
      title={t.title}
      hint={t.hint}
    >
      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full min-w-[460px] text-left text-sm">
          <thead className="bg-surface-2 text-xs text-muted">
            <tr>
              <th className="px-3 py-2 font-medium">{t.transaction}</th>
              <th className="px-3 py-2 font-medium">{t.account}</th>
              <th className="px-3 py-2 text-right font-medium">{t.debit}</th>
              <th className="px-3 py-2 text-right font-medium">{t.credit}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {entries.map((e, i) => (
              <tr key={i} className={i >= PAYMENT.length ? "bg-amber-500/5" : ""}>
                <td className="px-3 py-2 text-muted">{t.txn[e.txn]}</td>
                <td className="px-3 py-2 text-fg">{t.accounts[e.account]}</td>
                <td className="px-3 py-2 text-right font-mono text-fg-soft">{money(e.debit)}</td>
                <td className="px-3 py-2 text-right font-mono text-fg-soft">{money(e.credit)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 border-line-strong">
            <tr>
              <td className="px-3 py-2 font-semibold text-fg" colSpan={2}>
                {t.totals} {totalDebit === totalCredit && <span className="ml-1 text-emerald-300">{t.balanced}</span>}
              </td>
              <td className="px-3 py-2 text-right font-mono font-semibold text-fg">{money(totalDebit)}</td>
              <td className="px-3 py-2 text-right font-mono font-semibold text-fg">{money(totalCredit)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-4">
        <VisualButton primary={!refunded} onClick={() => setRefunded(!refunded)}>
          {refunded ? t.undo : t.post}
        </VisualButton>
        <p className="text-sm text-muted">
          {t.balances}{" "}
          {balances.map((b) => (
            <span key={b.account} className="mr-3 whitespace-nowrap">
              {t.accounts[b.account]} <span className="font-mono text-fg">{b.balance >= 0 ? `$${b.balance}` : `−$${-b.balance}`}</span>
            </span>
          ))}
        </p>
      </div>
    </VisualFrame>
  );
}
