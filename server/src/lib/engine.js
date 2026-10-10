// Motore di pianificazione condiviso con il frontend (shared/engine.js). In Docker è in /app/shared, in sviluppo nella radice del repository.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const candidates = [path.join(here, '..', '..', 'shared', 'engine.js'), path.join(here, '..', '..', '..', 'shared', 'engine.js')];
const file = candidates.find((f) => fs.existsSync(f));
if (!file) throw new Error('shared/engine.js non trovato');
const engine = await import(pathToFileURL(file).href);
export const { computePlan, DAYS, DAYS_S, medDisc, medDiscTxt, rangesM, intersectM, subtractM, sumM, t2m, m2t, durTxt, roomExclusive, isPrelievi } = engine;
export default engine;
