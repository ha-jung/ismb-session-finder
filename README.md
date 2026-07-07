# ISMB 2026 Session Finder

Static web app for searching ISMB 2026 sessions by keyword, time, track, and room.

## Features

- Keyword search with `AND` / `OR`
- Time-based session lookup
- Track and room filters
- Result sorting by relevance, time, or track
- Browser-local My Schedule
- Time conflict warnings for saved sessions

## GitHub Pages

Publish this folder from a GitHub repository using GitHub Pages.

Recommended setup:

1. Create a new public GitHub repository.
2. Upload these files to the repository root:
   - `index.html`
   - `app.js`
   - `styles.css`
   - `ISMB2026_track_title.csv`
   - `.nojekyll`
   - `README.md`
3. Go to repository `Settings` > `Pages`.
4. Set source to `Deploy from a branch`.
5. Select branch `main` and folder `/root`.
6. Save.

The public link will look like:

```text
https://YOUR_GITHUB_USERNAME.github.io/YOUR_REPOSITORY_NAME/
```
