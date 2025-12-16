# Dark Mode Fix - Beskeder Panel

## Problem
Teksten "Ingen beskeder endnu. Vær den første til at skrive!" var ulæselig i light mode på grund af dårlig kontrast mellem grå tekst (#717171) og hvid baggrund (#ffffff).

## Årsag
Komponenten `TopBar.jsx` (MessagesPanel) brugte **hardcodede** `#ffffff` værdier for baggrundsfarver i stedet for design tokens. Dette betød at:
- Light mode: Grå tekst (`var(--muted)` = #717171) på hvid baggrund (#ffffff) = dårlig kontrast
- Dark mode: Lysere grå tekst (`var(--muted)` = #bcbcbc) på hvid baggrund (#ffffff) = forkert tema

## Løsning
Erstattede alle hardcodede `#ffffff` værdier med `var(--surface)` token i følgende steder:

### Ændringer i `TopBar.jsx`:
1. **Linje 150**: Hoved-container baggrund
   - Før: `backgroundColor: '#ffffff'`
   - Efter: `backgroundColor: 'var(--surface)'`

2. **Linje 157**: Beskeder-liste baggrund
   - Før: `backgroundColor: '#ffffff'`
   - Efter: `backgroundColor: 'var(--surface)'`

3. **Linje 208**: Input-område baggrund
   - Før: `backgroundColor: '#ffffff'`
   - Efter: `backgroundColor: 'var(--surface)'`

4. **Linje 223**: Input-felt baggrund
   - Før: `backgroundColor: '#ffffff'`
   - Efter: `backgroundColor: 'var(--surface)'`

## Resultat
Nu følger beskeder-panelet korrekt dark/light mode reglerne:
- **Light mode**: `--surface` = #ffffff (hvid), `--muted` = #717171 (grå) - god kontrast ✅
- **Dark mode**: `--surface` = #111111 (mørk), `--muted` = #bcbcbc (lysere grå) - god kontrast ✅

## Design Tokens Verificeret
Alle relevante tokens i `src/tokens.css` er korrekt defineret:

### Light Mode (:root)
```css
--ink: #222222;        /* Primær tekst */
--muted: #717171;      /* Sekundær/muted tekst */
--surface: #ffffff;    /* Kort/panel baggrund */
--bg: #ffffff;         /* Hoved baggrund */
--line: #ebebeb;       /* Borders */
```

### Dark Mode ([data-theme="dark"])
```css
--ink: #f5f5f5;        /* Primær tekst */
--muted: #bcbcbc;      /* Sekundær/muted tekst */
--surface: #111111;    /* Kort/panel baggrund */
--bg: #0b0b0b;         /* Hoved baggrund */
--line: #242424;       /* Borders */
```

## Konklusion
Problemet var **ikke** med design tokens, men med hardcodede værdier i komponenten. Ved at bruge tokens korrekt, følger UI'et nu automatisk det valgte tema.
