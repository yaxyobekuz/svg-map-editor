# SVG Map Editor

Google Maps suniy yo'ldosh xaritasi ustida ishlovchi, Figma uslubidagi SVG xarita
muharriri. Xarita ustiga **frame**, **rectangle** va **vector** chizib, turli
chegaralarni belgilab, natijani **SVG** ko'rinishida eksport qilasiz.

## Asosiy g'oya

- Fonda **Google Maps** (2D, suniy yo'ldosh) — surish va kattalashtirish mumkin.
- Ustida **SVG overlay** — chizilgan obyektlar xarita bilan birga harakatlanadi.
  Har bir obyekt **geografik koordinatada (lat/lng)** saqlanadi va xarita
  harakatlanganda ekran piksellariga qayta proyeksiya qilinadi — shuning uchun
  obyektlar xaritaga "yopishib" turadi.
- O'ng tomonda **shablonlar** paneli. Shablonni xaritaga sudrab tashlaysiz.
  Masalan, **Uy** shabloni = bitta o'rab turuvchi **FRAME** + ichida **tom**
  (rectangle).
- Har bir **rectangle/frame tahrirlanadigan nuqtalarga** ega (Figma kabi).
  Obyektga **2 marta bosib** nuqta tahrirlash rejimiga kirasiz: nuqtalarni
  **surish**, qirra o'rtasiga bosib **qo'shish**, `Delete` bilan **o'chirish**.
  Shu orqali to'rtburchakni xaritadagi binoning haqiqiy shakliga aylantirasiz.
- Har bir obyektda **atributlar** bo'ladi (`id`, `frame-name`, `type`,
  `total-path`, ...). Bu atributlar eksport qilingan SVG'da `data-*` sifatida
  saqlanadi — xaritani boshqarish oson bo'ladi.

## Ishga tushirish

1. Google Maps API kalitini oling va "Maps JavaScript API" ni yoqing:
   https://console.cloud.google.com/google/maps-apis/credentials
2. Kalitni `.env.local` fayliga yozing (bu fayl git'ga tushmaydi):

   ```
   VITE_GOOGLE_MAPS_API_KEY=sizning_kalitingiz
   ```

   > Namuna uchun `.env.example` ga qarang.

3. O'rnatish va ishga tushirish:

   ```bash
   npm install
   npm run dev
   ```

## Buyruqlar

| Buyruq           | Vazifasi                          |
| ---------------- | --------------------------------- |
| `npm run dev`    | Dev serverni ishga tushirish      |
| `npm run build`  | Ishlab chiqarish uchun build      |
| `npm test`       | Yadro mantig'i testlari (Vitest)  |
| `npm run lint`   | Oxlint                            |

## Klaviatura yorliqlari

| Tugma          | Vosita                  |
| -------------- | ----------------------- |
| `V`            | Tanlash / ko'chirish    |
| `H`            | Qo'l (xaritani surish)  |
| `F`            | Frame chizish           |
| `R`            | Rectangle chizish       |
| 2 marta bosish | Nuqta tahrirlash rejimi |
| `Delete`       | Obyekt (yoki tanlangan nuqta) o'chirish |
| `Esc`          | Nuqta rejimidan chiqish / tanlovni bekor qilish |

## Loyiha tuzilishi

```
src/
  types.ts                 — ma'lumotlar modeli (Frame/Rect/Polygon, atributlar)
  store.ts                 — zustand store (obyektlar, tanlov, amallar)
  lib/
    geo.ts                 — lat/lng <-> piksel proyeksiya, metr hisob-kitoblari
    useGoogleMap.ts        — Google Maps yuklash + jonli proyektor
    templates.ts           — tayyor shablonlar (Uy, Uy+Yer, Yo'l, ...)
    exportSvg.ts           — SVG eksport
  components/
    MapCanvas.tsx          — xarita + overlay + drag&drop
    SvgOverlay.tsx         — chizish/tanlash/ko'chirish/o'lcham o'zgartirish
    Toolbar.tsx            — yuqori panel (vositalar + eksport)
    LayersPanel.tsx        — chap panel (qatlamlar daraxti)
    TemplatesPanel.tsx     — o'ng panel (shablonlar)
    PropertiesPanel.tsx    — o'ng panel (atributlar va uslub)
```

## Eslatma (litsenziya)

Google Maps tasvirlarini o'z mahsulotingizga eksport qilish / qayta chizish
Google ToS bo'yicha cheklangan bo'lishi mumkin — ichki/shaxsiy foydalanish uchun
mos. Tijoriy mahsulot uchun litsenziyaga ruxsat etilgan tile manbasini (masalan,
MapLibre + ochiq satellite tiles) ko'rib chiqish tavsiya etiladi.
