"""Research-only reflow of the hand-authored specimens; no report implementation."""
from pathlib import Path
import argparse, hashlib, json, xml.etree.ElementTree as ET
from PIL import ImageFont
parser=argparse.ArgumentParser();parser.add_argument('fixtures',type=Path);parser.add_argument('--font',default='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf');args=parser.parse_args()
NS='http://www.w3.org/2000/svg';ET.register_namespace('',NS)
font=ImageFont.truetype(args.font,32)
def wrap(value,width):
    lines=[];line=''
    for word in value.split():
        trial=(line+' '+word).strip()
        if line and font.getlength(trial)>width:lines.append(line);line=word
        else:line=trial
    if line:lines.append(line)
    return lines
for path in sorted(args.fixtures.glob('*.svg')):
    if path.name=='line-four-series.svg':continue
    root=ET.parse(path).getroot();root.set('height','560');root.set('viewBox','0 0 720 560')
    root.find(f'{{{NS}}}rect').set('height','560')
    group=root.find(f'{{{NS}}}g');group.set('font-family','DejaVu Sans, Liberation Sans, Arial, sans-serif');group.set('font-size','32')
    footer_y=470 if path.name=='radar.svg' else 440
    for text in group.findall(f'{{{NS}}}text'):
        if text.get('font-size'):text.set('font-size','38')
        x=float(text.get('x','0'));y=float(text.get('y','0'))
        content=' '.join(text.itertext())
        if path.name=='line-fixed.svg' and content in ['-1','-0.5','0','0.5','1']:
            text.set('x','75');text.set('text-anchor','end')
        if path.name=='scorecard.svg':
            card=(min(int((y-65)//95),3));detail=content.startswith(('+30','−4','−0.6','Unavailable;'))
            text.set('y',str(140+95*card if detail else 100+95*card)) if y>40 else None
        if path.name=='scatter-error.svg' and content=='Value':text.set('x','90');text.set('y','70')
        if path.name=='radar.svg' and content in ['B','C','D']:
            positions={'B':('535','245'),'C':('350','420'),'D':('175','245')};text.set('x',positions[content][0]);text.set('y',positions[content][1])
        if path.name=='scorecard.svg' and x==330:text.set('x','400')
        if y>=430:
            y=footer_y
            text.set('y',str(y))
            for child in list(text):text.remove(child)
            text.text=None
            wrapped=wrap(content,680-x)
            footer_y=y+38*len(wrapped)
            for i,line in enumerate(wrapped):
                span=ET.SubElement(text,f'{{{NS}}}tspan',{'x':str(x),'y':str(y+38*i)});span.text=line
    for node in root.iter():
        if node.get('stroke-width'):node.set('stroke-width',str(max(3,float(node.get('stroke-width')))))
    ET.indent(root);path.write_text(ET.tostring(root,encoding='unicode')+'\n')
# Four-series identity specimen, deliberately distinct from production renderer.
root=ET.Element(f'{{{NS}}}svg',{'width':'720','height':'620','viewBox':'0 0 720 620','role':'img','aria-labelledby':'title desc'})
ET.SubElement(root,f'{{{NS}}}title',{'id':'title'}).text='Four series with fixed Y bounds'
ET.SubElement(root,f'{{{NS}}}desc',{'id':'desc'}).text='Signed values from minus one to plus one. Solid circles, dashed squares, dotted triangles and dash-dot diamonds identify four synthetic series.'
ET.SubElement(root,f'{{{NS}}}rect',{'width':'720','height':'620','fill':'white'})
g=ET.SubElement(root,f'{{{NS}}}g',{'font-family':'DejaVu Sans, Liberation Sans, Arial, sans-serif','font-size':'36','fill':'#17212b'})
def text(x,y,value,size=None):
    a={'x':str(x),'y':str(y)}
    if size:a['font-size']=str(size)
    ET.SubElement(g,f'{{{NS}}}text',a).text=value
def line(x1,y1,x2,y2,dash=None):
    a={'x1':str(x1),'y1':str(y1),'x2':str(x2),'y2':str(y2),'stroke':'#17212b','stroke-width':'3'}
    if dash:a['stroke-dasharray']=dash
    ET.SubElement(g,f'{{{NS}}}line',a)
text(45,40,'Four series with fixed Y bounds',36)
for value in [-1,-.5,0,.5,1]:
    y=230-value*140;text(80,y+8,str(value));g[-1].set('text-anchor','end');line(95,y,660,y,'2 8')
line(95,90,95,370);line(95,370,660,370)
values=[[-.8,-.3,.3,.7],[-.6,.1,.2,.5],[.8,.4,-.1,-.5],[.5,.2,-.4,-.8]]
names=['A: assessment at site one','B: assessment at site two','C: assessment at site three','D: assessment at site four']
dash=[None,'12 6','2 7','12 5 2 5']
for series,vals in enumerate(values):
    for i,v in enumerate(vals):
        x=135+155*i;y=230-v*140
        if i:line(x-155,230-vals[i-1]*140,x,y,dash[series])
        if series==0:ET.SubElement(g,f'{{{NS}}}circle',{'cx':str(x),'cy':str(y),'r':'8','fill':'white','stroke':'#17212b','stroke-width':'3'})
        else:
            pts=[(x-6,y-6),(x+6,y-6),(x+6,y+6),(x-6,y+6)] if series==1 else ([(x,y-7),(x+7,y+6),(x-7,y+6)] if series==2 else [(x,y-8),(x+8,y),(x,y+8),(x-8,y)])
            ET.SubElement(g,f'{{{NS}}}polygon',{'points':' '.join(f'{a},{b}' for a,b in pts),'fill':'white','stroke':'#17212b','stroke-width':'3'})
    y=440+40*series;line(95,y-8,145,y-8,dash[series]);text(165,y,names[series])
    mx,my=120,y-8
    if series==0:ET.SubElement(g,f'{{{NS}}}circle',{'cx':str(mx),'cy':str(my),'r':'8','fill':'white','stroke':'#17212b','stroke-width':'3'})
    else:
        pts=[(mx-6,my-6),(mx+6,my-6),(mx+6,my+6),(mx-6,my+6)] if series==1 else ([(mx,my-7),(mx+7,my+6),(mx-7,my+6)] if series==2 else [(mx,my-8),(mx+8,my),(mx,my+8),(mx-8,my)])
        ET.SubElement(g,f'{{{NS}}}polygon',{'points':' '.join(f'{a},{b}' for a,b in pts),'fill':'white','stroke':'#17212b','stroke-width':'3'})
for i,label in enumerate(['Jan','Feb','Mar','Apr']):text(115+155*i,405,label)
text(95,610,'Signed values, not probabilities.')
ET.indent(root);(args.fixtures/'line-four-series.svg').write_text(ET.tostring(root,encoding='unicode')+'\n')
p=args.fixtures/'publication.md';md=p.read_text()
if 'line-four-series.svg' not in md:
    marker='## Scatter Error';md=md.replace(marker,'## Four-series identity\n\n![Four distinct series on a fixed signed scale](line-four-series.svg)\n\nDescriptive alternative: Solid circles, dashed squares, dotted triangles and dash-dot diamonds identify four synthetic series. All values stay within −1…+1.\n\n'+marker)
md=md.replace('## Explicit-pair comparison','## Explicit-pair comparison').replace('## Scorecard Markdown alternative','## Later KPI design specimen (outside first milestone)')
# Percentage conventions are intentionally absent from the first milestone specimen.
a=md.index('| Metric | Current | Previous | Absolute delta |');b=md.index('## Later KPI',a)
md=md[:a]+'''| Metric | Current | Previous | Absolute delta |
| --- | ---: | ---: | ---: |
| Explicit May-to-June | +15.00 | +10.00 | +5.00 |
| Canonical after insertion | +15.00 | +12.00 | +3.00 |

Both rows are illustrative; the first milestone preserves signed two-decimal table formatting and adds no percentage-change policy.

'''+md[b:]
p.write_text(md)
(args.fixtures/'sha256.json').write_text(json.dumps({f.name:hashlib.sha256(f.read_bytes()).hexdigest() for f in sorted(args.fixtures.iterdir()) if f.suffix in ['.svg','.md']},indent=2)+'\n')
