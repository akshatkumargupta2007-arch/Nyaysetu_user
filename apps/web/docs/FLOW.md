# CIPHER – screen flow

17 screens, all designed at 390 x 844 (phone). Routes are in `src/routes.js`.
"Back" always means the round arrow top-left.

## Main journey

```
/ Language ──► /voice AI voice ──► /home Home
                                     │
              ┌──────────────────────┼───────────────┬──────────────┐
              ▼ Speak                ▼ Photo         ▼ Write        ▼ My problems
           /speak                 /photo          (text box        /problems
              │ OK                   │ photo added   opens on Home)    │
              └───────────┬──────────┘ (auto, 0.9 s)  │ OK             │ tap a card
                          ▼                           │                ▼
                       /where ◄───────────────────────┘        see "Looking at problems"
                          │ OK
                          ▼
                        /send ──Send──► /phone ──OK──► /code ──OK──► /sent
                                                                       │
                                                  My problems ─────────┤──── Home
                                                         ▼                    ▼
                                                     /problems             /home
```

## Looking at problems

```
/problems  (tabs: Waiting · Fixed · Needs fix)
   ├─ Waiting card    ──► /status        (map, "Team arrives", 5 steps, timed rows, Call Team)
   ├─ Fixed card      ──► /fixed         (Is it fixed?  Yes ► /home   No ► /sent)
   └─ Needs-fix card  ──► /needs-fix     (Fix ► /send)
```

## Screens that the backend will trigger (not linked from the prototype)

| Route | Screen | Shown when | Buttons |
|---|---|---|---|
| `/photo-rejected` | Use a real photo | the photo is flagged (AI-made, edited, wrong place) | Photo ► `/photo`, Call us |
| `/needs-fix` | Needs a fix | a complaint is flagged (e.g. photo/place mismatch) | Fix ► `/send`, Call us |
| `/not-sent` | Not sent | sending failed / no internet | Again ► `/send`, Call us |

## Every screen, every tap

| Route | Screen | Taps |
|---|---|---|
| `/` | Language | any language ► `/voice` (also saves the language code) |
| `/voice` | AI voice | one **On/Off switch** (green = On, red = Off; slides when tapped) · **OK** ► `/home`; back ► `/` |
| `/home` | Home | **Speak** ► `/speak` · **Photo** ► `/photo` · **Write** opens the text box (OK ► `/where`, arrow closes it) · **My problems** ► `/problems` · footer **Privacy** ► `/privacy`, **Call us** (placeholder `#call`) |
| `/speak` | Speak now | OK ► `/where` · tap the mic to replay the typing · back ► `/home` |
| `/photo` | Take a photo | camera tile / Gallery ► picks a photo, shows "Photo added", then `/where` (also the **OK** button) · back ► `/home` |
| `/where` | Where is it? | address box + **Speak** · **I am here** (drops the pin) · **OK** ► `/send` · back ► `/home` |
| `/send` | Send? | photo ► `/photo` · **AI text** (what the AI understood, in the chosen language) ► `/speak` · address ► `/where` · **Send** ► `/phone` · back ► `/where` |
| `/phone` | Phone | Phone number only · **OK** ► `/code` · back ► `/send` |
| `/code` | Code | 6 boxes (auto-advance) · **OK** ► `/sent` · **Again** (placeholder) · back ► `/phone` |
| `/sent` | Sent! | **My problems** ► `/problems` · **Home** ► `/home` |
| `/problems` | My problems | tabs · cards ► `/status`, `/fixed`, `/needs-fix` · back ► `/home` |
| `/status` | Status | **Call Team** (placeholder) · back ► `/problems` |
| `/fixed` | Is it fixed? | **Yes** ► `/home` · **No** ► `/sent` (faces animate, then navigate) |
| `/needs-fix` | Needs a fix | **Fix** ► `/send` · **Call us** · back ► `/problems` |
| `/photo-rejected` | Use a real photo | **Photo** ► `/photo` · **Call us** · back ► `/photo` |
| `/not-sent` | Not sent | **Again** ► `/send` · **Call us** · back ► `/send` |
| `/privacy` | Privacy | **OK** ► `/home` · back ► `/home` |

Every screen also has a **Listen** pill (replays the voice). Screens read themselves aloud when
they open if the person chose **On** on `/voice`.

## Data kept for the visit (browser storage)

| Key | Storage | Value |
|---|---|---|
| `cipher.voice` | sessionStorage | `on` / `off` (default on) |
| `cipher.lang` | localStorage | language code chosen on `/` |
| `cipher.photo` | sessionStorage | the photo (resized JPEG data URL) |
| `cipher.address` | sessionStorage | the address text |
