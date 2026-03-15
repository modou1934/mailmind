# MailMind Private

MailMind ora gira su stack privato locale.

## Stack attuale

- frontend React + Vite
- backend privato locale in `server/`
- database SQLite locale in `server/data/`
- storage locale per upload in `server/data/objects/`
- sessioni cookie-based
- integrazioni OAuth Google/Microsoft gestite dal backend privato

## Avvio locale

1. Compila `./.env`
2. Avvia il backend:

```bash
npm run dev:server
```

3. Avvia il frontend in un secondo terminale:

```bash
npm run dev
```

Il frontend usa il proxy Vite verso `/api`, quindi in sviluppo si appoggia al server privato in `http://localhost:8787`.

## Infra locale per il passo successivo

Per avviare `Postgres` e `MinIO` in locale:

```bash
npm run infra:up
```

Per bootstrap dello schema e migrazione dei dati correnti da SQLite a Postgres:

```bash
npm run db:bootstrap:postgres
npm run db:verify:postgres
```

L'entrypoint SQL usato dal bootstrap e in `postgres/001_init.sql`.

## File principali

- `server/index.js`: API privata locale
- `server/db.js`: schema SQLite e seed iniziale
- `server/storage.js`: storage locale per upload e artefatti
- `server/oauth.js`: start/callback OAuth
- `server/transcription.js`: speech-to-text Deepgram
- `scripts/migrate-to-postgres.mjs`: copia dati da SQLite a Postgres
- `src/api/privateApiClient.js`: client frontend verso API private
- `PLAN.md`: piano backend completo

## Credenziali

Le variabili ambiente stanno in:

- `./.env`

Le chiavi sensibili non sono nel repo. Se mancano le credenziali OAuth, le integrazioni restano disabilitate ma il progetto continua a partire in modalita privata locale.
