# Deploying the ISMB Session Finder

This folder is a static website. It can be deployed without a backend.

## Recommended: GitHub Pages

1. Create a new public GitHub repository.
2. Upload these files to the repository root:

   - `index.html`
   - `app.js`
   - `styles.css`
   - `sessions.json`
   - `ISMB2026_schedule_abstracts_keywords.xlsx`
   - `.nojekyll`
   - `.gitignore`
   - `README.md`

3. Open repository `Settings` > `Pages`.
4. Under `Build and deployment`, choose `Deploy from a branch`.
5. Select branch `main` and folder `/root`.
6. Save.

Your public URL will look like:

```text
https://YOUR_GITHUB_USERNAME.github.io/YOUR_REPOSITORY_NAME/
```

## Alternative: Netlify Drop

1. Open https://app.netlify.com/drop
2. Drag the whole `ismb` folder into the page.
3. Netlify will create a public URL.
4. Share that URL with others.

Keep these files together:

- `index.html`
- `app.js`
- `styles.css`
- `sessions.json`
- `ISMB2026_schedule_abstracts_keywords.xlsx`
- `.nojekyll`
- `README.md`
- `netlify.toml`

## Local Preview

```bash
cd /home/hajung/cyp_som/ismb
python3 -m http.server 8766 --bind 127.0.0.1
```

Then open:

```text
http://127.0.0.1:8766/
```
