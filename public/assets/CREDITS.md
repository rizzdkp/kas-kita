# Kredit aset

Semua gambar di `public/assets/3d/` dan `public/brands/` diunduh dari koleksi terbuka, bukan dibuat sendiri. Keputusan: `docs/decisions/0016-aset-unduhan.md`.

## Microsoft Fluent Emoji (gambar 3D)

- Sumber: https://github.com/microsoft/fluentui-emoji, commit `1ffb34c752ecf5d402f04cfb4b392c77f57c54bc` (24 Agustus 2026)
- Hak cipta Microsoft Corporation, lisensi MIT: `licenses/fluentui-emoji-MIT.txt`
- Perubahan: PNG 3D 256 px diubah ke WebP 64, 128, dan 256 px dengan `scripts/assets/build-3d.mjs`. Gambar tidak diubah.

| Nama (`3d/<nama>-<ukuran>.webp`) | Folder sumber |
|---|---|
| `abacus` | `assets/Abacus/3D/` |
| `airplane` | `assets/Airplane/3D/` |
| `alarm-clock` | `assets/Alarm clock/3D/` |
| `automobile` | `assets/Automobile/3D/` |
| `baby-bottle` | `assets/Baby bottle/3D/` |
| `balance-scale` | `assets/Balance scale/3D/` |
| `bank` | `assets/Bank/3D/` |
| `bar-chart` | `assets/Bar chart/3D/` |
| `bell` | `assets/Bell/3D/` |
| `books` | `assets/Books/3D/` |
| `briefcase` | `assets/Briefcase/3D/` |
| `bullseye` | `assets/Bullseye/3D/` |
| `bus` | `assets/Bus/3D/` |
| `chart-increasing` | `assets/Chart increasing/3D/` |
| `check-mark-button` | `assets/Check mark button/3D/` |
| `classical-building` | `assets/Classical building/3D/` |
| `clipboard` | `assets/Clipboard/3D/` |
| `closed-mailbox-with-lowered-flag` | `assets/Closed mailbox with lowered flag/3D/` |
| `coin` | `assets/Coin/3D/` |
| `convenience-store` | `assets/Convenience store/3D/` |
| `counterclockwise-arrows-button` | `assets/Counterclockwise arrows button/3D/` |
| `credit-card` | `assets/Credit card/3D/` |
| `dollar-banknote` | `assets/Dollar banknote/3D/` |
| `droplet` | `assets/Droplet/3D/` |
| `envelope` | `assets/Envelope/3D/` |
| `fork-and-knife-with-plate` | `assets/Fork and knife with plate/3D/` |
| `fuel-pump` | `assets/Fuel pump/3D/` |
| `gear` | `assets/Gear/3D/` |
| `gem-stone` | `assets/Gem stone/3D/` |
| `globe-with-meridians` | `assets/Globe with meridians/3D/` |
| `graduation-cap` | `assets/Graduation cap/3D/` |
| `high-voltage` | `assets/High voltage/3D/` |
| `hot-beverage` | `assets/Hot beverage/3D/` |
| `house` | `assets/House/3D/` |
| `house-with-garden` | `assets/House with garden/3D/` |
| `inbox-tray` | `assets/Inbox tray/3D/` |
| `key` | `assets/Key/3D/` |
| `label` | `assets/Label/3D/` |
| `ledger` | `assets/Ledger/3D/` |
| `left-right-arrow` | `assets/Left-right arrow/3D/` |
| `light-bulb` | `assets/Light bulb/3D/` |
| `memo` | `assets/Memo/3D/` |
| `mobile-phone` | `assets/Mobile phone/3D/` |
| `money-bag` | `assets/Money bag/3D/` |
| `money-with-wings` | `assets/Money with wings/3D/` |
| `motor-scooter` | `assets/Motor scooter/3D/` |
| `motorway` | `assets/Motorway/3D/` |
| `musical-notes` | `assets/Musical notes/3D/` |
| `open-file-folder` | `assets/Open file folder/3D/` |
| `package` | `assets/Package/3D/` |
| `page-facing-up` | `assets/Page facing up/3D/` |
| `party-popper` | `assets/Party popper/3D/` |
| `paw-prints` | `assets/Paw prints/3D/` |
| `people-hugging` | `assets/People hugging/3D/` |
| `pill` | `assets/Pill/3D/` |
| `popcorn` | `assets/Popcorn/3D/` |
| `purse` | `assets/Purse/3D/` |
| `receipt` | `assets/Receipt/3D/` |
| `red-envelope` | `assets/Red envelope/3D/` |
| `repeat-button` | `assets/Repeat button/3D/` |
| `running-shoe` | `assets/Running shoe/3D/` |
| `satellite-antenna` | `assets/Satellite antenna/3D/` |
| `seedling` | `assets/Seedling/3D/` |
| `shopping-bags` | `assets/Shopping bags/3D/` |
| `shopping-cart` | `assets/Shopping cart/3D/` |
| `spiral-calendar` | `assets/Spiral calendar/3D/` |
| `steaming-bowl` | `assets/Steaming bowl/3D/` |
| `t-shirt` | `assets/T-shirt/3D/` |
| `triangular-flag` | `assets/Triangular flag/3D/` |
| `trophy` | `assets/Trophy/3D/` |
| `wrapped-gift` | `assets/Wrapped gift/3D/` |

## idn-finlogos (logo bank dan e-wallet)

- Sumber: paket npm `idn-finlogos@2.5.0` (https://github.com/hafidznoor/idn-finlogos), koleksi oleh Hafidz Noor Fauzi
- Lisensi aset: CC BY-NC 4.0 (https://creativecommons.org/licenses/by-nc/4.0/), salinan `licenses/idn-finlogos-LICENSE-ASSETS.txt`
- Setiap logo adalah merek dagang pemiliknya masing-masing; lihat `licenses/idn-finlogos-NOTICE.txt`. Dipakai hanya sebagai penanda akun di app pribadi non-komersial, tanpa afiliasi atau dukungan dari pemilik merek.
- Perubahan: hanya menambah atribut `xmlns` pada elemen `<svg>` supaya berkas bisa dimuat lewat `<img>`. Bentuk dan warna logo tidak diubah.

| Berkas | Sumber di paket |
|---|---|
| `brands/bca.svg` | `dist/icons/bca.svg` |
| `brands/jago.svg` | `dist/icons/jago-app.svg` |
| `brands/gopay.svg` | `dist/icons/gopay-alt.svg` |
| `brands/ovo.svg` | `dist/icons/ovo.svg` |
| `brands/mandiri.svg` | `dist/icons/mandiri.svg` |
| `brands/bri.svg` | `dist/icons/bri-alt.svg` |
| `brands/bni.svg` | `dist/icons/bni.svg` |
| `brands/dana.svg` | `dist/icons/dana.svg` |
| `brands/shopeepay.svg` | `dist/icons/shopee-pay.svg` |
| `brands/seabank.svg` | `dist/icons/seabank.svg` |
| `brands/jenius.svg` | `dist/icons/jenius-app.svg` |
| `brands/blu.svg` | `dist/icons/blu-bca.svg` |
| `brands/cimb.svg` | `dist/icons/cimb-niaga.svg` |
| `brands/permata.svg` | `dist/icons/permata.svg` |
