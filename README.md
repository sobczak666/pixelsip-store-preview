# Pixel Sip — sklep internetowy

Gotowy do sprzedaży sklep one-page dla tumblerów Pixel Sip (600 / 900 ml, 56 wzorów).
Statyczny (HTML/CSS/JS, bez frameworków, bez backendu) — hostowalny wszędzie.

> 🚀 **Przed startem sprzedaży przeczytaj [GO-LIVE.md](GO-LIVE.md)** (dane firmy, płatności, domena).

## Uruchomienie lokalne
```bash
cd store
python3 -m http.server 8000
# otwórz http://localhost:8000
```

## Co jest w środku
| Element | Plik |
|---|---|
| Strona główna (generowana) | `index.html` ← `build_index.py` z `data/copy.json`+`products.json` |
| Style (ciemny neon, responsywne) | `css/styles.css` |
| Logika: galeria, konfigurator, koszyk, checkout | `js/store.js` |
| Dane produktów/cen/dostawy | `data/products.json` |
| Katalog 56 wzorów (nazwy, blurby) | `data/designs.json` |
| Treści PL (copy) | `data/copy.json` |
| Dokumenty prawne | `pages/*.html` ← `convert_pages.py` z `pages/*.md` |
| Zdjęcia produktu (producent) | `assets/products/` |
| Miniatury 56 wzorów | `assets/designs/` |
| Marka (logo, hero, favicon) | `assets/brand/` |

## Funkcje
- **Konfigurator:** rozmiar (600/900) + wybór wzoru z 56 → **live podgląd 3D tumblera** (Three.js, obrót 360°, nadruk owinięty na cylindrze) → koszyk.
  - 3D: `js/tumbler3d.js` + `js/vendor/` (Three.js lokalnie, offline). Tekstury: `assets/mockup/` ← `build_textures.py` (z zbrandowanych nadruków).
- **Galeria** z filtrem kategorii (Sceny / Kolekcja PL / Abstrakcyjne) i wyszukiwarką.
- **Koszyk** (localStorage) + slide-in drawer + pasek darmowej dostawy.
- **Checkout** z wyborem dostawy (total uwzględnia dostawę), walidacją, zgodą i trybem demo (mailto) — gotowy pod Formspree/bramkę.
- **Zgodność PL:** regulamin, polityka prywatności (RODO), prawo odstąpienia z wyjątkiem personalizacji (art. 38), baner cookie, zgody marketingowe.
- **SEO/a11y:** meta+OG, JSON-LD Product, lazy-load obrazów, focus-trap w modalach, aria, responsywność (desktop/tablet/mobile).

## Przebudowa
```bash
python3 build_index.py     # po zmianie treści/cen/danych
python3 convert_pages.py   # po zmianie dokumentów prawnych
```

## Status jakości
Przeszedł wieloagentowy adversarialny review (responsywność, JS/koszyk, prawo PL, SEO/a11y, brand/konwersja) oraz audyt zgodności pod wymogi PayU „Wymagania dla Twojej strony" + prawo konsumenckie PL/RODO (2026-06-29) — naprawiono błędy krytyczne i wysokie. Dane firmy (JDG) wpisane, wszystkie 6 wymogów PayU spełnione. Pozostałe: aktywacja bramki PayU (klucze) + skrzynka kontakt@ (patrz GO-LIVE.md).
