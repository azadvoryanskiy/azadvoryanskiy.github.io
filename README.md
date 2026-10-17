# azadvoryanskiy.github.io

Portfolio site of Artem Zadvoryanskiy, Senior Product & Data Analyst:
https://azadvoryanskiy.github.io

One static page, no build step. Five projects, one per skill, each shown as a glass
panel in a small three.js scene. Scrolling brings the panels forward one at a time
with the project's question, three numbers and links next to it.

| # | Skill | Project |
|---|---|---|
| 1 | SQL | [Who is a subscription service losing?](https://github.com/azadvoryanskiy/sql-subscription-churn) |
| 2 | Excel | [Should ZipRecruiter raise its price from $99 to $249?](https://github.com/azadvoryanskiy/excel-pricing-test) |
| 3 | Tableau | [Where do we lose B2B leads?](https://github.com/azadvoryanskiy/tableau-b2b-funnel) |
| 4 | Python | [Do people who try more features in week one come back?](https://github.com/azadvoryanskiy/python-feature-retention) |
| 5 | Data engineering | [Which developer tools are growing? A daily pipeline](https://github.com/azadvoryanskiy/data-pipeline-sdk-downloads) |

## Files

- `index.html`, `style.css`: the page. All text lives in the HTML, so the page reads
  fine without JavaScript, and visitors who ask for reduced motion get a plain page.
- `js/main.js`: turns the scroll position into one number and moves the text, the giant
  word and the light from it.
- `js/stage.js`: the three.js scene and where each panel sits at each point of the scroll.
- `js/screens.js`, `js/projects.js`: what each panel shows, drawn on a canvas from the
  images in `shots/`.
- `fonts/`: Unbounded, Onest and Doto, self-hosted, SIL Open Font License.
- `vendor/three/`: three.js 0.186.1 (MIT), minified copies of the published files.

Colours and type follow the LimeDuo design system: ink, paper and one volt green.

To preview locally: `python3 -m http.server` in this folder, then open http://localhost:8000.
