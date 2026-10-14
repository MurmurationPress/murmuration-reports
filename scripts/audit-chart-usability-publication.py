"""Audit feature-generated chart PDFs compiled by the pinned Codex Press checkout."""
from pathlib import Path
import argparse
import hashlib
import json
import platform
import re
import zipfile
import xml.etree.ElementTree as ET
import fitz

COMPILER = "394cf109f035194b440e3b37d75de06e49fe074d"
PROFILES = (("final-3.5", 3.5), ("final-4.1", 4.1), ("final-5.5", 5.5))
SVG_NS = {"svg": "http://www.w3.org/2000/svg"}


def normalized(value: str) -> str:
    return " ".join(value.split())


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("root", type=Path, help="fresh output root for the three compiler runs")
    parser.add_argument("output", type=Path, help="audit JSON path outside the run directories")
    args = parser.parse_args()
    ledger = {
        "compilerCommit": COMPILER,
        "python": platform.python_version(),
        "pymupdf": fitz.VersionBind,
        "profiles": {},
        "limitations": [
            "Synthetic digital publications only; no physical-print proof was made.",
            "EPUBCheck, SVG payload and XHTML checks do not qualify readers or assistive technology.",
            "The PDF contains no established accessible tagging; no accessible-PDF claim is made.",
            "This measures actual compiler placement; no standalone SVG conversion is substituted.",
        ],
    }
    for name, width in PROFILES:
        run = args.root / name
        result = json.loads((run / "results.json").read_text())
        assert result["compilerCommit"] == COMPILER
        source = Path(result["nativeSourceVault"]) / result["svgPath"]
        svg_bytes = source.read_bytes()
        svg = ET.fromstring(svg_bytes)
        group = svg.find("svg:g", SVG_NS)
        assert group is not None
        assert hashlib.sha256(svg_bytes).hexdigest() == result["inputSha256"][result["svgPath"]]
        pdf = fitz.open(run / result["pdf"]["outputPath"])
        placements = []
        table_pages = []
        rendered_pages = []
        text_outside_page = []

        for page_number, page in enumerate(pdf, start=1):
            spans = [
                span
                for block in page.get_text("dict")["blocks"]
                if "lines" in block
                for line in block["lines"]
                for span in line["spans"]
            ]
            sans = [
                span
                for span in spans
                if span["font"].startswith(("DejaVuSans", "LiberationSans"))
            ]
            chart_text = normalized(" ".join(span["text"] for span in sans))
            is_chart_page = "Synthetic chart" in chart_text
            page_text = normalized(page.get_text())

            if is_chart_page:
                backgrounds = [
                    drawing["rect"]
                    for drawing in page.get_drawings()
                    if drawing.get("fill") == (1.0, 1.0, 1.0)
                    and len(drawing["items"]) == 1
                    and drawing["items"][0][0] == "re"
                    and drawing["rect"].width > 50
                    and drawing["rect"].height > 50
                ]
                assert len(backgrounds) == 1, backgrounds
                box = backgrounds[0]
                expected_width = width * 72
                ratio = float(svg.get("height")) / float(svg.get("width"))
                assert abs(box.width - expected_width) < 0.02, (box.width, expected_width)
                assert abs(box.height - expected_width * ratio) < 0.02
                chart_spans = [
                    span
                    for span in sans
                    if box.intersects(fitz.Rect(span["bbox"]))
                ]
                assert chart_spans and min(span["size"] for span in chart_spans) >= 8
                extracted = normalized(" ".join(span["text"] for span in chart_spans))
                for element in group.findall("svg:text", SVG_NS):
                    label = normalized(" ".join(element.itertext()))
                    assert label in extracted, label
                assert "Synthetic values from two dated observations." in page_text
                assert "Generated four-series assessment" in page_text
                strokes = [
                    drawing["width"]
                    for drawing in page.get_drawings()
                    if drawing.get("type") in ("s", "fs")
                    and drawing.get("width", 0) > 0
                    and box.contains(drawing["rect"])
                ]
                assert strokes and min(strokes) >= 0.5
                placements.append(
                    {
                        "page": page_number,
                        "requestedWidthInches": width,
                        "actualWidthPt": box.width,
                        "actualHeightPt": box.height,
                        "minimumTextPt": min(span["size"] for span in chart_spans),
                        "minimumEssentialStrokePt": min(strokes),
                        "allVisibleSvgTextPresent": True,
                        "chartAndExternalCaptionsSamePage": True,
                    }
                )

            if re.search(r"ROW\d{3}", page.get_text()):
                table_pages.append(page_number)
            for span in spans:
                if not page.rect.contains(fitz.Rect(span["bbox"])):
                    text_outside_page.append({"page": page_number, "text": span["text"]})
            if is_chart_page or re.search(r"ROW\d{3}", page.get_text()):
                rendered_pages.append(page_number)
                page.get_pixmap(matrix=fitz.Matrix(1.8, 1.8), colorspace=fitz.csGRAY).save(
                    run / f"greyscale-page-{page_number:02}.png"
                )

        assert len(placements) == 1 and not text_outside_page
        full_text = "\n".join(page.get_text() for page in pdf)
        assert all(
            len(re.findall(fr"ROW{index:03}", full_text)) == 1
            for index in range(1, 81)
        )
        assert full_text.count("+5.00") == 80
        epub_result = None
        if result.get("epub"):
            epub_path = run / result["epub"]["outputPath"]
            archive = zipfile.ZipFile(epub_path)
            svg_names = [name for name in archive.namelist() if name.endswith(".svg")]
            assert len(svg_names) == 1 and archive.read(svg_names[0]) == svg_bytes
            xhtml = normalized(
                " ".join(
                    archive.read(name).decode()
                    for name in archive.namelist()
                    if name.endswith(".xhtml")
                )
            )
            assert all(f"ROW{index:03}" in xhtml for index in range(1, 81))
            assert f"width:{width}in" in xhtml
            epub_result = {
                "EPUBCheck": result["epub"]["validation"]["status"],
                "svgPayloadExact": True,
                "all80RowsPresent": True,
                "authoredWidthPresent": True,
                "readerQualified": False,
            }

        ledger["profiles"][name] = {
            "pdfPageCount": len(pdf),
            "placements": placements,
            "tablePages": table_pages,
            "greyscalePagesRenderedForReview": rendered_pages,
            "textOutsidePage": text_outside_page,
            "all80RowsExactlyOnce": True,
            "all80DeltasPlusFive": True,
            "epub": epub_result,
        }
        print(name, placements, "table pages", table_pages, "EPUB", epub_result)

    args.output.write_text(json.dumps(ledger, indent=2) + "\n")


if __name__ == "__main__":
    main()
