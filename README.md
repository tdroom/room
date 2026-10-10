# Toscana Diagnostica · Room Planning

Webapp per la pianificazione, programmazione e controllo degli ambulatori delle strutture sanitarie del network Toscana Diagnostica. Evoluzione della versione "artifact" su claude.ai: stesso motore di pianificazione e stessa interfaccia di sede, ora con accesso Microsoft 365, utenti e ruoli, salvataggio automatico su database PostgreSQL con cronologia e backup, cestino e cruscotto di tutte le sedi.

## Cosa fa

Per ogni sede (ordinate in automatico in ordine alfabetico): anagrafica (denominazione, nome breve, site manager, logo, orari, parametri del desk di accettazione), ambulatori (mq, WC, specialità, attrezzature, disponibilità, fasce Punto Prelievi, riserva ai medici vincolati), personale (medici con disponibilità, attrezzature richieste, ambulatorio preferenziale/obbligatorio, "sempre nello stesso ambulatorio"; sanitari con profilo e competenze; accettazione con ore contratto, turnazione A/B), planimetria PDF con marcatori, e "Pianificazione e controllo": copertura desk, assegnazione medici → ambulatori, spazi liberi, criticità e ottimizzazioni, filtro per medico, export XLSX e PDF (per ambulatorio, per medico, spazi liberi).

Cruscotto: tutte le sedi con ambulatori, medici, sessioni settimanali, utilizzo, ore libere, criticità, ultimo salvataggio e autore; banner per le sedi oltre la soglia di criticità; report consolidato per la direzione in PDF ed Excel (sedi, utilizzo per ambulatorio, criticità, specialisti, spazi liberi, sessioni).

## Funzioni di rete (v1.1)

- Specialisti (prima voce del menu): medici e professionisti sanitari di tutte le sedi, riconosciuti per nome anche se censiti in più sedi, con l'agenda settimanale unificata (sessioni da titolare, supporto sanitario, disponibilità non allocate). Email dello specialista modificabile da qui (si salva nelle schede di sede). PDF dell'agenda e invio via email con allegato.
- Simulatore di proposta: inserite le fasce di disponibilità aggiuntiva dello specialista, il sistema cerca in tutte le sedi gli ambulatori liberi compatibili con disciplina e attrezzature richieste (escludendo gli ambulatori riservati ai medici vincolati e le fasce già occupate dallo specialista altrove) e propone gli spazi, per sede e giorno, senza mai toccare attività già pianificate. PDF della proposta e invio via email.
- Calendario reale: la settimana-tipo applicata alle date, con assenze (con sostituto, suggerito tra i medici della stessa disciplina liberi nella fascia), chiusure di sede e sessioni extra. Filtri per sede e per specialista, PDF della settimana.
- Confronto versioni: nella cronologia di una sede si scelgono due versioni (A e B) e si vedono le differenze voce per voce (anagrafica, orari, ambulatori, personale).
- Avvisi automatici: ogni giorno all'ora impostata il server ricalcola le criticità e, per le sedi con criticità alte oltre soglia, invia una email agli amministratori e all'email della sede (soglia, ora e attivazione in Impostazioni; registro email con esito).

Invio email: Microsoft Graph con la stessa registrazione app del login (permesso applicativo `Mail.Send` con consenso amministratore, casella mittente `GRAPH_SENDER`; limitare l'app alla sola casella con una Application Access Policy come per Cash Management). Senza configurazione le comunicazioni vengono comunque registrate e i PDF restano scaricabili.

Salvataggio: automatico 1,5 secondi dopo ogni modifica (Ctrl+S forza). Ogni salvataggio crea una versione in cronologia (ripristinabile). Controllo di concorrenza: se due persone salvano la stessa sede, la seconda riceve l'avviso e ricarica la versione più recente; chi ha una sede aperta vede le modifiche dei colleghi entro 30 secondi. Eliminazione nel cestino (ripristinabile dall'amministratore), backup JSON completo e importazione (anche dei file della versione precedente).

## Profili

- Amministratore: tutto, più utenti, backup e cestino, registro attività.
- Pianificatore: modifica le sedi (tutte, oppure solo quelle assegnate).
- Consultazione: vede e scarica PDF/Excel, non modifica.

Accesso con Microsoft 365 (Entra ID): chi ha un account del tenant Toscana Diagnostica entra e viene registrato da solo al primo accesso con profilo Consultazione (`ENTRA_AUTO_ROLE`, domini in `ENTRA_ALLOWED_DOMAINS`); l'amministratore lo promuove da Utenti. Collaboratori esterni: email e password, con verifica in due passaggi obbligatoria per gli amministratori locali.

## Architettura

- server/: Node.js 22, Express, PostgreSQL 16. Sessioni su database, CSRF (header `X-Requested-With: td-room`), rate limit sul login, audit log. Le sedi sono documenti JSONB (stesso modello dati della versione precedente) con i binari (logo, planimetria PDF e immagine) in tabella separata e cronologia per sede (max 500 versioni).
- web/: React 18, Vite. Il motore di pianificazione e l'interfaccia di sede (`web/src/planner/planner.jsx`) sono il codice della versione artifact, portato senza modifiche funzionali; CSS originale scopato sotto `.rp`.
- shared/engine.js: motore di pianificazione condiviso tra frontend e server (il server lo usa per gli avvisi).
- Docker: immagine unica (build Vite + server). `render.yaml` per Render (Blueprint), `docker-compose.yml` per VPS con Caddy (HTTPS automatico) e backup giornaliero del database.

