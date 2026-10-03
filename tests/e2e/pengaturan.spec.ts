import { execFileSync } from "node:child_process";
import { expect, test, type Page } from "@playwright/test";
import { loginAs } from "./helpers/session";

const RIZZ = "rizz@kaskita.local";
const NADIA = "nadia@kaskita.local";

// sesi baru (tanpa cache helper) supaya mencabutnya tidak mengganggu tes lain
function freshSession(email: string): { name: string; value: string } {
  const out = execFileSync("bash", ["-c", `set -a; . ./.env.local; set +a; npx tsx scripts/dev-session.ts ${JSON.stringify(email)}`], { encoding: "utf8" });
  return JSON.parse(out.trim().split("\n").at(-1) ?? "") as { name: string; value: string };
}

async function saveDisplayName(page: Page, name: string) {
  await page.goto("/pengaturan#profil");
  const input = page.getByLabel("Nama tampilan");
  await input.fill(name);
  await page.locator("#profil").getByRole("button", { name: "Simpan" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Tersimpan" })).toBeVisible();
}

test.describe("pengaturan", () => {
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test("nama tampilan baru terlihat partner di toggle cakupan", async ({ browser }) => {
    const rizz = await browser.newContext();
    const nadia = await browser.newContext();
    await loginAs(rizz, RIZZ);
    await loginAs(nadia, NADIA);
    const rizzPage = await rizz.newPage();
    const nadiaPage = await nadia.newPage();
    const newName = `Rizz ${Date.now().toString(36).slice(-4)}`;
    try {
      await saveDisplayName(rizzPage, newName);
      await nadiaPage.goto("/");
      await expect(nadiaPage.getByRole("radiogroup", { name: "Cakupan" }).first().getByRole("radio", { name: newName })).toBeVisible();
    } finally {
      await saveDisplayName(rizzPage, "Rizz");
      await rizz.close();
      await nadia.close();
    }
  });

  test("warna partner tidak bisa dipilih dan diberi keterangan", async ({ context, page }) => {
    await loginAs(context, RIZZ);
    await page.goto("/pengaturan#profil");
    const taken = page.getByRole("radio", { name: /dipakai Nadia/ });
    await expect(taken).toBeDisabled();
    await expect(page.getByText("Dipakai Nadia")).toBeVisible();
  });

  test("Kurangi transparansi mengubah atribut data-transparency di html", async ({ context, page }) => {
    await loginAs(context, RIZZ);
    await page.goto("/pengaturan#tampilan");
    const html = page.locator("html");
    const toggle = page.getByRole("switch", { name: "Kurangi transparansi" });
    await expect(toggle).toHaveAttribute("aria-checked", "false");
    await toggle.click();
    await expect(html).toHaveAttribute("data-transparency", "reduced");
    await page.reload();
    await expect(html).toHaveAttribute("data-transparency", "reduced");
    await page.getByRole("switch", { name: "Kurangi transparansi" }).click();
    await expect(html).not.toHaveAttribute("data-transparency", "reduced");
  });

  test("cabut sesi perangkat ini mengeluarkan perangkat itu", async ({ browser }) => {
    const ctx = await browser.newContext();
    const { name, value } = freshSession(RIZZ);
    await ctx.addCookies([{ name, value, domain: "localhost", path: "/" }]);
    const page = await ctx.newPage();
    await page.goto("/pengaturan#sesi");
    const current = page.getByRole("list", { name: "Sesi aktif" }).getByRole("listitem").filter({ has: page.getByText("Perangkat ini", { exact: true }) });
    await expect(current).toHaveCount(1);
    await current.getByRole("button", { name: /Keluar dari perangkat ini/ }).click();
    await expect(page).toHaveURL(/\/login/);
    await page.goto("/pengaturan");
    await expect(page).toHaveURL(/\/login/);
    await ctx.close();
  });
});
