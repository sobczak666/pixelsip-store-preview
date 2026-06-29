# Pixel Sip Store — checklista przed startem sprzedaży 🚀

Sklep jest **technicznie gotowy** (konfigurator, koszyk, checkout, dokumenty prawne, SEO, responsywność).
Zanim ruszysz ze sprzedażą, uzupełnij poniższe — to są rzeczy, których nie da się wymyślić za Ciebie (dane firmy, płatności).

## 🔴 KRYTYCZNE (bez tego nie sprzedawaj legalnie)

### 1. Dane sprzedawcy — ✅ ZROBIONE (2026-06-29)
Dane JDG wpisane we wszystkie dokumenty i stopki: **PIOTR SOBCZYŃSKI MODA-MIX SPORT STYLE**, NIP 1130115908, REGON 011375243, ul. Ratuszowa 11, 03-450 Warszawa, kontakt@pixelsip.pl. Zero placeholderów (zweryfikowane grepem + audytem wieloagentowym pod wymogi PayU). Dokumenty przeszły audyt prawny PL/RODO.
- ⚠️ Do zrobienia po stronie poczty: utworzyć skrzynkę **kontakt@pixelsip.pl** (lub alias → zamowienia@). Opcjonalnie telefon kontaktowy (PayU akceptuje sam e-mail).

### 2. Płatności — bramka **PayU** (backend gotowy, czeka na klucze)
- Wybór: **PayU** (przełączone z Przelewy24). Integracja po stronie backendu — patrz `backend/` (`payu.py` budowane) i `backend/OPERACJE.md`.
- Do aktywacji: konto PayU → POS ID, drugi klucz (MD5 do podpisu), OAuth client_id/secret → ustaw w `/etc/pixelsip.env` na VPS.
- `CONFIG.orderEndpoint` w `js/store.js` już wskazuje na `https://api.pixelsip.pl/api/orders`; `CONFIG.shopEmail` = kontakt@pixelsip.pl.

### 3. Domena — ✅ pixelsip.pl (OVH)
- `url`/JSON-LD wskazują `https://pixelsip.pl`. Sklep prywatnie na `sklep.pixelsip.pl` (basic_auth) do czasu publicznego startu.

## 📦 Realizacja zamówienia (config → plik do druku)

Sklep nie predefiniuje wariantów — klient konfiguruje (wzór + rozmiar + pozycja paska + kolor), a **plik do druku generujesz z configu**:

1. W mailu zamówienia każda pozycja ma linię `[config: ...]`, np.:
   - `[config: base=scene design=vaporwave-ocean size=tumbler-900 strip=both gora_tekst=#FFFFFF gora_tlo=#FF2E97 dol_tekst=glitch dol_tlo=#000000]`
   - `[config: base=geo wzor=romby c1=#0B0A16 c2=#FF2E97 n=10 size=tumbler-900 strip=both gora_tekst=glitch gora_tlo=#000000 dol_tekst=glitch dol_tlo=#000000]`
   - `[config: base=tile emblemat=water-drop tlo=#0B0A16 n=6 size=tumbler-900 strip=both ...]`
2. **Kopiujesz całą zawartość nawiasu** i wklejasz jako jeden argument:
   ```bash
   python pixel-lab/generate_order.py "base=geo wzor=romby c1=#0B0A16 c2=#FF2E97 n=10 size=tumbler-900 strip=both gora_tekst=glitch gora_tlo=#000000 dol_tekst=glitch dol_tlo=#000000"
   ```
3. Dostajesz gotowy **PNG + PDF 1:1** (z 4 mm spadem, 300 DPI) w `pixel-lab/orders/` → wysyłasz do drukarni.

> Trzy tryby bazy: `scene` (sceny pixel-art), `geo` (wzory geometryczne: paski-pion/paski-poziom/szachownica/romby/kropki/krata/zygzak), `tile` (emblemat kafelkowany — 100 emblematów).
> `n` = liczba powtórzeń wzoru na obwodzie (z przycisków Drobny/Średni/Duży/Wielki w sklepie) — komórka = szerokość/`n`, więc wzór **zawsze domyka się bezszwowo na szwie** z tyłu kubka. Podgląd 3D w sklepie i plik z generatora używają tej samej logiki — to, co klient widzi, to co dostaje na druku.
> `napis=<kod>` (opcjonalne) — własny napis klienta na pasku zamiast „PIXEL SIP", w foncie marki **Jersey 25**. Wartość jest zakodowana base64url (bez spacji, by nie rozbić configu) — generator sam ją dekoduje i renderuje. Brak `napis=` → domyślny wordmark PIXEL SIP. Krótki napis = dwie kopie jak wordmark; dłuższy = jedna wyśrodkowana.

## 🟡 WAŻNE (zrób przed lub tuż po starcie)

- **Polityka prywatności — odbiorcy danych (RODO):** ✅ uzupełnione (OVH, PayU S.A., InPost, DPD, biuro rachunkowe, Meta). Jeśli włączysz TikTok Pixel — najpierw dopisz TikTok do polityki (sekcje 4/9/10) i do banera cookie.
- **Analytics/cookies:** jeśli dodasz Google Analytics / Meta Pixel — dopisz je w polityce i rozszerz baner cookie o zgodę „odrzuć/akceptuj statystyki".
- **Zgody:** newsletter i checkout mają już wymagane checkboxy zgody — podłącz je do swojego systemu (Formspree/mailing).
- **Zdjęcia produktu:** używamy zdjęć producenta (`assets/products/`). Docelowo zrób własne sesyjne — wzmacnia premium i unika zależności.

## 🟢 OPCJONALNE (wzmacnia konwersję)

- **Social proof:** gdy zbierzesz prawdziwe opinie — dodaj sekcję recenzji (NIE wstawiaj fikcyjnych — zakazane prawem).
- **Mechanika dropów:** baner „następny drop" z licznikiem (model kolekcjonerski ze strategii).
- **UGC „Twój loadout":** galeria zdjęć tumblerów na biurkach klientów (#PixelSip).

## Jak przebudować po zmianach
```bash
cd store
python3 build_index.py      # po edycji treści/cen/danych w build_index.py lub data/*.json
python3 convert_pages.py    # po edycji dokumentów prawnych pages/*.md
```

## Deploy
Sklep to statyczne pliki — wrzuć folder `store/` na dowolny hosting statyczny (Netlify, Vercel, Cloudflare Pages, zwykły hosting z HTTPS). Wymagany HTTPS (płatności, cookies, SEO).
