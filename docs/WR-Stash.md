Created: 2026-05-12
Last Updated: 2026-05-12 (rev 2)

# WhiteRoom Stash Specification

## Purpose

The Stash feature lets the user temporarily save the current application state, reset the app to a blank slate, and later restore any saved state with a single action. Up to 15 stash slots are maintained in memory and can be exported/imported with the normal application profile.

---

## Save Target (保存対象A)

A stash captures the following state at save time:

| Field | Type | Description |
|---|---|---|
| `blankColor` | `BlankColor` | Background fill color |
| `blankBackground` | `BlankBackground` | Background mode and dynamic blur setting |
| `grid` | `GridLayout` | Column/row counts |
| `cells` | `Cell[]` | All cell data including folders, effects, and slideshow settings |
| `timer` | `TimerConfig` | Full timer configuration |
| `textReaderConfig` | `TextReaderConfig` | Text reader display/font settings |
| `textReaderFilePath` | `string \| null` | Path of the currently open text file (for re-opening on POP) |
| `textReaderPageIndex` | `number` | Current page index in the text reader |

The following are **not** saved in a stash: `fullscreen`, `showControls`, `windowSize`, `language`, `imageEffectProfiles`.

---

## StashItem Type

Each saved stash is represented by a `StashItem`:

```typescript
type StashItem = {
  id: string                  // UUID
  emoji: string               // Random food emoji label (see emoji list)
  color: string               // Random hex accent color
  savedAt: string             // ISO datetime
  blankColor: BlankColor
  blankBackground?: BlankBackground
  grid: GridLayout
  cells: Cell[]
  timer: TimerConfig
  textReaderConfig: TextReaderConfig
  textReaderFilePath: string | null
  textReaderPageIndex: number
}
```

---

## UI

### Entry Point

The stash window is opened via:

- **Hamburger menu** (bottom-left, replaces the former fullscreen/UI-hide buttons): the menu shows スタッシュ at the top, followed by フルスクリーン切り替え and UI非表示切り替え.
- **Keyboard shortcut `[s]`**: opens the stash window from anywhere (same `isEditable` guard as other shortcuts).

### Stash Window

A draggable float window, styled similar to the Storyboard panel.

- `data-stash-window` attribute is applied to both the window and the collapsed icon so hover-based suppression (floating controls, wheel scroll) works correctly.
- Background is slightly transparent (`rgba` with `backdrop-filter: blur`).
- When the mouse moves further than **100 px** from the window boundary, the window automatically collapses to a small icon.
- The drag position resets to the default top-left position when the window re-expands.

#### Collapsed Icon

- Position: **fixed top-left** (`left: 8px; top: 8px`), not draggable.
- Color: yellow-based (`rgba(245, 158, 11, ...)` border and background).
- After **3 seconds** of being collapsed, the icon fades to near-invisible opacity (`0.13`). Hovering restores full opacity instantly.
- **Hovering** the icon re-expands the window (no click required).

### Stash Row Layout

Each row follows the structure:

```
[label button]  [×]
```

- **Minimum rows displayed**: 3.
- **Maximum stash count**: 15.
- **Panel width**: 180 px.

#### Label Button (empty state)

- Default text: `空のスタッシュ`
- On hover: text changes to `スタッシュする`
- On click: saves current state to this slot (see Save Behavior below)

#### Label Button (filled state)

- Text: `{emoji} スタッシュ` (e.g., `🍉 スタッシュ`)
- Text color, border color: the stash's accent color
- Left border of the row: the stash's accent color
- On hover: text changes to `取り出す` (blue highlight)
- **Long press (0.4 s)**: restores state without confirmation dialog; a horizontal progress bar animates inside the button during the hold. Releasing before 0.4 s cancels the action.
- After pop: if `textReaderFilePath` is non-null, attempts to reopen the file via `api.openTextFileDirect(path)` and restores `textReaderPageIndex`.

#### × (Delete) Button

- Disabled when the slot is empty.
- Tooltip: `長押しで削除`
- **Long press (0.4 s)**: deletes the stash without confirmation dialog; a circular SVG progress ring animates inside the button during the hold. Releasing before 0.4 s cancels the action.
- Rows compact upward after deletion.
- Rows added by the [+] button (beyond the minimum 3) are removed when their slot becomes empty due to deletion.
- Deleting a slot does not reduce displayed rows below 3.

### [+] Button

- Displayed below the last row, center-aligned.
- Adds one empty slot.
- Hidden when slot count reaches 15.
- **Disabled** while any slot in the current view is empty (i.e., `stashes.length < stashSlotCount`). Tooltip explains the condition.

---

## Behaviors

### Save (スタッシュする)

1. Capture the current state snapshot (outside immer `set()` to avoid proxy issues).
2. Assign a random food emoji from `STASH_FOOD_EMOJIS` and a random hex color from `STASH_ACCENT_COLORS`.
3. Write the `StashItem` into `stashes[index]`.
4. Immediately call `resetProfile()` — no confirmation dialog.

