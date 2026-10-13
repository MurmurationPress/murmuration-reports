"""Measure actual compiler placement of feature-generated saved assets; no reader/print claim."""
from pathlib import Path
import argparse, hashlib, json, re, subprocess, xml.etree.ElementTree as ET, zipfile
import fitz
p=argparse.ArgumentParser();p.add_argument('root',type=Path);p.add_argument('output',type=Path);p.add_argument('--native-ui',type=Path);a=p.parse_args()
ns={'s':'http://www.w3.org/2000/svg'}
ledger={'compilerCommit':'394cf109f035194b440e3b37d75de06e49fe074d','cases':{},'limitations':['No physical proof or reader/AT/accessibility qualification.','Feature-generated SVG/table came from isolated native Obsidian manager/capability generation.','Codex harness uses static transclusion plus assembled-book planners/executors, not the compiler UI.','No standalone conversion result is substituted for final compiler placement.']}
for name in ['reference-3.5','reference-4.1','reference-5.5','fallback-3.5']:
 root=a.root/name;r=json.loads((root/'results.json').read_text());assert r['compilerCommit']==ledger['compilerCommit'];source=Path(r['nativeSourceVault'])/r['svgPath'];svg=ET.parse(source).getroot();group=svg.find('s:g',ns)
 assert hashlib.sha256(source.read_bytes()).hexdigest()==r['inputSha256'][r['svgPath']]
 pdf=fitz.open(root/r['pdf']['outputPath']);charts=[];table_pages=[];rendered=[];outside=[]
 def normalize(text):return re.sub(r'\s+',' ',text).strip()
 for index,page in enumerate(pdf):
  spans=[s for b in page.get_text('dict')['blocks'] for line in b.get('lines',[]) for s in line['spans']];chart=[s for s in spans if s['font'].startswith(('DejaVuSans','LiberationSans'))]
  if chart:
   backgrounds=[d['rect'] for d in page.get_drawings() if d.get('fill')==(1.,1.,1.) and len(d['items'])==1 and d['items'][0][0]=='re' and d['rect'].width>50 and d['rect'].height>50];assert len(backgrounds)==1
   box=backgrounds[0];expected=r['widthInches']*72;assert abs(box.width-expected)<.02;assert abs(box.height-expected*float(svg.get('height'))/float(svg.get('width')))<.02
   minimum=min(s['size'] for s in chart);assert minimum>=7.99
   essential=[d['width'] for d in page.get_drawings() if d.get('type') in ['s','fs'] and d.get('width',0)>0 and box.contains(d['rect'])]
   assert min(essential)>=.499
   actual=normalize(' '.join(s['text'] for s in chart));missing=[normalize(' '.join(t.itertext())) for t in group.findall('s:text',ns) if normalize(' '.join(t.itertext())) not in actual];assert not missing,missing
   assert 'Generated four-series assessment' in page.get_text(),'External caption separated'
   charts.append({'page':index+1,'requestedWidthInches':r['widthInches'],'actualWidthPt':box.width,'actualHeightPt':box.height,'minimumChartTextPt':minimum,'minimumChartStrokePt':min(essential),'fonts':sorted({s['font'] for s in chart}),'allVisibleTextPresent':True,'externalCaptionSamePage':True})
  outside.extend({'page':index+1,'text':s['text'],'bbox':s['bbox']} for s in spans if not page.rect.contains(fitz.Rect(s['bbox'])))
  text=page.get_text()
  if re.search(r'ROW\d{3}',text):
   table_pages.append(index+1);flat=normalize(text);assert 'parameter' in flat and 'current' in flat and 'previous' in flat
  if chart or re.search(r'ROW\d{3}',text) or 'Explicit-pair' in text:
   (root/'review-pages').mkdir(exist_ok=True);page.get_pixmap(matrix=fitz.Matrix(1.8,1.8),colorspace=fitz.csGRAY).save(root/'review-pages'/f'page-{index+1:02}.png');rendered.append(index+1)
 assert len(charts)==1 and not outside
 text='\n'.join(page.get_text() for page in pdf);assert all(len(re.findall(f'ROW{i:03}',text))==1 for i in range(1,81));assert '2029-05-29' in text and '2029-06-30' in text;assert text.count('+5.00')==80
 info=subprocess.check_output(['pdfinfo',str(root/r['pdf']['outputPath'])],text=True);assert re.search(r'^Tagged:\s+no$',info,re.M)
 case={'harness':r,'pageCount':len(pdf),'chartPlacements':charts,'all80RowsOnce':True,'all80DeltasPlusFive':True,'tablePages':table_pages,'renderedPages':rendered,'textOutsidePages':outside,'pdfTagged':False,'pdfSha256':hashlib.sha256((root/r['pdf']['outputPath']).read_bytes()).hexdigest()}
 if r.get('epub'):
  assert r['epub']['validation']['status']=='passed';z=zipfile.ZipFile(root/r['epub']['outputPath']);svgs=[n for n in z.namelist() if n.endswith('.svg')];assert len(svgs)==1 and z.read(svgs[0])==source.read_bytes()
  xhtml='\n'.join(z.read(n).decode() for n in z.namelist() if n.endswith('.xhtml'));assert all(f'ROW{i:03}' in xhtml for i in range(1,81));assert 'width:4.1in' in xhtml
  case['epub']={'EPUBCheck':'zero errors/warnings','svgPayloadExact':True,'all80RowsPresent':True,'authoredWidthPresent':True,'readerQualified':False,'sha256':hashlib.sha256((root/r['epub']['outputPath']).read_bytes()).hexdigest()}
 ledger['cases'][name]=case
 print(name,charts,'tables',table_pages)
