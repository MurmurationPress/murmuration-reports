"""Digital fixture audit, not physical print/accessibility qualification."""
import argparse, hashlib, json, re, xml.etree.ElementTree as ET
from pathlib import Path
import fitz
parser=argparse.ArgumentParser();parser.add_argument('root',type=Path);parser.add_argument('fixtures',type=Path);args=parser.parse_args();root=args.root
result=json.loads((root/'results.json').read_text());width=result['widthInches'];folder=root/result['pdf']['workingDirectory'];manifest=json.loads((folder/'codex-parity-manifest.json').read_text());tasks=manifest['assets']['svgConversions']
ns={'svg':'http://www.w3.org/2000/svg'}
def normalize(s):return re.sub(r'\s+',' ',s).strip()
figure_checks=[]
for task in tasks:
    name=task['sourcePath'];svg=ET.parse(args.fixtures/name).getroot();asset=fitz.open(root/task['outputPath']);page=asset[0];bounds=page.rect
    spans=[s for block in page.get_text('dict')['blocks'] if 'lines' in block for ln in block['lines'] for s in ln['spans']]
    outside=[{'text':s['text'],'bbox':s['bbox']} for s in spans if not bounds.contains(fitz.Rect(s['bbox']))]
    text=normalize(page.get_text());expected=[normalize(' '.join(t.itertext())) for t in svg.findall('.//svg:text',ns)]
    missing=[s for s in expected if s and s not in text]
    # These SVGs deliberately contain no transforms/scaling on text/strokes.
    base_width=float(svg.get('width'));sizes=[float(t.get('font-size',svg.find('svg:g',ns).get('font-size'))) for t in svg.findall('.//svg:text',ns)]
    strokes=[float(n.get('stroke-width','1')) for n in svg.iter() if n.get('stroke') and n.get('stroke')!='none']
    minimum_label=min(sizes)*width*72/base_width;minimum_stroke=min(strokes)*width*72/base_width
    check={'source':name,'allTextPresent':not missing,'missingText':missing,'textOutsideSvgPage':outside,'resolvedFonts':sorted({s['font'] for s in spans}),'minimumLabelPtCalculated':minimum_label,'minimumEssentialStrokePtCalculated':minimum_stroke}
    assert not missing and not outside,check
    assert minimum_label>=8 and minimum_stroke>=.5,check
    figure_checks.append(check)
book=fitz.open(root/result['pdf']['outputPath']);pages=[];figure_pages=[];table_pages=[];book_outside=[]
for i,page in enumerate(book):
    text=page.get_text();spans=[s for block in page.get_text('dict')['blocks'] if 'lines' in block for ln in block['lines'] for s in ln['spans']]
    chart_spans=[s for s in spans if s['font'].startswith(('DejaVuSans','LiberationSans'))]
    if chart_spans:
        figure_pages.append(i+1);minimum=min(s['size'] for s in chart_spans)
        assert minimum>=7.99,(i+1,minimum)
    outside=[{'text':s['text'],'bbox':s['bbox']} for s in spans if not page.rect.contains(fitz.Rect(s['bbox']))]
    if outside:book_outside.append({'page':i+1,'outside':outside})
    if re.search(r'ROW\d{3}',text):
        table_pages.append(i+1);assert 'Observation' in re.sub(r'-\n', '', text) and 'Previous' in text,(i+1,'table header missing')
    # Render all content-bearing pages in greyscale for human inspection.
    if chart_spans or re.search(r'ROW\d{3}',text) or 'explicit-pair comparison' in text.lower() or 'scorecard' in text.lower():
        pages.append(i+1);(root/'review-pages').mkdir(exist_ok=True)
        page.get_pixmap(matrix=fitz.Matrix(1.6,1.6),colorspace=fitz.csGRAY).save(root/'review-pages'/f'page-{i+1:02}.png')
assert not book_outside,book_outside
output={'widthInches':width,'profile':result['layoutProfile'],'pageCount':len(book),'figureChecks':figure_checks,'figurePages':figure_pages,'tablePages':table_pages,'renderedForReviewPages':pages,'bookTextOutsidePage':book_outside,'minimumFigureTextPtObserved':min(s['size'] for p in book for b in p.get_text('dict')['blocks'] if 'lines' in b for l in b['lines'] for s in l['spans'] if s['font'].startswith(('DejaVuSans','LiberationSans'))),'pdfSha256':hashlib.sha256((root/result['pdf']['outputPath']).read_bytes()).hexdigest(),'pdfTagged':False,'limitations':'Text extraction and page/standalone-SVG bounds are checked. This is not complete plot-geometry overlap proof, physical printing, PDF tagging or reader/assistive-technology qualification.'}
(root/'digital-audit.json').write_text(json.dumps(output,indent=2)+'\n');print(json.dumps({k:v for k,v in output.items() if k!='figureChecks'}))
