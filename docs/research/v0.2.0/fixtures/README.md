# Synthetic publication fixtures

Eleven hand-authored SVG specifications, an explicit-pair absolute-delta comparison, later KPI examples and an 80-row pagination table. These are **research specimens**, not implemented Reports output types. No manuscript content, production saved asset or production schema is modified.

The revised specimens use a named DejaVu Sans/Liberation Sans/Arial/sans-serif list, 32-unit labels (36 in the four-series specimen), three-unit essential strokes and wrapped captions. The larger sizes originally compensated for the historical height cap and now provide headroom at verified authored widths. No font binary is embedded or distributed. Actual font/width/minimum-point checks and the resolved authored-width blocker are documented in [publishing.md](../publishing.md).

The reference and fallback PDF checks cover every report-bearing page. Greyscale series identity uses solid/circle, dashed/square, dotted/triangle and dash-dot/diamond, with matching legend swatches. Plot/legend/caption spacing was inspected and adjusted. Exact-width standalone PDF tests are distinct from actual merged-compiler placement. Physical proof, reader and accessibility qualification remain pending.

Synthetic data: line A=[−.6,−.2,.3,.5], B=[−.4,.1,.2,.7], fixed [−1,1]. Four-series A=[−.8,−.3,.3,.7], B=[−.6,.1,.2,.5], C=[.8,.4,−.1,−.5], D=[.5,.2,−.4,−.8]. Scatter is a visual supplied-uncertainty specimen, with no statistical calculation. Bar primary heights=[100,180,140,220], grouped secondary=half primary, stacked secondary=55. Histogram counts=[10,18,14,22] with edges=[0,1,2,3,4]; heights=10 pixels/count. Pie/doughnut A=B=50. Radar A=.7,B=.6,C=.8,D=.5. KPI percentages/thresholds remain later design examples; the first-milestone comparison specimen contains absolute deltas only.

Broader bar/scatter numeric-axis semantics, statistical assumptions, circular/radar mappings and KPI status logic are not qualified by these layouts. Their inclusion provides publication layout coverage, not implementation acceptance. [Preparation/audit scripts](../tools/README.md) reproduce the bounded reflow and checks; no new rendering pipeline is implemented.
