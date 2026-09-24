import type { QuickAddToken } from "@/lib/quick-add-dates";
import { ACCOUNT_SYNONYMS, GENERIC_ACCOUNT_WORDS } from "@/lib/quick-add-keywords";

export interface QuickAddAccount {
  id: string;
  name: string;
  aliases?: string[];
}

export function normWord(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9']/g, "");
}

export function phraseAt(tokens: QuickAddToken[], i: number, len: number): string | null {
  const slice = tokens.slice(i, i + len);
  if (slice.length < len || slice.some((t) => t.used)) return null;
  return slice.map((t) => normWord(t.norm)).join(" ");
}

export interface AccountMention {
  idx: number;
  len: number;
  accountId: string;
}

function accountPhrases(account: QuickAddAccount): Array<{ phrase: string; priority: number }> {
  const out: Array<{ phrase: string; priority: number }> = [];
  const words = account.name.split(/\s+/).map(normWord).filter(Boolean);
  out.push({ phrase: words.join(" "), priority: 3 });
  for (const alias of account.aliases ?? []) {
    out.push({ phrase: alias.split(/\s+/).map(normWord).filter(Boolean).join(" "), priority: 3 });
  }
  for (const w of words) {
    if (w.length >= 2 && !GENERIC_ACCOUNT_WORDS.has(w)) out.push({ phrase: w, priority: 2 });
  }
  return out.filter((p) => p.phrase !== "");
}

interface AccountIndexEntry {
  id: string;
  phrases: Array<{ phrase: string; priority: number }>;
  words: string[];
}

function findAccountAt(tokens: QuickAddToken[], i: number, index: AccountIndexEntry[]): AccountMention | null {
  for (let len = 3; len >= 1; len--) {
    const phrase = phraseAt(tokens, i, len);
    if (!phrase) continue;
    let best: { id: string; priority: number } | null = null;
    for (const a of index) {
      const p = a.phrases.find((x) => x.phrase === phrase);
      const synonyms = len === 1 ? ACCOUNT_SYNONYMS[phrase] : undefined;
      const priority = p?.priority ?? (synonyms?.some((s) => a.words.includes(normWord(s))) ? 1 : 0);
      if (priority > (best?.priority ?? 0)) best = { id: a.id, priority };
    }
    if (best) return { idx: i, len, accountId: best.id };
  }
  return null;
}

export function extractAccounts(tokens: QuickAddToken[], accounts: QuickAddAccount[]): AccountMention[] {
  const index = accounts.map((a) => ({ id: a.id, phrases: accountPhrases(a), words: a.name.split(/\s+/).map(normWord) }));
  const mentions: AccountMention[] = [];
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i]!.used) continue;
    const m = findAccountAt(tokens, i, index);
    if (!m) continue;
    for (let j = m.idx; j < m.idx + m.len; j++) tokens[j]!.used = true;
    mentions.push(m);
    i += m.len - 1;
  }
  return mentions;
}

