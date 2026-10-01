# Walking Character Comparison

Make height-comparison videos: one **main character** keeps walking on the spot while **other characters walk in one by one**, each drawn to true relative height with a name plate above their head. Export the result as an **HD / Full HD / 2K / 4K MP4**.

Everything runs in your browser. Your images are never uploaded anywhere.

## Use it

1. Open the page (GitHub Pages link, or just open `index.html` in Chrome, Edge or Safari).
2. **Main character**: type a name, a height and optional details (country, team...). Upload up to 12 walking frames.
3. **Other characters**: press *+ Add another character* and repeat. They enter in the order listed; use *Move earlier / later* to reorder.
4. Press play to preview. Adjust the scene on the left (background, walking pace, how long each character stands beside the main one, and so on).
5. Pick a resolution and frame rate, then press **Export MP4**.

Until you upload frames, a placeholder stick figure walks so you can see how it works straight away.

### Heights

Type them any way you like: `187`, `187 cm`, `1.87 m`, `6'1.6`, `6 ft 1 in`, `72 in`. The plate shows both units, e.g. `1.87 m / 6 ft 1.6 in`. All characters are scaled from these numbers, so a 2.10 m character is drawn exactly 1.18 times taller than a 1.78 m one.

### Frames

- Upload 1 to 12 images per character, in walking order. They are sorted by **file name** (`walk_1.png`, `walk_2.png`, ... `walk_10.png` works).
- Transparent **PNG** frames look best. For frames on a plain background (white wall, green screen), tick **Remove plain background**; only background touching the image edge is removed, so white shirts survive. Use the tolerance slider if edges look rough.
- Crop each frame so the character fills it from the top of the head to the soles of the feet. The tool trims transparent margins itself and scales so that "head to feet" equals the character's height.
- Tell the tool which way your frames face. The main character is always shown walking right, the others walking left, and frames are mirrored automatically where needed.

### Export

| Choice | Notes |
| --- | --- |
| 720p, 1080p, 1440p, 2160p | 1920x1080 is "Full HD". 3840x2160 is 4K. |
| 24 / 30 / 60 fps | 30 is fine for walk cycles; 60 is smoother for fast pacing. |

In Chrome, Edge and Safari the video is rendered **frame by frame** with the browser's built-in H.264 encoder and written to a real `.mp4`. It is exact and does not have to play in real time. Browsers without that encoder fall back to a real-time recording (keep the tab visible), which may produce WebM instead; the tool tells you when that happens.

The video has no audio. Add music or voice-over in your editor of choice.

### Save your work

*Save project* downloads a `.json` containing your settings **and your frames**. *Load project* restores everything, so you do not need to re-upload frames next time.

## Put it on GitHub

Upload these files to the root of your repository (replace the existing `index.html`):

```
index.html
style.css
app.js
vendor/mp4-muxer.js
vendor/mp4-muxer.LICENSE
README.md
LICENSE
.nojekyll
```

To get a public link: **Settings > Pages > Build and deployment > Deploy from a branch > main / (root) > Save**. After a minute the tool is live at `https://<your-username>.github.io/WALKING-CHARACTER-COMPARISON/`.

## Notes

- `vendor/mp4-muxer.js` is [mp4-muxer](https://github.com/Vanilagy/mp4-muxer) 5.1.3 (MIT), included so the tool works offline and does not depend on a CDN.
- Fonts (Barlow) load from Google Fonts when online and fall back to Arial Narrow offline.
- Only use frames and backgrounds you have the right to use.