if a.native_ui:
 native=json.loads((a.native_ui/'evidence.json').read_text());vault=a.native_ui/'vault';pdf=fitz.open(vault/native['pdf']);charts=[];outside=[]
 for i,page in enumerate(pdf):
  spans=[s for b in page.get_text('dict')['blocks'] for line in b.get('lines',[]) for s in line['spans']];chart=[s for s in spans if s['font'].startswith('DejaVuSans')]
  outside.extend({'page':i+1,'text':s['text']} for s in spans if not page.rect.contains(fitz.Rect(s['bbox'])))
  if chart:
   boxes=[d['rect'] for d in page.get_drawings() if d.get('fill')==(1.,1.,1.) and len(d['items'])==1 and d['items'][0][0]=='re' and d['rect'].width>50 and d['rect'].height>50];assert len(boxes)==1;box=boxes[0];assert abs(box.width-295.2)<.02
   assert min(s['size'] for s in chart)>=7.99;assert 'Generated four-series assessment' in page.get_text()
   charts.append({'page':i+1,'actualWidthPt':box.width,'actualHeightPt':box.height,'minimumChartTextPt':min(s['size'] for s in chart),'externalCaptionSamePage':True})
  if chart or re.search(r'ROW\d{3}',page.get_text()) or 'Explicit-pair' in page.get_text():
   (a.native_ui/'review-pages').mkdir(exist_ok=True);page.get_pixmap(matrix=fitz.Matrix(1.8,1.8),colorspace=fitz.csGRAY).save(a.native_ui/'review-pages'/f'page-{i+1:02}.png')
 assert len(charts)==1 and not outside
 text='\n'.join(page.get_text() for page in pdf);assert all(len(re.findall(f'ROW{i:03}',text))==1 for i in range(1,81));assert text.count('+5.00')==80
 validation=subprocess.check_output(['epubcheck',str(vault/native['epub'])],text=True,stderr=subprocess.STDOUT);assert 'No errors or warnings detected' in validation
 z=zipfile.ZipFile(vault/native['epub']);names=[n for n in z.namelist() if n.endswith('.svg')];assert len(names)==1;assert z.read(names[0])==(vault/'Saved reports Ω/Publication.svg').read_bytes()
 xhtml='\n'.join(z.read(n).decode() for n in z.namelist() if n.endswith('.xhtml'));assert all(f'ROW{i:03}' in xhtml for i in range(1,81))
 ledger['nativeCompilerUi']={'evidence':native,'pageCount':len(pdf),'chartPlacements':charts,'all80RowsOnce':True,'all80DeltasPlusFive':True,'textOutsidePages':outside,'EPUBCheck':'zero errors/warnings','svgPayloadExact':True,'all80EpubRowsPresent':True,'readerQualified':False}
 print('Native compiler UI:',charts,'EPUBCheck zero; SVG exact; all 80 rows retained')
a.output.write_text(json.dumps(ledger,indent=2)+'\n')
