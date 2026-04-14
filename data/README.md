# Data Files

These JSON files contain static data extracted from the existing Genea Azul site.

## Status

- **`immigration.json`** — COMPLETE (38 entries covering 44 individual countries — some entries combine related countries, e.g., "Alemania / Rusia", "Siria / Líbano", "Croacia / Eslovenia / Serbia (Yugoslavia)", "República Checa / Eslovaquia (Checoslovaquia)")
- **`personalities.json`** — SAMPLE ONLY (15 of 245+ entries). Full data must be extracted from the current `index.ftlh` file (lines 743-988 in `gedcom-analyzer/src/main/resources/templates/site-v2/index.ftlh`)
- **`surnames.json`** — SAMPLE ONLY (25 of 4,557+ entries). Full data must be extracted from the current `index.ftlh` file (lines 1001-1749+ in `gedcom-analyzer/src/main/resources/templates/site-v2/index.ftlh`)

## How to Extract Full Data

The source HTML file is at (sibling project):
```
../gedcom-analyzer/src/main/resources/templates/site-v2/index.ftlh
```

### Personalities
Look for the accordion section with id `flush-collapseTwo`. Each `<li>` contains one personality. Parse the HTML to extract:
- Title/rank prefix (inside `<abbr>` tags)
- Full name (mix of regular text and `<span class="fw-semibold">`)
- Nickname (inside `<span class="fst-italic">`)
- Birth/death years and places (inside `<span>` with `title` attributes)

### Surnames
Look for the accordion section with id `flush-collapseThree`. Each `<li>` contains one surname. Parse:
- Primary surname (main text)
- Variants (inside `<span class="text-secondary">` in parentheses)
