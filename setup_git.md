# Git Setup Commands

Etter at du har installert Git, køyr desse kommandoane i terminalen:

## 1. Konfigurer Git (første gong)
```bash
git config --global user.name "Ditt Navn"
git config --global user.email "din.email@example.com"
```

## 2. Initialiser repoet
```bash
cd c:\Users\88kjebjo\_projects
git init
```

## 3. Legg til filer og første commit
```bash
git add .
git commit -m "Første versjon - landingsside med spel og verktøy"
```

## 4. Koplar til GitHub (erstatt med din URL)
```bash
git remote add origin https://github.com/BRUKARNAVN/REPO-NAMN.git
```

## 5. Push til GitHub
```bash
git branch -M main
git push -u origin main
```

## For seinare endringar:
```bash
git add .
git commit -m "Beskriv endring"
git push
```

## Viktige merknader:
- Bytt ut "BRUKARNAVN" med ditt GitHub-brukarnamn
- Bytt ut "REPO-NAMN" med namnet på GitHub-repoet ditt
- Du må laga repoet på GitHub først (på github.com → "New repository")
