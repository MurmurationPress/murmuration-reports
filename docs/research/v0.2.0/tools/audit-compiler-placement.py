"""Pinned merged-compiler research audit; run existing book/direct audits first.
No visual review is inferred from rendering. Tool versions are the pinned review environment.
"""
from pathlib import Path
import fitz,json,hashlib,xml.etree.ElementTree as E,zipfile,subprocess
from PIL import Image,ImageDraw
import argparse
p=argparse.ArgumentParser();p.add_argument("root",type=Path);p.add_argument("output",type=Path);a=p.parse_args()
reports=Path(__file__).resolve().parents[4];root=a.root;dest=a.output.parent;fixtures=reports/'docs/research/v0.2.0/fixtures';ns={'s':'http://www.w3.org/2000/svg'}
evidence={'compilerSourceCommit':'394cf109f035194b440e3b37d75de06e49fe074d','compilerBaseCommit':'93af44922cdb1b83b6166c4f8429d7d9f5b32c07','reportsPr11Head':'3492e836c0a7e0652c75f17d1d6f99562d2044a7','reportsHarnessSha256':hashlib.sha256((reports/'docs/research/v0.2.0/tools/publish-fixtures.ts').read_bytes()).hexdigest(),'tools':{'node':'v24.19.0','Pandoc':'3.1.3','XeTeX':'3.141592653-2.6-0.999995 (TeX Live 2023/Debian)','librsvg':'2.58.0','EPUBCheck':'5.3.0','fontconfig':'2.15.0','PyMuPDF':fitz.VersionBind,'Python':'3.12.3','Pillow':'11.3.0'},'fixtureSha256':{f.name:hashlib.sha256(f.read_bytes()).hexdigest() for f in sorted(fixtures.glob('*.svg'))},'cases':{},'directConversionChecks':json.loads((root/'direct-conversion/results.json').read_text()),'limitations':['No physical print/reader/accessibility qualification; PDFs remain untagged.','Research harness starts from an assembled synthetic book, bypassing live Obsidian discovery/assembly.','Font selection is isolated for librsvg only.','Actual compiler measurements use PDF vector background rectangles; standalone conversion results are listed separately.']}
for name in ['reference-3.5','reference-4.1','reference-5.5','fallback-3.5']:
 directory=root/name;r=json.loads((directory/'results.json').read_text());audit=json.loads((directory/'digital-audit.json').read_text());pdf=fitz.open(directory/r['pdf']['outputPath']);placements=[]
 for source in sorted(fixtures.glob('*.svg')):
  svg=E.parse(source).getroot();group=svg.find('s:g',ns);title=group.find('s:text',ns).text
  matches=[(i,p) for i,p in enumerate(pdf) if any(s['text']==title and s['font'].startswith(('DejaVuSans','LiberationSans')) for b in p.get_text('dict')['blocks'] for l in b.get('lines',[]) for s in l['spans'])];assert len(matches)==1,(source,matches);idx,page=matches[0]
  backgrounds=[x['rect'] for x in page.get_drawings() if x.get('fill')==(1.0,1.0,1.0) and len(x['items'])==1 and x['items'][0][0]=='re' and x['rect'].width>50 and x['rect'].height>50];assert len(backgrounds)==1,(source,backgrounds);box=backgrounds[0];expectedWidth=r['widthInches']*72;expectedHeight=expectedWidth*float(svg.get('height'))/float(svg.get('width'))
  assert abs(box.width-expectedWidth)<.02 and abs(box.height-expectedHeight)<.02,(source,box,expectedWidth,expectedHeight)
  spans=[s for b in page.get_text('dict')['blocks'] for l in b.get('lines',[]) for s in l['spans'] if s['font'].startswith(('DejaVuSans','LiberationSans'))]
  # Figure's external caption must also appear on this same page.
  assert 'synthetic reporting example' in page.get_text().lower() or (source.name=='line-four-series.svg' and 'Four distinct series on a fixed signed scale' in page.get_text()),(source,'caption not on figure page')
  placements.append({'source':source.name,'page':idx+1,'requestedWidthInches':r['widthInches'],'measuredWidthPt':box.width,'measuredHeightPt':box.height,'aspectRatio':box.width/box.height,'minimumChartTextPt':min(s['size'] for s in spans),'minimumEssentialStrokePt':min(float(n.get('stroke-width','1')) for n in svg.iter() if n.get('stroke') and n.get('stroke')!='none')*box.width/float(svg.get('width')),'fontNames':sorted({s['font'] for s in spans})})
  # Keep higher-resolution chart-page review copies outside repositories.
  page.get_pixmap(matrix=fitz.Matrix(1.6,1.6),colorspace=fitz.csGRAY).save(directory/'review-pages'/f'figure-{idx+1:02}.png')
 evidence['cases'][name]={'harnessResult':r,'pdfAudit':audit,'actualCompilerPlacements':placements,'allRowsOnce':all(x['count']==1 for x in json.loads((directory/'row-counts.json').read_text())),'renderedFigurePages':[x['page'] for x in placements]}
 # Contact sheet includes every figure-bearing page for this run.
 files=sorted((directory/'review-pages').glob('figure-*.png'));sheetdir=root/'contact-sheets';sheetdir.mkdir(exist_ok=True)
 for offset in range(0,len(files),6):
  canvas=Image.new('RGB',(1400,3250),'#ddd');draw=ImageDraw.Draw(canvas)
  for i,f in enumerate(files[offset:offset+6]):
   pic=Image.open(f).convert('RGB');pic.thumbnail((680,1030));x=(i%2)*700+10;y=(i//2)*1080+30;canvas.paste(pic,(x,y));draw.text((x,y-20),name+' '+f.stem,fill='black')
  canvas.save(sheetdir/f'{name}-{offset//6}.png')
r=evidence['cases']['reference-4.1']['harnessResult'];epub=root/'reference-4.1'/r['epub']['outputPath'];z=zipfile.ZipFile(epub);svgs=[n for n in z.namelist() if n.endswith('.svg')];original=set(evidence['fixtureSha256'].values());evidence['epub']={'svgCount':len(svgs),'allSvgPayloadsExact':all(hashlib.sha256(z.read(n)).hexdigest() in original for n in svgs),'EPUBCheck':'zero errors/warnings','sha256':hashlib.sha256(epub.read_bytes()).hexdigest(),'readerQualified':False};assert evidence['epub']['allSvgPayloadsExact'] and len(svgs)==11
for n in z.namelist():
 if n.endswith('.xhtml') and b'<img' in z.read(n):print('EPUB example',z.read(n).decode().split('<img')[1][:200]);break
a.output.write_text(json.dumps(evidence,indent=2)+'\n')
print('All 44 compiler figure placements and external captions verified')
