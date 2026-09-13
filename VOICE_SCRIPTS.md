# Szinkronhang Felvételi Lista

Ez a lista a `Player.say(message, durationSec, voiceClipId)` hívások mögé bekötött szinkronvonalakat
tartalmazza. A fájlokat pontosan az alábbi néven és mappában kell elhelyezni — a játék automatikusan
felismeri és lejátssza őket, amint a fizikai fájl a helyén van. Amíg egy fájl hiányzik, a játék hibamentesen
csak a feliratot (szövegbuborékot) jeleníti meg.

Formátum: `public/audio/voice/<karakter>/<clipId>.m4a` — karakterenként külön mappa (`viki/`, `kristof/`).

**Státusz: mind a 18 sor fel van véve és a helyén van (✅), verifikálva valódi lejátszással.**

## A. Nehéz Tárgy Tolása (Heavy Object Push - LEGO Puzzle)

- `public/audio/voice/viki/push_struggle.m4a` ✅
  „Öcsém, ez rohadt nehéz, gyere már segíteni!”
- `public/audio/voice/kristof/push_struggle.m4a` ✅
  „Ezt egyedül nem bírom el, segíts már tolni!”
- `public/audio/voice/viki/push_effort.m4a` és `public/audio/voice/kristof/push_effort.m4a` ✅
  Erőlködő nyögés/fújtatás közös tolás közben (2-3 mp erőkifejtés, szöveg nélkül).
- `public/audio/voice/viki/push_success.m4a` ✅
  „Meeegvan, átférünk!”
- `public/audio/voice/kristof/push_success.m4a` ✅
  „Király, szabaddá vált az út!”

## B. Relikvia (1-Relic-Per-Player Guard)

- `public/audio/voice/viki/relic_reject.m4a` ✅
  „Ezt nem tudom felvenni, ez a tiéd!”
- `public/audio/voice/kristof/relic_reject.m4a` ✅
  „Már van nálam egy, szedd fel te!”
- `public/audio/voice/viki/relic_pickup.m4a` ✅
  „Nálam a gomba, megvan az egyik!”
- `public/audio/voice/kristof/relic_pickup.m4a` ✅
  „Egy nálam van, keresd a másikat!”

## C. Bolti PIN-kód Széf (420)

- `public/audio/voice/viki/pin_correct.m4a` ✅
  „Nyílik! Mondtam, hogy ez lesz az.”
- `public/audio/voice/kristof/pin_correct.m4a` ✅
  „Négy-húsz... mi más lett volna.”
- `public/audio/voice/viki/pin_wrong.m4a` ✅
  „Rossz kód, mindjárt lebukunk!”
- `public/audio/voice/kristof/pin_wrong.m4a` ✅
  „Ez nem jó, próbáld újra!”

## D. 16m Kötélfeszülés (Tether Tension)

- `public/audio/voice/viki/tether_warn.m4a` ✅
  „Hová mész?! Ne rohanj előre!”
- `public/audio/voice/kristof/tether_warn.m4a` ✅
  „Várj meg, mindjárt elszakadunk!”

## E. Paranoia / Bámészkodók

- `public/audio/voice/viki/paranoia_high.m4a` ✅
  „Minket néznek, látod?! Viselkedj normálisan...”
- `public/audio/voice/kristof/paranoia_high.m4a` ✅
  „Ne nézz a szemükbe, menjünk tovább!”

## Technikai jegyzetek

- Minden fenti sor már be van kötve a kódba (`Player.say(...)` a megfelelő `voiceClipId`-vel), a felirat
  szövege pontosan megegyezik a fenti magyar szöveggel.
- **Formátum .m4a, nem .mp3**: az első felvett kör .m4a-ban érkezett, a `VoiceManager` ezt várja
  (`playCharacterClip` `.m4a` kiterjesztést épít az URL-be). A böngésző natívan dekódolja
  (`decodeAudioData`), nincs szükség konvertálásra. Ha egy jövőbeli sorozat mégis `.mp3`-ban
  érkezne, a `src/audio/VoiceManager.ts` `playCharacterClip` egyetlen sorát kell módosítani.
- A rendezéshez/átnevezéshez használt szkript: `scripts/organize-voice-clips.ps1` — a
  `public/audio/voice/` mappában lerakott, `clipId`/`clipId1` néven letöltött nyers fájlokat
  válogatja szét `viki/<clipId>` és `kristof/<clipId>` névre (a "1" végződésűek Kristófé).
- A `push_effort` kivétel: nincs hozzá felirat, mert nem szavakból álló erőlködő hang — közvetlenül
  `VoiceManager.playCharacterClip('viki' | 'kristof', 'push_effort')` hívja, kb. 1.4 másodpercenként,
  véletlenszerűen váltva a két karakter között, amíg mindkét játékos együtt tolja az akadályt.
- Kategóriánként van egy rövid lejátszási cooldown (`VoiceManager` `categoryCooldowns`), hogy ugyanaz a
  vonal ne szóljon egymás után túl gyakran (pl. relikvia-elutasítás ismételt próbálkozásnál).
- A Voice csatorna külön hangerő-csúszkával szabályozható a Beállítások menüben, a Zene és SFX
  csatornáktól függetlenül.
