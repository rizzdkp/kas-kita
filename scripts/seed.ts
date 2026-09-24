import { sql } from "drizzle-orm";
import { db, sql as client } from "@/server/db/client";
import {
  accounts,
  billPayments,
  bills,
  budgets,
  categories,
  goalContributions,
  goals,
  institutions,
  investmentValuations,
  recurringRules,
  tags,
  transactionTags,
  transactions,
  users,
} from "@/server/db/schema";
import { addDaysKey, addMonthsKey, keyOf, monthStartKey } from "@/server/metrics/_time";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, SYSTEM_CATEGORIES } from "./seed/categories";
import { generateTransactions, type SeedAccount, type SeedContext } from "./seed/generate";
import { SeededRandom } from "./seed/random";

// data contoh, bukan data asli (AGENTS.md "Data contoh"); nama bank hanya label
const SEED = 20260924;
const MONTHS = 6;

async function truncateAll() {
  const rows = (await db.execute(sql`select tablename from pg_tables where schemaname = 'public'`)) as unknown as Array<{ tablename: string }>;
  const list = rows.map((r) => `"public"."${r.tablename}"`).join(", ");
  if (list) await db.execute(sql.raw(`truncate table ${list} restart identity cascade`));
}

async function main() {
  const now = new Date();
  const today = keyOf(now);
  const month = monthStartKey(today);
  const from = addMonthsKey(month, -(MONTHS - 1), 1);
  const openingDate = addDaysKey(from, -1);
  const rng = new SeededRandom(SEED);

  await truncateAll();

  const [rizz, nadia] = await db
    .insert(users)
    .values([
      { email: "rizz@kaskita.local", name: "Rizz", displayName: "Rizz", identityColor: "violet", paydayDay: 25, onboardedAt: now },
      { email: "nadia@kaskita.local", name: "Nadia", displayName: "Nadia", identityColor: "ocean", paydayDay: 1, onboardedAt: now },
    ])
    .returning();
  const rizzId = rizz!.id;
  const nadiaId = nadia!.id;

  const inst = Object.fromEntries(
    (
      await db
        .insert(institutions)
        .values([
          { name: "BCA", slug: "bca", kind: "bank" as const },
          { name: "Bank Jago", slug: "jago", kind: "bank" as const },
          { name: "GoPay", slug: "gopay", kind: "ewallet" as const },
          { name: "OVO", slug: "ovo", kind: "ewallet" as const },
          { name: "Mandiri", slug: "mandiri", kind: "bank" as const },
        ])
        .returning()
    ).map((i) => [i.slug, i.id]),
  ) as Record<string, string>;

  const accountSpecs = {
    bcaRizz: { name: "BCA Rizz", type: "bank", ownerId: rizzId, institutionId: inst.bca, openingBalance: 12_000_000n, sortOrder: 1 },
    gopayRizz: { name: "GoPay Rizz", type: "ewallet", ownerId: rizzId, institutionId: inst.gopay, openingBalance: 300_000n, sortOrder: 2 },
    cashRizz: { name: "Tunai Rizz", type: "cash", ownerId: rizzId, institutionId: null, openingBalance: 400_000n, sortOrder: 3 },
    cardRizz: {
      name: "Kartu Kredit BCA", type: "credit_card", ownerId: rizzId, institutionId: inst.bca, openingBalance: 0n,
      creditLimit: 15_000_000n, statementDay: 5, dueDay: 20, sortOrder: 4,
    },
    reksaRizz: { name: "Reksa Dana Rizz", type: "investment", ownerId: rizzId, institutionId: null, openingBalance: 8_000_000n, sortOrder: 5 },
    jagoNadia: { name: "Jago Nadia", type: "bank", ownerId: nadiaId, institutionId: inst.jago, openingBalance: 9_000_000n, sortOrder: 1 },
    ovoNadia: { name: "OVO Nadia", type: "ewallet", ownerId: nadiaId, institutionId: inst.ovo, openingBalance: 250_000n, sortOrder: 2 },
    cashNadia: { name: "Tunai Nadia", type: "cash", ownerId: nadiaId, institutionId: null, openingBalance: 300_000n, sortOrder: 3 },
    shared: { name: "Rekening Bersama", type: "bank", ownerId: null, institutionId: inst.bca, openingBalance: 2_000_000n, sortOrder: 1 },
    emergency: { name: "Tabungan Darurat", type: "bank", ownerId: null, institutionId: inst.mandiri, openingBalance: 10_000_000n, sortOrder: 2 },
  } as const;
  const acc = {} as SeedContext["acc"];
  for (const [key, spec] of Object.entries(accountSpecs)) {
    const [row] = await db.insert(accounts).values({ ...spec, openingDate }).returning();
    acc[key as keyof SeedContext["acc"]] = { id: row!.id, ownerId: row!.ownerId, type: spec.type as SeedAccount["type"], openingBalance: spec.openingBalance };
  }

  const catIds = new Map<string, string>();
  let order = 0;
  for (const [kind, list] of [["expense", EXPENSE_CATEGORIES], ["income", INCOME_CATEGORIES]] as const) {
    for (const parent of list) {
      const [p] = await db.insert(categories).values({ name: parent.name, kind, icon: parent.icon, sortOrder: order++ }).returning();
      catIds.set(`${kind}:${parent.name}`, p!.id);
      for (const child of parent.children ?? []) {
        const [c] = await db.insert(categories).values({ name: child.name, kind, icon: child.icon, parentId: p!.id, sortOrder: order++ }).returning();
        catIds.set(`${kind}:${child.name}`, c!.id);
      }
    }
  }
  for (const s of SYSTEM_CATEGORIES) {
    const [c] = await db.insert(categories).values({ ...s, kind: "system", isSystem: true, sortOrder: order++ }).returning();
    catIds.set(`system:${s.name}`, c!.id);
  }
  const cat = (key: string) => {
    const id = catIds.get(key);
    if (!id) throw new Error(`Kategori seed tidak ada: ${key}`);
    return id;
  };

  const ctx: SeedContext = { rizzId, nadiaId, acc, cat };
  const generated = generateTransactions(rng, ctx, from, today, now);
  const txIds: string[] = [];
  for (let i = 0; i < generated.rows.length; i += 500) {
    const inserted = await db.insert(transactions).values(generated.rows.slice(i, i + 500)).returning({ id: transactions.id });
    txIds.push(...inserted.map((r) => r.id));
  }

  // tag "kantor" untuk makan siang kantor, supaya filter tag punya isi
  const [officeTag] = await db.insert(tags).values({ name: "kantor" }).returning();
  const officeTx = generated.rows.flatMap((r, i) => (r.note?.endsWith(" kantor") ? [txIds[i]!] : []));
  if (officeTx.length > 0) await db.insert(transactionTags).values(officeTx.map((transactionId) => ({ transactionId, tagId: officeTag!.id })));

  // draf dari jadwal berulang untuk kotak "Perlu dikonfirmasi"
  const [gymRule] = await db
    .insert(recurringRules)
    .values({
      template: { kind: "expense", amount: "350000", accountId: acc.cardRizz.id, categoryId: cat("expense:Kesehatan"), note: "Gym" },
      rrule: "FREQ=MONTHLY;BYMONTHDAY=1",
      nextRunOn: addMonthsKey(month, 1, 1),
      createdBy: rizzId,
    })
    .returning();
  await db.insert(transactions).values({
    kind: "expense", amount: 350_000n, accountId: acc.cardRizz.id, categoryId: cat("expense:Kesehatan"), note: "Gym",
    occurredAt: new Date(`${month}T06:00:00+07:00`), status: "draft", source: "recurring", recurringId: gymRule!.id,
    createdBy: rizzId, updatedBy: rizzId,
  });

  const userKey = (id: string) => `user:${id}`;
  const budgetRows = [
    { scopeOwner: userKey(rizzId), category: "Makan dan minum", amount: 2_500_000n, isMandatory: false },
    { scopeOwner: userKey(rizzId), category: "Transportasi", amount: 1_500_000n, isMandatory: false },
    { scopeOwner: userKey(rizzId), category: "Tagihan dan langganan", amount: 250_000n, isMandatory: true },
    { scopeOwner: userKey(rizzId), category: "Hiburan", amount: 400_000n, isMandatory: false },
    { scopeOwner: userKey(nadiaId), category: "Makan dan minum", amount: 1_800_000n, isMandatory: false },
    { scopeOwner: userKey(nadiaId), category: "Belanja pribadi", amount: 700_000n, isMandatory: false },
    { scopeOwner: userKey(nadiaId), category: "Keluarga", amount: 1_000_000n, isMandatory: true },
    { scopeOwner: "shared", category: "Rumah", amount: 4_700_000n, isMandatory: true },
    { scopeOwner: "shared", category: "Makan dan minum", amount: 2_500_000n, isMandatory: true },
  ];
  for (const m of [addMonthsKey(month, -1, 1), month]) {
    await db.insert(budgets).values(budgetRows.map(({ category, ...b }) => ({ ...b, month: m, categoryId: cat(`expense:${category}`) })));
  }

  const nextMonthly = (day: number) => {
    const thisMonth = addMonthsKey(month, 0, day);
    return thisMonth >= today ? thisMonth : addMonthsKey(month, 1, day);
  };
  const billSpecs = {
    sewa: { name: "Sewa rumah", ownerId: null, amount: 3_500_000n, payFromAccountId: acc.shared.id, categoryId: cat("expense:Sewa atau cicilan"), rrule: "FREQ=MONTHLY;BYMONTHDAY=1", nextDueOn: nextMonthly(1) },
    listrik: { name: "Listrik", ownerId: null, amount: 550_000n, amountIsEstimate: true, payFromAccountId: acc.shared.id, categoryId: cat("expense:Listrik"), rrule: "FREQ=MONTHLY;BYMONTHDAY=20", nextDueOn: nextMonthly(20) },
    internet: { name: "Internet", ownerId: null, amount: 385_000n, payFromAccountId: acc.shared.id, categoryId: cat("expense:Internet"), rrule: "FREQ=MONTHLY;BYMONTHDAY=10", nextDueOn: nextMonthly(10) },
    kartu: { name: "Kartu Kredit BCA", ownerId: rizzId, amount: 0n, payFromAccountId: acc.bcaRizz.id, creditCardAccountId: acc.cardRizz.id, rrule: "FREQ=MONTHLY;BYMONTHDAY=20", nextDueOn: nextMonthly(20) },
    bpjs: { name: "BPJS Kesehatan", ownerId: nadiaId, amount: 150_000n, payFromAccountId: acc.jagoNadia.id, categoryId: cat("expense:Kesehatan"), rrule: "FREQ=MONTHLY;BYMONTHDAY=26", nextDueOn: nextMonthly(26) },
  };
  const billIds: Record<string, string> = {};
  for (const [key, spec] of Object.entries(billSpecs)) {
    const [row] = await db.insert(bills).values(spec).returning();
    billIds[key] = row!.id;
  }
  if (generated.billPayments.length > 0) {
    await db.insert(billPayments).values(
      generated.billPayments.map((p) => ({
        billId: billIds[p.bill]!,
        periodStart: p.periodStart,
        transactionId: txIds[p.index]!,
        paidAt: generated.rows[p.index]!.occurredAt as Date,
      })),
    );
  }

  await db.insert(goals).values([
    { name: "Dana darurat", ownerId: null, targetAmount: 60_000_000n, linkedAccountId: acc.emergency.id, deadline: "2027-12-31" },
    { name: "Laptop baru", ownerId: rizzId, targetAmount: 18_000_000n, achievedAt: new Date(`${addMonthsKey(month, -2, 15)}T10:00:00+07:00`) },
  ]);
  const [trip] = await db.insert(goals).values({ name: "Liburan ke Bali", ownerId: null, targetAmount: 15_000_000n, deadline: addMonthsKey(month, 9, 30) }).returning();
  const contributions = [];
  for (let m = addMonthsKey(from, 0, 3); m <= today; m = addMonthsKey(m, 1, 3)) {
    contributions.push({ goalId: trip!.id, amount: 1_000_000n, contributedAt: new Date(`${m}T20:00:00+07:00`), createdBy: m.endsWith("-03") && rng.chance(0.5) ? rizzId : nadiaId });
  }
  if (contributions.length > 0) await db.insert(goalContributions).values(contributions);

  // nilai pasar reksa dana akhir bulan: modal disetor x pertumbuhan acak kecil
  const valuations = [];
  let invested = accountSpecs.reksaRizz.openingBalance;
  let growth = 1.0;
  for (let m = from; m <= month; m = addMonthsKey(m, 1, 1)) {
    invested += 1_000_000n;
    growth *= 1 + (rng.next() - 0.35) * 0.03;
    const valuedOn = addDaysKey(addMonthsKey(m, 1, 1), -1) < today ? addDaysKey(addMonthsKey(m, 1, 1), -1) : today;
    valuations.push({ accountId: acc.reksaRizz.id, valuedOn, marketValue: BigInt(Math.round((Number(invested) * growth) / 1000) * 1000) });
  }
  await db.insert(investmentValuations).values(valuations);

  console.log(`Seed selesai: 2 user, ${Object.keys(acc).length} akun, ${catIds.size} kategori, ${txIds.length + 1} transaksi (${from} sampai ${today}).`);
}

main()
  .catch((e: unknown) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => client.end({ timeout: 5 }));
