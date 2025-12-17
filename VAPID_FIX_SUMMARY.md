# VAPID Key Encoding Fix - Opsummering

## Problem Løst ✅

Fejlen **"The string did not match the expected pattern"** opstod når VAPID_PUBLIC_KEY indeholdt skjulte tegn (newlines, mellemrum, tabs) fra Vercel dashboard eller `.env` filer.

## Implementerede Rettelser

### 1. Frontend (`apps/web/src/push.js`)
- ✅ **Robust `urlBase64ToUint8Array` funktion**
  - Fjerner automatisk alle whitespace tegn
  - Validerer Base64 URL-safe format
  - Giver detaljerede fejlmeddelelser med debugging info
  
- ✅ **Tidlig validering ved app-start**
  - Tester VAPID nøglen i `ensureEnvConfigured()`
  - Fejler hurtigt med klare beskeder hvis nøglen er ugyldig

### 2. Backend (`apps/api/api/sendPush.js` & `adminBroadcast.js`)
- ✅ **Sanitering af miljøvariabler**
  - Fjerner whitespace fra `VAPID_PUBLIC_KEY`
  - Fjerner whitespace fra `VAPID_PRIVATE_KEY`
  - Validerer at nøgler ikke er tomme

### 3. Debug Tools
- ✅ **VAPID Key Validator** (`apps/web/src/utils/validateVapidKey.js`)
  - Kan bruges i browser console eller Node.js
  - Validerer nøgle format
  - Finder specifikke problemer

## Sådan Bruger Du Validator Scriptet

### I Browser Console
```javascript
// 1. Åbn browser console (F12)
// 2. Gå til din app (localhost:5173)
// 3. Kør:
const result = validateVapidKey("din-VAPID-nøgle-her")
printValidationResult(result)
```

### I Node.js / Terminal
```bash
# Fra rod-mappen
node apps/web/src/utils/validateVapidKey.js "din-VAPID-nøgle-her"
```

### Eksempel Output
```
=== VAPID KEY VALIDATION RESULT ===

⚠️  ADVARSLER:
  ⚠️  Nøgle indeholder whitespace (mellemrum, newlines, tabs)

ℹ️  INFO:
  originalLength: 90
  whitespaceCount: 2
  sanitizedLength: 88
  decodedLength: 65
  keyFormat: ✅ Korrekt P-256 uncompressed public key format
  status: ✅ Nøgle er gyldig!

✅ RESULTAT: Nøgle er gyldig og klar til brug!
```

## Næste Skridt

### 1. Verificer Vercel Miljøvariabler
1. Gå til [Vercel Dashboard](https://vercel.com) → Dit projekt → Settings → Environment Variables
2. Tjek `VAPID_PUBLIC_KEY` og `VAPID_PRIVATE_KEY`
3. Sørg for **ingen** newlines eller mellemrum
4. Redeploy hvis du ændrer noget

### 2. Verificer .env.local
```bash
# apps/web/.env.local skal se sådan ud:
VITE_VAPID_PUBLIC_KEY=BNcRdreALWjXDPCSPHTlwoZiMw...
VITE_API_BASE=https://din-api.vercel.app
```

### 3. Test i Development
```bash
cd apps/web
npm run dev
```

Åbn browser console og kig efter:
- ✅ Ingen fejl ved app-start
- ✅ Push notifications virker
- ✅ Ingen "string did not match" fejl

### 4. Test i Production
1. Deploy ændringerne:
   ```bash
   git add .
   git commit -m "Fix VAPID key encoding issues"
   git push
   ```

2. Test Stress Signal i Admin Portal
3. Tjek Vercel logs for fejl

## Hvis Problemet Fortsætter

### Generer Nye VAPID Nøgler
```bash
cd apps/api
npx web-push generate-vapid-keys
```

Kopiér output **nøjagtigt** (ingen ekstra mellemrum) til:
- Vercel Dashboard (production)
- `.env.local` (development)

### Brug Validator Scriptet
Test den nye nøgle før du deployer:
```bash
node apps/web/src/utils/validateVapidKey.js "ny-nøgle-her"
```

## Yderligere Dokumentation

Se `VAPID_TROUBLESHOOTING.md` for:
- Detaljeret fejlfinding
- Tjekliste før deploy
- Almindelige fejl og løsninger
- Base64 URL-safe encoding forklaring

## Support

Hvis du stadig oplever problemer:
1. Kør validator scriptet og gem output
2. Tjek browser console for fejl
3. Tjek Vercel logs for backend fejl
4. Verificer at både frontend og backend bruger samme VAPID key pair
