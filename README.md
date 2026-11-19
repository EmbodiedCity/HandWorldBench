# HandWorldBench

**A Unified Benchmark for Hand-Centric World Models**

Research project page featuring human hands, simulated dexterous hands, and real dexterous hands.

- 54 selected evaluation videos in three scrolling galleries
- Three-embodiment video carousel
- 20 paper figures with expandable views
- Interactive results across eleven models
- Responsive white theme with locally hosted Google Sans Flex

## Preview locally

```bash
python3 -m http.server 8000
```

Open http://localhost:8000 . The site is static and needs no build or package installation.

## Edit

- `index.html`: page structure, authors and publication information
- `style.css`: layout, typography and animation
- `app.js`: carousel, galleries, figure panels and results
- `assets/cases.json`: selected evaluation reference metadata
- `assets/results.json`: manuscript results

Publication links and author information are managed in `index.html`.

Google Sans Flex is provided under the SIL Open Font License; see `assets/fonts/OFL.txt`.
