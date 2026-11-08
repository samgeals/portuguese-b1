# Portuguese A1 → B1

A small, no-build web app for a self-directed European Portuguese plan: 18 learning blocks from A1 to B1, real-life phrases, flashcards and a study-hours log.

## Run it

On a Mac, double-click `start.command` (or run `./start.command` in Terminal). It starts a local server and opens http://localhost:8000. Press Ctrl+C in that window to stop.

The app loads its data with `fetch`, so serve the folder over HTTP rather than opening `index.html` directly:

```bash
python3 server.py        # app + Mac voices for audio
# or, without audio from the Mac voices:
python3 -m http.server 8000
```

Then open http://localhost:8000.

## On your phone

The app is also an installable, offline web app (a PWA). Host the folder anywhere with https (GitHub Pages is free), open it on the phone and add it to the home screen:

- **iPhone (Safari):** Share button → **Add to Home Screen**.
- **Android (Chrome):** ⋮ menu → **Add to Home screen** / **Install app**.

It then opens full screen like an app and works without a connection (`sw.js` keeps a copy). After you change a file, bump `VERSION` in `sw.js`; the phone picks up changes the second time you open the app. Audio uses the phone's own voices: on iPhone add Joana under Settings → Accessibility → Spoken Content → Voices → Portuguese. Progress is saved per device, so use **Study log → Export progress / Import progress** to move it between the Mac and the phone.

## What's inside

| Path | What it is |
| --- | --- |
| `data/plan.json` | Stages (A1, A2, B1), blocks (grammar, vocab, real-life task), milestones, pronunciation, routine, resources, situations |
| `data/phrases.json` | Phrases tagged by topic and level |
| `data/messages.json` | Real-life texts for the Messages tab: lines with English, key words, ready-made replies |
| `index.html`, `styles.css`, `app.js` | The app: Plan, Phrases, Flashcards, Study log, Situations |
| `scripts/to-anki-csv.mjs` | Exports the phrases as an Anki CSV |
| `manifest.webmanifest`, `sw.js`, `icons/` | Phone install and offline support |

## Flashcards

Flashcards use spaced repetition (Leitner boxes). Each session shows the cards that are due plus up to 10 new ones. **Got it** moves a card up a box, and it comes back after 1, 3, 7, 14 and then 30 days; after the 30-day box it counts as known. **Again** sends it back to the start and shows it again in the same session. Keys: Space shows the answer, 1 is Again, 2 is Got it. Filter by topic or level (A1, A2, B1).

## Step-by-step weeks

A block in `data/plan.json` can have a `steps` field: days, each with small tasks (text, minutes, and optional Portuguese phrases to play). They show as tickable checklists under the block on the Plan tab. "Hello & me" has Week 1 broken down this way; copy the shape to break down other blocks.

## Audio

Every phrase, flashcard and pronunciation example has a 🔊 button. When the app is started with `start.command` (which runs `server.py`), the audio comes from your Mac's own voices through the `say` command, so it works the same in every browser, Firefox included. Without the server it falls back to the browser's text-to-speech, using a European Portuguese (pt-PT) voice when one is installed and staying silent rather than reading Portuguese with an English voice. On a Mac, Joana or Catarina are pt-PT voices: add them in System Settings → Accessibility → Spoken Content → System voice → Manage Voices. Tick **Slow audio** at the top for a slower pace. In Flashcards, **Play automatically** reads each card as it appears, and P plays it.

## Progress

Study time is logged automatically: a timer runs while you actively use Flashcards or Phrases (it pauses after 90 seconds without input), and ticking a week-plan step logs its minutes. You can still add study done away from the app by hand. Ticks, known phrases and the study log are saved in your browser (`localStorage`). Use **Study log → Export progress** to back up or move to another device, and **Import progress** to restore.

## Anki export

```bash
node scripts/to-anki-csv.mjs > anki-phrases.csv
```

In Anki: File → Import → choose `anki-phrases.csv`. Tags carry the topic and level.

## Editing the plan

Everything is data. Add a phrase to `data/phrases.json` or a block to `data/plan.json` and reload — no code changes needed.

## Ideas for next steps

- Recorded audio (e.g. your tutor) in place of text-to-speech
- Sync progress with the Notion Study Log
