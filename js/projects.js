// What each project's glass panel shows. The words and numbers live in index.html;
// this file only says how to draw the screen of each panel and what is on its back.

export const SCREENS = [
  {
    id: "sql",
    back: "SQL",
    label: "01 · SQL",
    repo: "sql-subscription-churn",
    code: [
      "SELECT payment_setup,",
      "  round(100.0 * count(*) FILTER (WHERE left_this_month)",
      "    / sum(count(*) FILTER (WHERE left_this_month)) OVER (), 1)",
      "    AS pct_of_leavers,",
      "  round(100.0 * count(*) FILTER (WHERE left_this_month)",
      "    / count(*), 2) AS churn_pct",
      "FROM grouped",
      "GROUP BY payment_setup;",
    ],
    images: ["shots/sql-chart.png"],
  },
  {
    id: "excel",
    back: "EXCEL",
    label: "02 · Excel",
    repo: "zip-recruiter-price-test.xlsx",
    images: ["shots/excel-summary.png", "shots/excel-model.png"],
  },
  {
    id: "tableau",
    back: "TABLEAU",
    label: "03 · Tableau",
    repo: "Tableau Public",
    images: ["shots/tableau-dashboard.png"],
  },
  {
    id: "python",
    back: "PYTHON",
    label: "04 · Python",
    repo: "feature_retention.ipynb",
    code: [
      "people[\"features\"] = pd.cut(people[\"features_week1\"],",
      "    [-1, 1, 2, 3, 99], labels=[\"1\", \"2\", \"3\", \"4+\"])",
      "(people.groupby(\"features\", observed=True)[\"came_back\"]",
      "    .agg(accounts=\"size\", came_back=\"mean\"))",
    ],
    images: ["shots/python-chart-1.png", "shots/python-chart-2.png"],
  },
  {
    id: "pipeline",
    back: "DBT",
    label: "05 · Data engineering",
    repo: "data-pipeline-sdk-downloads",
    images: ["shots/pipeline-dashboard.png"],
  },
];
