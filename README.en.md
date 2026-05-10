![GitHub Downloads (all assets, all releases)](https://img.shields.io/github/downloads/ne-peer/WhiteRoom/total?style=flat&color=FF6496)

<div>
   <h1 align="center">WhiteRoom</h1> 
   <p align="center">A multi-column image viewer that lets you apply visual effects.</p>
</div>

&nbsp;

## License

This app is free software distributed under the **MIT License**.  
Anyone can use the application features freely within the terms of that license.

### ✅ What you can do (permitted use)
This app includes no bundled assets such as images or scenario/text content. All rights to the content you prepare and use with this app belong to you.

* **Commercial use:** You may use this app as a viewer for commercial works (paid games, paid content, etc.) and distribute your work with this app included.
* **Posting on social media:** You may post or stream screenshots/videos of this app in use on social platforms (X, YouTube, etc.).
* **Personal use and modification:** You may use it for personal/hobby purposes and modify the program for your own needs.

### ⚠️ Terms and Disclaimer
* **Use at your own risk:** The author is not responsible for any trouble or damage caused by using this app (data loss/corruption, PC issues, rights disputes related to displayed content, etc.).
* **Rights for loaded assets:** Copyright and usage rights for images/text loaded in the app must be managed by the user. If any dispute arises with a third party regarding loaded assets, the author is not involved.
* **No warranty:** This app is provided "as is." Please understand that future updates, operation in specific environments, and bug fixes are not guaranteed.

## Usage

Download the latest release from:
- https://github.com/ne-peer/WhiteRoom/releases

| OS | File |
|---|---|
| Windows | `.exe` |
| macOS (Apple Silicon) | `_arm64_.dmg` |

### Notes for macOS

This app is not signed with an Apple Developer certificate, so macOS Gatekeeper may block it by default.  
For first launch, use one of the methods below.

#### Method 1: Remove the quarantine flag in Terminal

*Replace the command filename pattern as needed.*

```bash
xattr -d com.apple.quarantine ~/Downloads/WhiteRoom.for.Mac_arm64_v*.dmg
```

Then open the DMG as usual and drag the app into the Applications folder.

#### Method 2: Open via right-click

1. Right-click (or Control-click) the downloaded DMG in Finder
2. Select "Open"
3. Click "Open" again in the warning dialog

## Features

1. **Grid settings**: Set columns and rows in the right panel "Grid" tab.
2. **Assign image folders**:
    * Click a cell to select it, then click "Select Folder"
    * Or drag and drop a folder onto the canvas
3. **Slideshow**: Turn it on from the Grid tab after selecting a cell.
4. **Effects**: Configure effects in the Effects tab after selecting a cell.
    * Color Filter: Simple overlay color filter
    * Image Enhancement Filter: Emphasizes image saturation and contrast
    * Vignette Effect: Peripheral darkening effect
    * Spiral Effect: Spiral visual effect
    * Blur Effect: Blur visual effect
    * Echo Effect: Ripple-like trail effect
    * Breathing Effect: Breathing-style visual effect
    * Shake Effect: Camera/object shake effect
    * Squish Effect: Pressing/squishing visual effect
    * Text Effect: Floats custom text at random positions
    * Asset Effect: Places custom images at random positions and floats them
    * Flash Effect: Temporarily overlays an image
5. **Timer**: Enable and place it from the Timer tab.
    * **Timer-synced effect progress**: Applies effects based on remaining timer time
    * **End overlay image**: Displays a specified overlay image when the timer ends
6. **Text Reader**: Loads `.txt` files and displays text in an RPG-style reading UI.
    * **Storyboard feature**: Embed tags in text files to auto-switch images/effects while reading (details below)
7. **Appearance settings**:
    * UI language: ja/en
    * Background: Color (manual color) / Dynamic (blurred current image)
    * Fullscreen/window mode toggle
    * UI visibility toggle
8. **Profile save/load**: Save/load JSON from the Profile tab.

## Effect Save Feature

This feature saves currently displayed effects per image.  
Move the cursor near the lower-right corner of the current image to show the [Save] button.  

![img](/docs/img/RM_effects-save.png)

If settings already exist for the image, they will be overwritten. The settings file is saved as `whiteroom_effects.json` in the same folder as the displayed image.  

If effects are being applied unexpectedly, delete this file.  

## Storyboard Feature

![img](/docs/img/RM_storyboard.png)

By embedding **storyboard tags** into a `.txt` file loaded in Text Reader, you can automatically switch images and effects as pages advance.

### Tag Types

#### Simple tag (manual writing)

```
[[C:\Users\Pictures\photo.jpg]]
```

- Wrap an image path with `[[` and `]]`
- Write directly in the text file
- Switches images in all currently displayed cells (effects are unchanged)

#### Standard tag (generated by Storyboard tool)

```
[WR:1.5.0:{"image":"C:\\path\\image.jpg","effects":{...},"progress":{"enabled":true,"pages":5},"timer":{"enabled":false}}]
```

- Auto-generated by the app's Storyboard feature
- Can specify image, effects, gradual effect application, and timer auto-start in one tag

> **Shared rule**: A tag line must contain only the tag. Blank lines in text are recognized as page breaks.

### How to use the Storyboard tool

1. Open a text file from the Text tab
2. Click the "**Storyboard**" button to open the tool panel
3. Advance in Text Reader, then perform one of the actions below at the insertion point

#### "Insert Image Here"

- Saves the currently displayed **image** and **effect settings** from all cells into a tag
- You can save the value entered in the image URL/path field. If empty, the currently displayed image is used
- If "Save as relative path" is enabled, local image paths are saved relative to the loaded text file
- During playback, reaching that page automatically switches image and effects

**"Apply effects gradually" option**  
If enabled, effect intensity increases in proportion to page progress after the tag is applied.

- Effects reach 100% when the page count reaches "**Complete in N pages**"
- Uses the same mechanism as timer-synced effect progression

#### "Insert Timer Here"

- Inserts a tag that includes timer auto-start instructions in addition to current image/effect settings
- During playback, reaching that page resets and starts the timer automatically
- While timer is running, "Auto (auto page turn)" pauses temporarily and resumes after timer completion

#### "Save Reading Settings"

- Saves the following settings at the moment the button is pressed to the top of the file:
  - Window size
  - Text window display settings (position, width, direction, overlay-on-image, etc.)
  - Font settings (font, font size, background opacity)
  - Speed settings (text speed, page advance speed)
  - UI show/hide state
- The next time this file is opened, all these settings are automatically restored
- Settings are stored as a `[WR-RC:...]` tag on the first line of the file (updated if already present)
- After saving, click "Save File" to write the text file with the new tag

#### "Save File"

- Saves current edits (including inserted tags) as a new file
- Filename: `{original-filename}_WhiteRoom_{yyyymmdd-hhmmss}.txt`

### Image URL support and network limits

Storyboard tag images can use local paths, text-file-relative paths, `file://`, `data:`, and `http(s)://` image URLs.

- When the same URL is displayed in multiple cells at once, only one network request is sent
- URLs already fetched are cached during the current app session, so repeated switches do not re-fetch
- If a web page URL is specified, the app tries to detect a meta image in that page and display it
- For pixiv-family domains, to reduce load, distinct image/page URLs are limited to 10 per app session
- The 11th and later pixiv-family URLs are blocked before loading, with a warning shown at the bottom
- This limit and count reset when WhiteRoom is restarted
- You can check the current count in `pixiv requests: n/10` at the bottom of the Text tab

### Behavior when going back pages

If you move back to previous pages, the app automatically restores the pre-tag state (snapshot taken when file was loaded).

---

## Setup (for developers)

### Requirements

- **Node.js** v18 or later (recommended: v22)
- **npm** v9 or later
- **Windows 11** / macOS / Linux

## Tech Stack

- **Electron** v30 - cross-platform desktop app
- **React** v18 + **TypeScript** - UI
- **PixiJS** v8 - WebGL rendering engine
- **Zustand** + immer - state management
- **GSAP** - animation control
- **electron-vite** - build tooling

### Install

```bash
# Move to project folder
cd C:\develop\WhiteRoom

# Install dependencies
npm install
```

### Run in development

```bash
npm run dev
```

### Build (for distribution)

```bash
# Build Windows installer
npm run build
npm run package
```

Output: `release/` folder

---

## Directory Structure

```
src/
├── main/           # Electron main process
│   └── index.ts    # File I/O, dialogs, IPC
├── preload/        # IPC bridge
│   └── index.ts
├── shared/         # Shared type definitions (main/renderer)
│   └── types.ts
└── renderer/       # React + PixiJS frontend
    ├── index.html
    ├── App.tsx
    ├── main.tsx
    ├── appInfo.ts
    ├── i18n.ts
    ├── global.css
    ├── css.d.ts
    ├── globals.d.ts
    ├── window.d.ts
    ├── stores/
    │   └── appStore.ts       # Zustand global state
    ├── hooks/
    │   ├── usePixiStage.ts   # PixiJS app initialization
    │   ├── useDropHandler.ts # Drag & drop handling
    │   └── useTimer.ts       # Timer
    ├── utils/
    │   ├── CellRenderer.ts   # Per-cell rendering class
    │   └── pixiEffects.ts    # Effect utilities
    └── components/
        ├── layout/
        │   ├── MasterCanvas          # PixiJS canvas host
        │   ├── TopBar                # Top toolbar
        │   └── CellNavigationOverlay # Cell navigation overlay
        ├── controls/
        │   ├── ControlPanel  # Right-side panel
        │   ├── GridControls  # Grid/cell operations
        │   ├── UIKit         # Shared UI components
        │   ├── AppearanceControls
        │   └── ProfileControls
        ├── effects/
        │   └── EffectsPanel  # Effect settings
        ├── reader/
        │   ├── TextReaderPanel   # Text file controls panel
        │   ├── TextReaderWindow  # Text display window
        │   └── StoryboardPanel   # Storyboard editor panel
        └── timer/
            ├── TimerOverlay         # Timer display
            ├── TimerControls        # Timer settings
            ├── TimerPreOverlay      # Pre-timer overlay
            └── TimerEndFlashOverlay # End flash overlay
```
