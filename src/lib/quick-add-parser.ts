import { parseAmount } from "@/lib/money";
import { extractDate, occurredAtFor, type QuickAddToken } from "@/lib/quick-add-dates";
import {
  ACCOUNT_SYNONYMS, BENEFICIARY_PREFIXES, CONNECTORS, EXPENSE_CATEGORY_KEYWORDS, GENERIC_ACCOUNT_WORDS,
  INCOME_CATEGORY_KEYWORDS, INCOME_KEYWORDS, OWNER_WORDS, SHARED_WORDS, TRANSFER_KEYWORDS,
} from "@/lib/quick-add-keywords";

export type QuickAddKind = "income" | "expense" | "transfer";
export type Beneficiary = "owner" | "partner_of_owner" | "shared";
export type QuickAddField = "amount" | "account" | "category" | "kind";

export interface QuickAddAccount {
  id: string;
  name: string;
  aliases?: string[];
}

export interface QuickAddCategory {
  id: string;
  name: string;
  kind: "income" | "expense";
  keywords?: string[];
}

export interface QuickAddContext {
  /** Urutan menentukan prioritas kalau satu kata cocok ke beberapa akun. */
  accounts: QuickAddAccount[];
  categories: QuickAddCategory[];
  now: Date;
  defaultAccountId?: string;
  /** Nama partner; "untuk <nama>" menjadi beneficiary partner_of_owner. */
  partnerName?: string;
}

export interface QuickAddDraft {
  raw: string;
  kind: QuickAddKind | null;
  amount: bigint | null;
  accountId: string | null;
  toAccountId: string | null;
  categoryId: string | null;
  occurredAt: Date;
  note: string | null;
  beneficiary: Beneficiary;
  missing: QuickAddField[];
}

const SUFFIX_WORDS = new Set(["rb", "ribu", "k", "jt", "juta", "m", "miliar", "milyar"]);

function normWord(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9']/g, "");
}

function tokenize(line: string): QuickAddToken[] {
  return line
    .split(/\s+/)
    .filter(Boolean)
    .map((raw) => ({ raw, norm: raw.toLowerCase().replace(/[,;:!?]+$/, "").replace(/(?<=\D)\.$/, ""), used: false }));
}

function phraseAt(tokens: QuickAddToken[], i: number, len: number, allowUsed = false): string | null {
  const slice = tokens.slice(i, i + len);
  if (slice.length < len || (!allowUsed && slice.some((t) => t.used))) return null;
  return slice.map((t) => normWord(t.norm)).join(" ");
}

function extractBeneficiary(tokens: QuickAddToken[], partnerName: string | undefined): Beneficiary {
  const partner = partnerName ? normWord(partnerName.split(/\s+/)[0] ?? "") : "";
  for (let i = 0; i < tokens.length - 1; i++) {
    if (!BENEFICIARY_PREFIXES.has(tokens[i]!.norm) || tokens[i]!.used) continue;
    const who = normWord(tokens[i + 1]!.norm);
    const result: Beneficiary | null = SHARED_WORDS.has(who)
      ? "shared"
      : OWNER_WORDS.has(who)
        ? "owner"
        : partner && who === partner
          ? "partner_of_owner"
          : null;
    if (result) {
      tokens[i]!.used = tokens[i + 1]!.used = true;
      return result;
    }
  }
  return "owner";
}

function extractAmount(tokens: QuickAddToken[]): bigint | null {
  let best: { value: bigint; score: number; idx: number; len: number } | null = null;
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]!;
    if (t.used) continue;
    const next = tokens[i + 1];
    const candidates: Array<{ text: string; len: number; score: number }> = [];
    if (/\d/.test(t.norm)) {
      candidates.push({ text: t.norm, len: 1, score: /[a-z]/.test(t.norm) ? 3 : t.norm.replace(/\D/g, "").length >= 3 ? 2 : 1 });
      if (next && !next.used && SUFFIX_WORDS.has(next.norm)) candidates.push({ text: `${t.norm}${next.norm}`, len: 2, score: 3 });
    } else if ((t.norm === "rp" || t.norm === "rp.") && next && !next.used) {
      candidates.push({ text: `rp ${next.norm}`, len: 2, score: 3 });
    }
    for (const c of candidates.sort((a, b) => b.len - a.len)) {
      const value = parseAmount(c.text);
      if (value === null || value === 0n) continue;
      if (!best || c.score > best.score) best = { value: value < 0n ? -value : value, score: c.score, idx: i, len: c.len };
      break;
    }
  }
  if (!best) return null;
  for (let i = best.idx; i < best.idx + best.len; i++) tokens[i]!.used = true;
  return best.value;
}

