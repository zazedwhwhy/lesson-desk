# Synthetic chemistry diagrams

These fixtures contain invented questions, labels and values, with no user exam data.

- `paper.pdf`: two pages; vector flow diagram (Q11), raster apparatus (Q12A), vector continuation diagram (Q12B), vector chart (Q13).
- `paper.docx`: two embedded PNG figures for Q21 and Q22.
- `ground-truth.json`: expected associations and bounds. Its original file names map to `paper.pdf` and `paper.docx` here. Word page coordinates are unknown; only original embedded media bounds are asserted.

The tests render the PDF and read the DOCX with production code, mock the AI detections using the authored bounds, then verify association, caching, backup and PPT media bytes. They do not measure AI detection accuracy.
