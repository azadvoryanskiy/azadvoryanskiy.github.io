# azadvoryanskiy.github.io

Portfolio site of Artem Zadvoryanskiy, Senior Product & Data Analyst:
https://azadvoryanskiy.github.io

One static page, no build step. The top of the page is a short scroll story
drawn in WebGL: one cloud of points turns into a data table, the GitHub events
chart, the KKBox renewal bars and an A/B test split as you scroll. Below it are
the case studies as plain HTML. Without WebGL the story falls back to text.

- `index.html`, `style.css`: the page
- `cinema/engine.js`: the particle stage (Three.js 0.169.0 from jsDelivr)
- `cinema/scenes.js`: the charts made of points
- `cinema/data.js`: the real numbers they are drawn from, with their sources

Case studies:

- [KKBox subscriber churn](https://github.com/azadvoryanskiy/kkbox-subscription-analytics): product analytics end to end
- [GitHub product analytics](https://github.com/azadvoryanskiy/github-product-analytics): data quality, activation and feature usage
