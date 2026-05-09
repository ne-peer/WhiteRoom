Created: 2026-05-09
Last Updated: 2026-05-09

# WhiteRoom Image Effect Profile Specification

## Purpose

WhiteRoom currently saves effects as part of the full application profile. That behavior captures the most recently configured state of each cell, but it does not let a specific image carry its own preferred visual treatment.

This feature adds an image-level effect profile file named `whiteroom_effects.json` inside each local image folder. When an image is shown, WhiteRoom can automatically apply the effects saved for that image. This is intended to support random slideshows across multiple columns: once effects are saved for an image, those effects should apply wherever that image appears.

## Meeting Notes

- The feature stores effects per image, not per cell or column.
- Column state is intentionally out of scope.
- If the same image appears in multiple columns, all columns should use the same saved effect profile for that image.
- If multiple columns or user actions save different effects for the same folder/image pair, the most recently saved entry is the correct one.
- Existing app profile export/import remains a separate feature.
- The image effect profile format should be JSON that is easy to maintain.
- The saved effect payload should follow the same effect payload concept used by Storyboard rich tags.
- Image paths inside `whiteroom_effects.json` must be stored as relative paths.
- Existing entries for other images must be preserved when saving the current image.

## Final Specification

### Storage Location

For each local image folder, WhiteRoom may create or update:

```text
whiteroom_effects.json
```

The file is stored directly in the folder that contains the loaded images.

Remote URL images do not have a local folder target and cannot be saved to this system.

### Storage Scope

The profile is scoped to an image path, not to a cell.

Saved:

- Relative image path
- Effect settings for that image
- Optional metadata needed for future compatibility

Not saved:

- Cell id
- Column index
- Row index
- Grid layout
- Current slideshow state
- Selection state
- Any text reader session state

### Suggested JSON Shape

The implementation should prefer a maintainable JSON object like this:

```json
{
  "version": 1,
  "appVersion": "1.5.1",
  "updatedAt": "2026-05-09T00:00:00.000Z",
  "entries": {
    "image01.jpg": {
      "image": "image01.jpg",
      "effects": {}
    }
  }
}
```

Each entry should be compatible with the Storyboard rich tag payload concept:

```typescript
{
  image: string
  effects: Partial<CellEffects>
}
```

`progress` and `timer` are part of the Storyboard rich tag schema, but this feature only needs image and effects unless implementation later finds a clear reason to support additional fields.

### Save Behavior

The UI must add a "save effects for this image" button in the bottom-right area of the currently displayed cell, placed to the left of the left/right image navigation buttons.

Visual requirements:

- Green-based color
- Low contrast
- Small overlay style consistent with existing navigation controls
- If the folder contains only one image, show the save button alone, aligned to the bottom-right of the cell

When clicked:

1. Identify the image currently displayed in that cell.
2. If the image is a remote URL image, do not save and show an error flash message explaining that URL images cannot be saved.
3. Resolve the image path relative to the containing folder.
4. Read the existing `whiteroom_effects.json` if it exists.
5. Update only the entry for the current image.
6. Preserve entries for other images.
7. Write the full JSON file back to `whiteroom_effects.json`.
8. Show a success or failure flash message.

If the file does not exist, create it.

If the file exists, overwrite the file contents with the updated JSON document.

### Load Behavior

When a local folder is loaded into a cell, WhiteRoom should check whether `whiteroom_effects.json` exists in that folder.

If present:

1. Load and parse the file through a dedicated, maintainable file I/O path.
2. Store the folder's image effect profiles in application state or a suitable cache.
3. Whenever a cell displays an image, look up the relative image path.
4. If a matching entry exists, apply its effects to that cell.

The automatic application is triggered by image display timing, including:

- Initial folder load
- Manual previous/next navigation
- Mouse wheel navigation
- Slideshow image changes
- Reusing the same folder in multiple cells

### Conflict Rules

User edits and automatic profile application are both allowed to overwrite cell effects.

The rule is simple:

```text
The latest trigger wins.
```

Examples:

- If `applyEffectChangesToAllColumns` is enabled and the user changes an effect, that user change can overwrite effects in all columns.
- If a slideshow later advances a cell to an image with a saved effect profile, the saved image effect profile can overwrite that cell's effects.
- If the user saves new effects for the same image, that image entry replaces the previous saved entry.

### Text Reader and Storyboard Interaction

To avoid conflicts with Storyboard tags, image effect profile auto-application must be suspended when a text file is loaded into the Text Reader.

Rules:

- Suspension starts as soon as the Text Reader loads a text file.
- Suspension remains active until the text file is closed.
- During suspension, `whiteroom_effects.json` should not auto-apply effects when images change.
- Storyboard tag behavior keeps priority while the text file is open.
- WhiteRoom must show a flash message informing the user that image effect profile auto-application has been suspended while the Text Reader is active.

Manual saving from the overlay button can remain available unless implementation discovers a direct conflict, but automatic application must stay suspended.

### Remote URL Images

Remote URL images cannot be saved because there is no local image folder where `whiteroom_effects.json` can be written.

If the user clicks the save button for a URL image:

- Do not write any file.
- Show an error flash message explaining that URL images are not supported by this save feature.

### Profile Compatibility

The image effect profile file must be tolerant of older or partial data.

When applying saved effects:

- Merge loaded effects with `DEFAULT_EFFECTS`, similar to app profile import behavior.
- Missing fields should fall back to defaults.
- Unknown future fields should not crash loading.
- Invalid files should be ignored with a user-visible warning rather than breaking folder load.

### File I/O Guidance

Renderer code should not access the filesystem directly. Prefer dedicated IPC methods in the preload/main process path rather than reusing unrelated text-file APIs.

Suggested IPC responsibilities:

- Load image effect profiles for a folder.
- Save or update one image's effect profile in a folder.

The implementation should keep parsing, validation, path normalization, and write behavior centralized so both folder selection and drag-and-drop folder loading behave consistently.

## Open Implementation Notes

- Decide the exact TypeScript type names during implementation.
- Add i18n strings for success, failure, remote URL unsupported, and Text Reader suspension messages.
- Ensure the save button remains usable when a folder contains one image and navigation buttons are hidden.
- Ensure automatic effect application resets relevant effect timing so time-based effects start cleanly after image changes.
- Avoid applying image effect profiles while `cellTagOverrides` from Storyboard are actively controlling the cell.
