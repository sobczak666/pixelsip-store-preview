# Pixel Sip Store — checklista przed startem sprzedaży 🚀

Sklep jest **technicznie gotowy** (konfigurator, koszyk, checkout, dokumenty prawne, SEO, responsywność).
Zanim ruszysz ze sprzedażą, uzupełnij poniższe — to są rzeczy, których nie da się wymyślić za Ciebie (dane firmy, płatności).

## 🔴 KRYTYCZNE (bez tego nie sprzedawaj legalnie)

### 1. Dane sprzedawcy
W plikach `pages/*.md` są placeholdery do wypełnienia (potem uruchom `python3 convert_pages.py`):
- `[NAZWA FIRMY]`, `[NIP]`, `[REGON]`, `[ADRES]`, `[EMAIL]`, `[TELEFON]`, `[godziny obsługi]`, `[data]`, `[adres URL sklepu]`, `[numer rachunku]`
- W `index.html` (generowane z `build_index.py`) stopka ma `[NAZWA FIRMY], [NIP]` — popraw w `build_index.py` (szukaj `[NAZWA FIRMY]`) i uruchom `python3 build_index.py`.
- Sprawdź, co zostało: `grep -rn "DO UZUPEŁNIENIA\|\[NAZWA\|\[NIP\|\[ADRES\|\[EMAIL" pages/`

### 2. Płatności (wybierz jedną drogę)
W `js/store.js` → obiekt `CONFIG`:
- **Najszybciej (zamówienia mailem):** załóż darmowe konto [Formspree](https://formspree.io), stwórz formularz, wklej endpoint do `CONFIG.orderEndpoint`. Zamówienia będą przychodzić mailem; płatność realizujesz przelewem/BLIK ręcznie.
- **Pełna bramka (automatyczne płatności):** podłącz Przelewy24 / Stripe / PayU / [Snipcart](https://snipcart.com). Punkt integracji: funkcja `submitOrder()` w `store.js` — zamiast `mailto` przekieruj do utworzonej sesji płatności bramki. Uzupełnij też operatora w `pages/regulamin.md` § 5.
- Ustaw `CONFIG.shopEmail` na swój adres zamówień.

### 3. Domena
- W `build_index.py`: `og:image` i `url` w JSON-LD wskazują na `https://pixelsip.pl` — zmień na swoją domenę, uruchom `python3 build_index.py`.

## 🟡 WAŻNE (zrób przed lub tuż po starcie)

- **Polityka prywatności — odbiorcy danych (RODO):** w `pages/polityka-prywatnosci.md` uzupełnij realnych dostawców (hosting, operator płatności, kurier, e-mail, ewentualnie analytics). Re-konwersja: `python3 convert_pages.py`.
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