## Dati iniziali

`server/src/seed/roomplanning_seed.json` contiene le 7 sedi esportate dall'artifact il 10/10/2026 (ultimo salvataggio 09/10/2026 14:07 UTC): al primo avvio, se il database è vuoto, vengono importate con una versione "migrazione" in cronologia. Dopo il primo avvio il file non viene più letto (`SEED_INITIAL_DATA=false` lo disattiva del tutto). Per riallineare i dati in un secondo momento: Backup e cestino → Importa da backup.

## Deploy su Render (procedura)

1. GitHub: crea il repository `tdroom/td-room-planning` (privato) e carica il contenuto di questa cartella (`git init && git add -A && git commit -m "Room Planning v1" && git branch -M main && git remote add origin … && git push -u origin main`).
2. Render: New > Blueprint > collega il repository. Il file render.yaml crea il database `td-room-db` (Basic 256 MB, Francoforte) e il servizio web `td-room` (Starter, Docker).
3. Nel pannello del servizio, Environment: inserisci `SEED_SUPERADMIN_PASSWORD` (min 12 caratteri, password di emergenza del primo amministratore) e, appena disponibili, `ENTRA_TENANT_ID`, `ENTRA_CLIENT_ID`, `ENTRA_CLIENT_SECRET`.
4. Primo avvio: migrazioni, amministratore, importazione delle 7 sedi. L'app risponde su https://td-room.onrender.com (controlla `/api/health`).
5. Dominio ufficiale (es. room.toscanadiagnostica.it): Settings > Custom Domains su Render, record CNAME sul DNS, poi aggiorna `BASE_URL` in render.yaml (o nel pannello) e il redirect URI in Entra. Da quel momento ogni altro host viene reindirizzato al dominio ufficiale.

Costi indicativi: Starter ~7 $/mese + database Basic ~6 $/mese (verificare i listini). Il piano free fa dormire l'app e cancella il database dopo 30 giorni: solo per prove.

## Microsoft 365: registrazione app in Entra ID

1. Microsoft Entra ID > App registrations > New registration: nome "TD Room Planning", single tenant, piattaforma Web, redirect URI `https://td-room.onrender.com/api/auth/entra/callback` (aggiungere poi quello del dominio ufficiale).
2. Certificates & secrets > New client secret (24 mesi): copiare subito il valore.
3. Token configuration > Add optional claim > ID token > `email`.
4. Overview: Directory (tenant) ID e Application (client) ID → variabili `ENTRA_TENANT_ID`, `ENTRA_CLIENT_ID`, `ENTRA_CLIENT_SECRET` su Render. Riavviare.
5. Nessun censimento preventivo: chi entra con un account @toscanadiagnostica.it viene registrato come Consultazione; promuovere i pianificatori da Utenti. Per limitare l'accesso ai soli censiti: `ENTRA_AUTO_ROLE=` (vuoto).

## Sviluppo locale

```bash
docker run -d --name rpdb -p 5432:5432 -e POSTGRES_PASSWORD=dev -e POSTGRES_DB=roomplanning postgres:16-alpine
cd server && npm install
DATABASE_URL=postgres://postgres:dev@localhost:5432/roomplanning SEED_SUPERADMIN_EMAIL=tu@esempio.it SEED_SUPERADMIN_PASSWORD=Password-Temporanea-1 REQUIRE_TOTP_FOR_ADMINS=false npm start
cd web && npm install && npm run dev      # http://localhost:5173, proxy API su :3000
cd server && npm test                       # test API end-to-end (server avviato)
```

## API (tutte sotto /api, sessione via cookie)

- auth: config, login, totp, logout, me, change-password, totp/setup, totp/enable, entra/login, entra/callback
- strutture: GET (elenco alfabetico, `?deleted=1` cestino), GET /:id, GET /:id/blob/:kind, POST, PUT /:id (con `version`, risponde 409 `VERSION_CONFLICT`), DELETE /:id (cestino; `?confirm=DEFINITIVO` dal cestino), POST /:id/restore, GET /:id/history, GET /:id/history/:hid, POST /:id/history/:hid/restore
- calendario/eventi (GET `?dal&al`, POST, PUT /:id, DELETE /:id) · comms/status, comms/invia (allegato PDF base64), comms/log · criticita (GET), criticita/invia (POST, admin)
- users (CRUD, reset-password, reset-totp), settings (GET, PUT soglia/ora/avvisi), backup (GET, `?trash=1`), backup/import (`mode` merge|replace), audit

## Backup e ripristino

- Dall'app: Backup e cestino → Scarica backup (JSON completo, stesso formato della versione precedente). Conservarne una copia in OneDrive.
- Render: backup automatici del database inclusi nel piano Basic; export manuale da Dashboard > database > Backups.
- Docker Compose: dump giornaliero in ./backup (30 giorni). Ripristino: `docker compose exec -T db pg_restore -U roomplanning -d roomplanning --clean /backup/<file>.dump`.
