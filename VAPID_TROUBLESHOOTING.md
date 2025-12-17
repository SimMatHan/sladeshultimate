# Guide til at Verificere og Rette VAPID Nøgle Encoding Fejl

## Problem
Fejlen "The string did not match the expected pattern" opstår når VAPID_PUBLIC_KEY ikke kan decodes korrekt. Dette skyldes typisk:

1. **Skjulte tegn** (newlines, mellemrum, tabs) i miljøvariablen
2. **Forkert encoding format** (ikke Base64 URL-safe)
3. **Copy-paste fejl** fra forskellige kilder

## Løsning Implementeret

### Frontend (`apps/web/src/push.js`)
- ✅ **Robust `urlBase64ToUint8Array` funktion** med:
  - Automatisk fjernelse af whitespace (`\s+`)
  - Validering af Base64 URL-safe format
  - Detaljerede fejlmeddelelser
  - Try-catch med debugging information

- ✅ **Tidlig validering** i `ensureEnvConfigured()`:
  - Tester VAPID nøglen ved app-start
  - Giver klare fejlmeddelelser før subscription

### Backend (`apps/api/api/sendPush.js` & `adminBroadcast.js`)
- ✅ **Sanitering af VAPID nøgler**:
  - Fjerner whitespace fra `process.env.VAPID_PUBLIC_KEY`
  - Fjerner whitespace fra `process.env.VAPID_PRIVATE_KEY`
  - Validerer at nøgler ikke er tomme efter sanitering

## Verificering af Miljøvariabler

### 1. Vercel Dashboard (Backend)
Gå til: https://vercel.com/[dit-projekt]/settings/environment-variables

**Tjek følgende:**
```bash
VAPID_PUBLIC_KEY=BNcRdreALWjXDPCSPHTlwoZiMw...
VAPID_PRIVATE_KEY=abcdefghijklmnopqrstuvwxyz...
```

**Vigtige punkter:**
- ❌ **Ingen** newlines (linjeskift)
- ❌ **Ingen** mellemrum før/efter nøglen
- ❌ **Ingen** quotes omkring nøglen
- ✅ Kun Base64 URL-safe tegn: `A-Z`, `a-z`, `0-9`, `-`, `_`

**Sådan retter du det:**
1. Klik på "Edit" ved siden af variablen
2. Kopier værdien til en text editor
3. Fjern **alle** newlines og mellemrum
4. Sørg for at nøglen er én sammenhængende streng
5. Gem ændringen
6. Redeploy dit Vercel projekt

### 2. Firebase Hosting (.env.local)
Filen: `apps/web/.env.local`

**Korrekt format:**
```bash
VITE_VAPID_PUBLIC_KEY=BNcRdreALWjXDPCSPHTlwoZiMw...
VITE_API_BASE=https://din-api.vercel.app
```

**Forkert format (undgå):**
```bash
# ❌ Newline i midten
VITE_VAPID_PUBLIC_KEY=BNcRdreALWjXDPCSPHTlwo
ZiMw...

# ❌ Mellemrum
VITE_VAPID_PUBLIC_KEY= BNcRdreALWjXDPCSPHTlwoZiMw...

# ❌ Quotes (ikke nødvendige i .env filer)
VITE_VAPID_PUBLIC_KEY="BNcRdreALWjXDPCSPHTlwoZiMw..."
```

### 3. Generering af Nye VAPID Nøgler (hvis nødvendigt)

Hvis dine nuværende nøgler er korrupte, generer nye:

```bash
cd apps/api
npx web-push generate-vapid-keys
```

Output:
```
=======================================
Public Key:
BNcRdreALWjXDPCSPHTlwoZiMw...

Private Key:
abcdefghijklmnopqrstuvwxyz...
=======================================
```

**Kopiér nøglerne korrekt:**
1. Markér **hele** nøglen (ikke linjeskift)
2. Kopiér til clipboard
3. Indsæt direkte i Vercel/Firebase uden mellemrum

## Test i Development

### 1. Start development server
```bash
cd apps/web
npm run dev
```

### 2. Åbn browser console
Kig efter fejl ved app-start:
```
[push] VAPID_PUBLIC_KEY validation failed: ...
```

### 3. Test push subscription
Gå til appen og prøv at aktivere notifikationer. Hvis der er encoding fejl, vil du nu få en detaljeret fejlmeddelelse.

## Test i Production

### 1. Deploy til Vercel
```bash
git add .
git commit -m "Fix VAPID key encoding issues"
git push
```

### 2. Verificer Vercel miljøvariabler
- Gå til Vercel Dashboard
- Tjek at `VAPID_PUBLIC_KEY` og `VAPID_PRIVATE_KEY` er korrekte
- Ingen skjulte tegn

### 3. Test Stress Signal
- Log ind som admin
- Gå til Admin Portal
- Send et "Stress Signal"
- Tjek browser console og Vercel logs for fejl

## Debugging Tips

### Frontend Console Fejl
```javascript
// Hvis du ser denne fejl:
"Failed to decode VAPID public key: Invalid character in string"

// Betyder det:
// - Din VITE_VAPID_PUBLIC_KEY indeholder ugyldige tegn
// - Tjek .env.local for skjulte tegn
```

### Backend Vercel Logs
```javascript
// Hvis du ser denne fejl:
"VAPID keys are empty after removing whitespace"

// Betyder det:
// - Din miljøvariabel består kun af whitespace
// - Tjek Vercel dashboard og genindtast nøglen
```

### Validering af Base64 URL-safe Format
En gyldig VAPID public key:
- Er typisk **87-88 tegn** lang
- Starter ofte med `B` (men ikke altid)
- Indeholder kun: `A-Z`, `a-z`, `0-9`, `-`, `_`
- Ingen `=` padding (URL-safe format)

## Tjekliste før Deploy

- [ ] VAPID nøgler i Vercel har ingen newlines
- [ ] VAPID nøgler i Vercel har ingen mellemrum
- [ ] VAPID nøgler i `.env.local` er korrekte
- [ ] Frontend validerer nøglen ved app-start
- [ ] Backend saniterer nøgler før brug
- [ ] Test notifikationer i development
- [ ] Test Stress Signal i production

## Yderligere Ressourcer

- [Web Push Protocol](https://developers.google.com/web/fundamentals/push-notifications)
- [VAPID Specification](https://tools.ietf.org/html/rfc8292)
- [Base64 URL-safe Encoding](https://tools.ietf.org/html/rfc4648#section-5)