### POP (設定を復元)

Triggered by **0.4 s long press** on the label button of a filled slot. No confirmation dialog is shown.

1. Restore state via `popStash(index)`:
   - `blankColor`, `blankBackground`, `grid`, `cells`, `timer` are fully restored (with the same defaults-merge pattern used by `importProfile`).
   - `textReader.config` is restored (merged with `DEFAULT_TEXT_READER_CONFIG`).
2. If `textReaderFilePath` is non-null, call `api.openTextFileDirect(path)` and load the file via `store.loadTextReaderFile`. If the file no longer exists, silently skip.
3. The stash slot **remains** in the list after POP (it is not consumed).

### Delete (スタッシュを削除)

Triggered by **0.4 s long press** on the × button of a filled slot. No confirmation dialog is shown.

1. Call `deleteStash(index)`.
2. Stash entries above the deleted slot shift down to fill the gap.
3. `stashSlotCount` is adjusted: if remaining stashes ≥ 3, slot count = stash count; otherwise slot count stays at 3.

---

## Emoji and Color Lists

Emoji and color lists are defined as exported constants in `src/renderer/stores/appStore.ts`:

- **`STASH_FOOD_EMOJIS`**: ~40 food-group emoji (🍎 🍊 🍋 🍇 🍓 🫐 🍉 🍑 🍒 🍌 🥝 🍍 🥭 🍏 🍐 🍈 🥥 🥑 🍆 🥦 🥕 🌽 🍕 🍔 🌮 🍜 🍣 🍰 🍩 🍪 🎂 🍫 🍬 🍭 🧁 🍦 🥧 🧆 🍱 🍛)
- **`STASH_ACCENT_COLORS`**: 15 hex colors chosen for visual variety
- **`STASH_MAX_COUNT`** = 15
- **`STASH_MIN_SLOT_COUNT`** = 3

---

## State (Zustand store)

Three fields are added to `AppState`:

| Field | Type | Default | Description |
|---|---|---|---|
| `stashes` | `StashItem[]` | `[]` | Saved stash entries |
| `stashSlotCount` | `number` | `3` | Number of rows displayed in the window |
| `stashWindowOpen` | `boolean` | `false` | Signal to open the stash window |

Actions:

| Action | Description |
|---|---|
| `saveStash(index)` | Save current state to slot; call `resetProfile()` |
| `popStash(index)` | Restore state from slot (slot is kept) |
| `deleteStash(index)` | Remove slot; compact rows |
| `addStashSlot()` | Increment `stashSlotCount` (max 15) |
| `setStashWindowOpen(open)` | Open/close signal consumed by `StashWindow` |

---

## Profile Compatibility

- `AppProfile` gains an optional `stashes?: StashItem[]` field.
- Profiles with stashes use `version: '1.1.0'`; profiles without use `'1.0.0'`.
- Old profiles (no `stashes` field) load correctly — stashes default to `[]`.
- Old app versions reading a new profile will ignore the unknown `stashes` field.
- On import, `stashes` **overwrites** the current stash list.
- `serializeAppProfile` / `resolveAppProfile` in `src/main/index.ts` apply `mapEffectsAssetReferences` to each stash cell's effects (same as main profile cells) so dynamic asset paths are correctly relativized/resolved.

---

## App Close Guard

When the user attempts to close the app while stash slots contain saved data, a native dialog is shown:

> 「スタッシュに設定が残っています。終了しますか？」
> Buttons: **終了する** / **キャンセル**

Implementation: `win.on('close', ...)` in `src/main/index.ts` calls `win.webContents.executeJavaScript('window.__whiteroom_hasStash?.()')`. The renderer sets `window.__whiteroom_hasStash` via a `useEffect` in `StashWindow` that re-registers whenever `stashes` changes.

---

## File Map

| File | Role |
|---|---|
| `src/shared/types.ts` | `StashItem` type; `AppProfile.stashes`; `IpcApi.checkHasStash` |
| `src/renderer/stores/appStore.ts` | State, actions, emoji/color constants |
| `src/renderer/components/stash/StashWindow.tsx` | Float window UI component |
| `src/renderer/components/stash/StashWindow.module.css` | Styles |
| `src/renderer/components/layout/TopBar.tsx` | Hamburger menu (replaces 2-button dock) |
| `src/renderer/components/layout/TopBar.module.css` | Styles |
| `src/renderer/components/layout/MasterCanvas.tsx` | `[s]` shortcut; wheel suppression |
| `src/renderer/App.tsx` | `<StashWindow />` mount; hover suppression |
| `src/renderer/i18n.ts` | Stash-related translation keys |
| `src/main/index.ts` | Close guard; `mapEffectsAssetReferences` for stash cells |
| `src/preload/index.ts` | `checkHasStash` IPC binding |
