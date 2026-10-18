from pathlib import Path
import shutil, json
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'output/pdf/banana-design-review.pdf'
BASE = ROOT / 'design/presentation'
manifest = json.loads((BASE / 'styles.json').read_text())

pdfmetrics.registerFont(TTFont('BananaSans', '/System/Library/Fonts/Supplemental/Arial.ttf'))
pdfmetrics.registerFont(TTFont('BananaSans-Bold', '/System/Library/Fonts/Supplemental/Arial Bold.ttf'))

W,H=1600,1100
INK=HexColor('#20271f'); GRAY=HexColor('#606960'); YELLOW=HexColor('#ffdc32'); RULE=HexColor('#d9ded7')
c=canvas.Canvas(str(OUT),pagesize=(W,H),pageCompression=1)
c.setTitle('Banana - Six Design Styles | Home and Search Items')
c.setAuthor('Banana product team')
c.setSubject('Vancouver grocery discovery - desktop and phone concept review')

def txt(x,y,s,size=20,font='BananaSans',color=INK):
    c.setFillColor(color);c.setFont(font,size);c.drawString(x,y,s)

def footer(page):
    c.setStrokeColor(RULE);c.setLineWidth(.7);c.line(48,48,W-48,48)
    txt(48,26,'BANANA  /  VANCOUVER GROCERY DISCOVERY  /  17 OCT 2026',11,color=GRAY)
    c.setFont('BananaSans',11);c.setFillColor(GRAY);c.drawRightString(W-48,26,f'{page:02d} / 14')

def draw_region(path,bounds,box):
    # PDF clipping places the original raster without editing/resampling it.
    iw,ih=Image.open(path).size
    left,top,right,bottom=bounds
    x,y,bw,bh=box
    rw,rh=right-left,bottom-top
    scale=min(bw/rw,bh/rh)
    dw,dh=rw*scale,rh*scale
    px=x+(bw-dw)/2; py=y+bh-dh
    c.saveState()
    p=c.beginPath();p.rect(px,py,dw,dh);c.clipPath(p,stroke=0,fill=0)
    c.drawImage(str(path),px-left*scale,py-(ih-bottom)*scale,width=iw*scale,height=ih*scale,mask='auto')
    c.restoreState()
    return px,py,dw,dh

# Opening brief.
c.setFillColor(YELLOW);c.rect(0,0,540,H,fill=1,stroke=0)
txt(60,984,'Banana',68,'BananaSans-Bold')
txt(60,905,'Design review',35,'BananaSans-Bold')
txt(60,835,'Six visual styles.',25)
txt(60,795,'Two core pages.',25)
txt(60,755,'Desktop + phone.',25)
txt(60,160,'Vancouver groceries',22,'BananaSans-Bold')
txt(60,122,'17 October 2026',18)
txt(620,982,'Find better grocery prices nearby.',38,'BananaSans-Bold')
txt(620,907,'The shared product brief',23,'BananaSans-Bold')
items=[('Home','Discover the latest discounts around a selected location.'),('Search items','Browse the catalogue, search groceries and refine results.'),('Offer information','Image, pack size, price, unit price, store, distance and expiry.'),('Daily freshness','Prices are updated daily; show when information was checked.'),('Responsive foundation','A good desktop experience, with a future phone app in mind.')]
y=850
for title,body in items:
    txt(620,y,title,20,'BananaSans-Bold');txt(620,y-34,body,18,color=GRAY);y-=112
c.setStrokeColor(RULE);c.line(620,260,1535,260)
txt(620,221,'Review focus',21,'BananaSans-Bold')
txt(620,183,'Compare navigation, readability, product imagery and brand character.',18)
txt(620,124,'Static visual concepts. All prices and distances are illustrative sample data.',15,color=GRAY)
txt(620,94,'Backend planned on Supabase. Existing “All items” labels mean Search items.',15,color=GRAY)
c.bookmarkPage('brief');c.addOutlineEntry('Product brief','brief',0)
c.showPage()

# Contents / style selection.
txt(48,1034,'Six styles, one product',38,'BananaSans-Bold')
txt(48,992,'Each style has a Home page and a Search items page, with desktop and phone views.',20,color=GRAY)
y=905
for st in manifest:
    n=st['number']; start=3+(n-1)*2
    c.setFillColor(YELLOW);c.roundRect(48,y-28,64,64,8,fill=1,stroke=0)
    txt(62,y-7,f'{n:02d}',25,'BananaSans-Bold')
    txt(144,y+9,st['name'],27,'BananaSans-Bold')
    txt(144,y-28,st['description'],18,color=GRAY)
    txt(1330,y+2,f'Pages {start}-{start+1}',18,'BananaSans-Bold')
    c.linkRect('',f'style{n}-home',(48,y-40,1538,y+45),relative=0,thickness=0)
    c.setStrokeColor(RULE);c.line(144,y-59,1538,y-59)
    y-=137
footer(2)
c.bookmarkPage('contents');c.addOutlineEntry('Style index','contents',0)
c.showPage()

for st in manifest:
    n=st['number']; orig=BASE/st['original'];comp=BASE/st['companion'];split=st['split']
    for screen in ['Home','Search items']:
        page=3+(n-1)*2+(screen=='Search items')
        key=f'style{n}-'+('home' if screen=='Home' else 'search')
        c.bookmarkPage(key)
        if screen=='Home':c.addOutlineEntry(f'{n:02d} {st["name"]}',key,0)
        else:c.addOutlineEntry('Search items',key,1)
        txt(48,1040,f'{n:02d}  {st["name"]}',28,'BananaSans-Bold')
        c.setFillColor(YELLOW);c.roundRect(1278,1020,274,46,7,fill=1,stroke=0)
        txt(1296,1034,screen,22,'BananaSans-Bold')
        txt(48,987,'DESKTOP',12,'BananaSans-Bold',GRAY)
        txt(1166,987,'PHONE',12,'BananaSans-Bold',GRAY)
        desktop=orig if screen=='Home' else comp
        phone=comp if screen=='Home' else orig
        dw,dh=Image.open(desktop).size;pw,ph=Image.open(phone).size
        draw_region(desktop,(0,0,split-8,dh),(48,74,1090,891))
        draw_region(phone,(split+8,0,pw,ph),(1166,74,386,891))
        footer(page);c.showPage()
c.save()
print(OUT)
print('Pages: 14')
print(f'Size: {OUT.stat().st_size/1024/1024:.1f} MB')
