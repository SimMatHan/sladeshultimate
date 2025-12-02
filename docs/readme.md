# SladeshUltimate – Dev setup (Windows / VS Code)

## 1. Krav

- Node.js (LTS version) installeret
- npm følger med Node
- Git installeret
- Visual Studio Code eller anden editor

## 2. Første gang på en ny maskine / nyt IDE

Når du har clonet projektet, skal du **altid** installere pakker, fordi `node_modules` ikke ligger i Git.

```powershell
# Gå til projekt-root
cd C:\Users\SMH\SladeshUt\sladeshultimate

# (Valgfrit) installer root-pakker, hvis der er en package.json i roden
npm install

# Gå til web-appen
cd apps\web

# Installer pakker til web-appen
npm install