import { test } from "node:test";
import { strictEqual as equal } from "node:assert";
import {
  chartPresentationStatus,
  SAVED_CHART_OUTPUT_STATUS,
  shouldDescribeSavedChartOutput,
} from "../src/manager/PresentationStatus";

test("detail presentation status distinguishes absent, explicit and v2 modes", () => {
  equal(
    chartPresentationStatus({ title: "Report", output: "Charts/report-v2.svg" }),
    "Legacy presentation is selected in the current definition.",
  );
  equal(
    chartPresentationStatus({ presentation: "legacy", caption: "Old" }),
    "Legacy presentation is selected in the current definition. Stored publication fields are preserved but are not active in legacy rendering.",
  );
  equal(
    chartPresentationStatus({ presentation: "publication", caption: "Active" }),
    "Publication presentation is selected in the current definition.",
  );
  equal(
    chartPresentationStatus({ presentation: "publication-v2", y_axis: {} }),
    "Publication v2 presentation is selected in the current definition.",
  );
  equal(
    chartPresentationStatus({ presentation: { extension: true } }),
    'The current definition contains an unrecognized presentation value ({"extension":true}); the existing parser treats it as legacy. Its stored fields are preserved.',
  );
});

test("saved output status does not infer its producing presentation from title or filename", () => {
  equal(
    SAVED_CHART_OUTPUT_STATUS.includes("may be out of date after definition edits"),
    true,
  );
  equal(SAVED_CHART_OUTPUT_STATUS.includes("producing presentation is not recorded"), true);
  equal(SAVED_CHART_OUTPUT_STATUS.includes("title and filename do not identify it"), true);
  equal(shouldDescribeSavedChartOutput("Charts/report.svg", []), true);
  equal(
    shouldDescribeSavedChartOutput("Charts/report.svg", ["Saved output is missing. Generate explicitly."]),
    false,
  );
  equal(
    shouldDescribeSavedChartOutput("Charts/report.svg", ["Output collision: another report claims it."]),
    false,
  );
  equal(shouldDescribeSavedChartOutput("", []), false);
});
