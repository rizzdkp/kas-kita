import { test } from "@playwright/test";
import { loginAs } from "./helpers/session";

const OUT = "/tmp/claude-0/-home-user-kas-kita/9edd7bf2-cf92-5233-882d-176ca90c21b7/scratchpad/shots-ai-inti";
const variant = process.env.SHOT_VARIANT ?? "ok";
for (const [vp, size] of [["desktop", { width: 1440, height: 900 }], ["mobile", { width: 390, height: 844 }]] as const) {
  for (const scheme of ["light", "dark"] as const) {
    test(`${variant}-${vp}-${scheme}`, async ({ browser }) => {
      test.setTimeout(90_000);
      const context = await browser.newContext({ viewport: size, colorScheme: scheme, locale: "id-ID" });
      await loginAs(context);
      const page = await context.newPage();
      page.on("console", (m) => { if (m.type() === "error") console.log("CONSOLE", m.text().slice(-1500)); });
      page.on("pageerror", (e) => console.log("PAGEERROR", e.message.slice(0, 600)));
      await page.goto("/pengaturan#ai");
      const s = page.locator("#ai");
      await s.scrollIntoViewIfNeeded();
      await s.screenshot({ path: `${OUT}/${variant}-${vp}-${scheme}-0-kosong.png` });
      await s.getByLabel("Base URL").fill("http://localhost:4011/v1");
      await s.getByLabel("API key").fill("sk-shot-abcd");
      await s.getByRole("button", { name: "Ambil daftar model" }).click();
      await s.getByText("model ditemukan").waitFor();
      await s.getByRole("combobox", { name: "Model teks" }).click();
      await s.screenshot({ path: `${OUT}/${variant}-${vp}-${scheme}-1-daftar.png` });
      await s.getByRole("option", { name: "fake-text" }).click();
      await s.getByRole("combobox", { name: "Model vision" }).fill("vis");
      await s.getByRole("option", { name: "fake-vision" }).click();
      await s.getByRole("button", { name: "Tes koneksi" }).click();
      await s.getByText(/Hasil tes koneksi|merespons/).first().waitFor();
      await s.screenshot({ path: `${OUT}/${variant}-${vp}-${scheme}-2-tes.png` });
      if (variant === "ok") {
        await s.getByRole("button", { name: "Simpan" }).click();
        await s.getByText("Tersimpan, berakhiran").waitFor();
        await page.waitForTimeout(500);
        await s.screenshot({ path: `${OUT}/${variant}-${vp}-${scheme}-3-tersimpan.png` });
        await s.getByRole("button", { name: "Hapus pengaturan AI" }).click();
        await page.waitForTimeout(400);
        await page.screenshot({ path: `${OUT}/${variant}-${vp}-${scheme}-4-dialog.png` });
        await page.getByRole("dialog").getByRole("button", { name: "Hapus pengaturan AI" }).click();
        await s.getByText("AI belum dipasang.").waitFor();
      }
      await context.close();
    });
  }
}
