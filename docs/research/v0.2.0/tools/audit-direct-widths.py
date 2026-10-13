"""Convert synthetic SVGs at exact widths using isolated converter/font wrappers."""
from pathlib import Path
import argparse,json,subprocess,hashlib
import fitz
parser=argparse.ArgumentParser();parser.add_argument('fixtures',type=Path);parser.add_argument('output',type=Path);parser.add_argument('reference_converter');parser.add_argument('fallback_converter');args=parser.parse_args();args.output.mkdir(exist_ok=True,parents=True);records=[]
for mode,converter,widths in [('reference',args.reference_converter,[3.5,4.1,5.5]),('fallback',args.fallback_converter,[3.5])]:
    for width in widths:
        for source in sorted(args.fixtures.glob('*.svg')):
            output=args.output/f'{mode}-{width}-{source.stem}.pdf'
            subprocess.run([converter,'--format=pdf','--width',str(width)+'in','--output',str(output),str(source)],check=True)
            page=fitz.open(output)[0];spans=[s for b in page.get_text('dict')['blocks'] for l in b.get('lines',[]) for s in l['spans']]
            assert abs(page.rect.width-width*72)<.02,(source,width,page.rect.width)
            outside=[s['text'] for s in spans if not page.rect.contains(fitz.Rect(s['bbox']))];minimum=min(s['size'] for s in spans)
            essential=[x['width'] for x in page.get_drawings() if x.get('type') in ['s','fs'] and x.get('width',0)>0]
            assert minimum>=7.99 and not outside and min(essential)>=.499,(source,minimum,outside)
            records.append({'source':source.name,'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'fontMode':mode,'widthInchesRequested':width,'widthPtObserved':page.rect.width,'minimumTextPtObserved':minimum,'minimumStrokePtObserved':min(essential),'fontNames':sorted({s['font'] for s in spans}),'textOutsidePage':outside})
(args.output/'results.json').write_text(json.dumps(records,indent=2)+'\n');print('Exact-width checks passed:',len(records))