interface AccountMention {
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

function extractAccounts(tokens: QuickAddToken[], accounts: QuickAddAccount[]): AccountMention[] {
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

function prevNorm(tokens: QuickAddToken[], idx: number): string | undefined {
  return tokens[idx - 1]?.norm;
}

function findCategory(
  tokens: QuickAddToken[],
  kind: "income" | "expense",
  categories: QuickAddCategory[],
): string | null {
  const pool = categories.filter((c) => c.kind === kind);
  const byName = new Map(pool.map((c) => [c.name.toLowerCase(), c.id]));
  const custom = new Map<string, string>();
  for (const c of pool) {
    for (const k of c.keywords ?? []) custom.set(k.toLowerCase().split(/\s+/).map(normWord).join(" "), c.id);
    custom.set(c.name.toLowerCase().split(/\s+/).map(normWord).join(" "), c.id);
  }
  const builtin = kind === "income" ? INCOME_CATEGORY_KEYWORDS : EXPENSE_CATEGORY_KEYWORDS;
  for (let i = 0; i < tokens.length; i++) {
    for (let len = 4; len >= 1; len--) {
      const phrase = phraseAt(tokens, i, len);
      if (!phrase) continue;
      const customId = custom.get(phrase);
      if (customId) return customId;
      const seedName = builtin[phrase];
      const seedId = seedName ? byName.get(seedName.toLowerCase()) : undefined;
      if (seedId) return seedId;
    }
  }
  return null;
}

function buildNote(tokens: QuickAddToken[]): string | null {
  const words = tokens.filter((t) => !t.used).map((t) => t.raw);
  const text = words.join(" ").trim();
  if (!text) return null;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// kata sambung yang menempel pada akun, tanggal, atau nominal ikut dibuang dari catatan
function dropDanglingConnectors(tokens: QuickAddToken[], isTransfer: boolean): void {
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]!;
    if (t.used) continue;
    const nextUsed = tokens[i + 1]?.used === true;
    if (CONNECTORS.has(t.norm) && nextUsed) t.used = true;
    if (isTransfer && TRANSFER_KEYWORDS.has(t.norm)) t.used = true;
  }
}

function parseLine(raw: string, ctx: QuickAddContext): QuickAddDraft {
  const tokens = tokenize(raw);
  const dateMatch = extractDate(tokens, ctx.now);
  const beneficiary = extractBeneficiary(tokens, ctx.partnerName);
  const amount = extractAmount(tokens);
  const mentions = extractAccounts(tokens, ctx.accounts);

  const unusedNorms = tokens.filter((t) => !t.used).map((t) => normWord(t.norm));
  const hasTransferWord = tokens.some((t) => TRANSFER_KEYWORDS.has(t.norm));
  const hasKeMention = mentions.some((m) => prevNorm(tokens, m.idx) === "ke");
  const isTransfer = hasTransferWord || (mentions.length >= 2 && hasKeMention);

  let kind: QuickAddKind | null;
  let accountId: string | null = null;
  let toAccountId: string | null = null;
  let categoryId: string | null = null;

  if (isTransfer) {
    kind = "transfer";
    const toMention = mentions.find((m) => prevNorm(tokens, m.idx) === "ke");
    const fromMention = mentions.find((m) => prevNorm(tokens, m.idx) === "dari");
    const rest = mentions.filter((m) => m !== toMention && m !== fromMention);
    const topup = tokens.some((t) => t.norm === "topup" || t.norm === "top-up");
    let from = fromMention ?? null;
    let to = toMention ?? null;
    for (const m of rest) {
      if (topup && !to) to = m;
      else if (!from) from = m;
      else if (!to) to = m;
    }
    accountId = from?.accountId ?? ctx.defaultAccountId ?? null;
    toAccountId = to?.accountId ?? null;
    if (accountId !== null && accountId === toAccountId) toAccountId = null;
  } else {
    const incomeHit = unusedNorms.some((w) => INCOME_KEYWORDS.has(w));
    const incomeCategory = findCategory(tokens, "income", ctx.categories);
    const expenseCategory = findCategory(tokens, "expense", ctx.categories);
    if (incomeHit || (incomeCategory && !expenseCategory)) {
      kind = "income";
      categoryId = incomeCategory;
    } else if (amount !== null || expenseCategory !== null) {
      kind = "expense";
      categoryId = expenseCategory;
    } else {
      kind = null;
    }
    accountId = mentions[0]?.accountId ?? ctx.defaultAccountId ?? null;
  }

  dropDanglingConnectors(tokens, isTransfer);

  const missing: QuickAddField[] = [];
  if (amount === null) missing.push("amount");
  if (accountId === null || (kind === "transfer" && toAccountId === null)) missing.push("account");
  if (kind !== "transfer" && categoryId === null) missing.push("category");
  if (kind === null) missing.push("kind");

  return {
    raw,
    kind,
    amount,
    accountId,
    toAccountId,
    categoryId,
    occurredAt: occurredAtFor(dateMatch, ctx.now),
    note: buildNote(tokens),
    beneficiary,
    missing,
  };
}

function emptyDraft(raw: string, now: Date): QuickAddDraft {
  const occurredAt = Number.isFinite(now.getTime()) ? new Date(now.getTime()) : new Date();
  return {
    raw, kind: null, amount: null, accountId: null, toAccountId: null, categoryId: null,
    occurredAt, note: raw.trim() || null, beneficiary: "owner",
    missing: ["amount", "account", "category", "kind"],
  };
}

/** Parser aturan lokal F-IN-2: satu draf per baris tidak kosong. Tidak pernah melempar. */
export function parseQuickAdd(input: string, ctx: QuickAddContext): QuickAddDraft[] {
  if (typeof input !== "string") return [];
  return input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      try {
        return parseLine(line.slice(0, 500), ctx);
      } catch {
        return emptyDraft(line, ctx.now);
      }
    });
}
