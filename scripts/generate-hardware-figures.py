"""Editable vector concept figures; these are not schematics, Gerbers or routed PCBs."""
from pathlib import Path
from html import escape

OUT = Path(__file__).resolve().parents[1] / 'public' / 'assets'
OUT.mkdir(parents=True, exist_ok=True)
def label(x, y, text, size=14, fill='#49695b', weight=500, anchor='start'):
    return f'<text x="{x}" y="{y}" font-size="{size}" fill="{fill}" font-weight="{weight}" text-anchor="{anchor}">{escape(text)}</text>'
def rect(x,y,w,h,fill,rx=12,stroke='none'):
    return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" fill="{fill}" stroke="{stroke}"/>'
def wire(points,color='#85b5a3',width=3,dash=''):
    return f'<polyline points="{points}" fill="none" stroke="{color}" stroke-width="{width}" stroke-linejoin="round" stroke-linecap="round" stroke-dasharray="{dash}"/>'
def save(name,w,h,title,desc,body):
    svg=f'''<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}" role="img" aria-labelledby="title desc"><title id="title">{title}</title><desc id="desc">{desc}</desc><defs><pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="#dfebdf"/></pattern><linearGradient id="pcb" x2="1" y2="1"><stop stop-color="#28796a"/><stop offset="1" stop-color="#215d52"/></linearGradient><marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M1 1 6 4 1 7" fill="none" stroke="#7b9c88" stroke-width="1.3"/></marker></defs><g font-family="Arial, sans-serif">{rect(0,0,w,h,'#f6f8ef',20)}<rect width="{w}" height="{h}" fill="url(#grid)"/>{body}</g></svg>'''
    (OUT/name).write_text(svg)

# Figure 1. An annotated, deliberately non-routed board plan.
b=label(40,36,'COLONYWATCH / EDGE NODE A',14,'#467360',700)+label(960,36,'CONCEPT • NOT FOR FABRICATION',11,'#8f8e6b',600,'end')
b+=rect(110,75,680,520,'url(#pcb)',28,'#174e44')
for x in (140,760):
    for y in (105,565): b+=f'<circle cx="{x}" cy="{y}" r="14" fill="#c9b878"/><circle cx="{x}" cy="{y}" r="7" fill="#f6f8ef"/>'
for x in range(294,492,15):
    b+=rect(x,315,8,12,'#cab878',1)+rect(x,111,8,12,'#cab878',1)
b+=rect(295,112,193,204,'#b9c6bb',9,'#e5eadc')+rect(305,122,173,35,'#dce1ce',4)
for xx in range(318,466,22): b+=wire(f'{xx},130 {xx},150 {xx+11},150 {xx+11},130','#6e8170',2)
b+=label(392,210,'ESP32-S3',23,'#344e45',700,'middle')+label(392,236,'MINI module',14,'#667b6c',500,'middle')+label(392,278,'Wi-Fi + Bluetooth LE',12,'#667b6c',500,'middle')
b+=rect(283,70,217,43,'none',6,'#f0d58a')+label(392,96,'ANTENNA KEEP-OUT',11,'#f2dfac',600,'middle')
b+=rect(150,152,97,88,'#ecdfb6',9)+label(198,180,'J3 · UART',13,'#537264',700,'middle')+label(198,202,'LF reader',12,'#6e816d',500,'middle')
for x in range(163,235,15):b+=f'<circle cx="{x}" cy="221" r="4" fill="#8c9d82"/>'
b+=rect(660,259,94,82,'#e8debd',8)+label(707,287,'J2 · UART',12,'#557361',700,'middle')+label(707,309,'Food level',11,'#71836b',500,'middle')
b+=rect(160,380,205,133,'#194c43',13,'#75a087')+label(177,405,'PROTECTED POWER',12,'#d8e3c4',700)
b+=rect(180,425,50,45,'#b6b18d',6)+f'<circle cx="205" cy="447" r="14" fill="#6d816b"/>'+rect(252,429,47,35,'#728a77',4)+rect(320,425,17,50,'#d1bc78',3)
b+=label(180,491,'12 V → 5 V / 3.3 V',12,'#bbd4b8',600)
b+=rect(128,427,25,61,'#e2d4a9',3)+label(93,461,'12 V',12,'#789474',600,'end')
b+=rect(526,384,157,112,'#678b76',10,'#9fba8f')+rect(546,407,117,56,'#c6d0b5',4)+label(605,432,'SX1262',16,'#385a4a',700,'middle')+label(605,452,'OPTIONAL',10,'#718569',600,'middle')
b+=f'<circle cx="728" cy="421" r="12" fill="#ddc782"/><circle cx="728" cy="421" r="5" fill="#617f62"/>'+label(729,450,'LoRa RF',10,'#c8dabb',500,'middle')
b+=rect(395,528,115,35,'#e5d6af',5)+label(451,551,'J5 · wetness',11,'#5a785f',600,'middle')
b+=rect(593,530,122,34,'#e8d6ae',5)+label(655,552,'J4 · servo',12,'#5a745d',600,'middle')
b+=rect(650,132,101,53,'#d8e2ba',8)+label(700,154,'J1 · I²C',12,'#52735c',700,'middle')+label(700,173,'Temp + RH',11,'#70846a',500,'middle')
for i in range(4):b+=rect(532+i*20,213,10,25,'#d8c88f',2)
b+=label(532,202,'USB / PROGRAM / TEST',10,'#c1d9bd',600)
for x,y in ((516,312),(532,312),(548,312),(564,312),(580,312)):
    b+=f'<circle cx="{x}" cy="{y}" r="5" fill="#d3c180"/>'
b+=label(511,339,'TEST PADS',10,'#c9dbb9',600)
b+=wire('247,184 271,184 271,253 295,253','#9ecac1',3)+wire('488,235 610,235 610,157 650,157','#9ecac1',3)
b+=wire('488,268 630,268 630,299 660,299','#9ecac1',3)+wire('365,445 395,445 395,347 415,347 415,328','#d2b978',5)
b+=wire('363,468 379,468 379,574 576,574 576,547 593,547','#d2b978',5)+wire('451,528 451,365 467,365 467,328','#a8bda2',2)
b+=wire('655,530 655,514 506,514 506,294 488,294','#dbac86',3)+wire('526,417 510,417 510,355 487,355 487,328','#a0bba3',3,'6 5')
b+=wire('751,157 825,157 825,120','#8ab19b',3,'6 4')+rect(825,75,136,99,'#e6edda',13,'#bfd0b5')+label(893,105,'SHTC3 PROBE',13,'#5c7d5a',700,'middle')+label(893,130,'Shaded, ventilated',11,'#7f9072',500,'middle')+label(893,150,'Outside warm box',11,'#7f9072',500,'middle')
b+=wire('110,632 790,632','#93ac95',1.5)+wire('110,622 110,642','#93ac95',1.5)+wire('790,622 790,642','#93ac95',1.5)+label(450,659,'85 mm target envelope',13,'#78916f',600,'middle')
b+=wire('73,75 73,595','#93ac95',1.5)+wire('63,75 83,75','#93ac95',1.5)+wire('63,595 83,595','#93ac95',1.5)+f'<text x="50" y="335" font-size="13" fill="#78916f" transform="rotate(-90 50 335)" text-anchor="middle">65 mm target envelope</text>'
b+=label(830,253,'EXTERNAL MODULES',11,'#6c8969',700)+label(830,280,'RFID reader + tuned coil',11,'#829779')+label(830,302,'Hopper distance sensor',11,'#829779')+label(830,324,'Servo + guarded linkage',11,'#829779')+label(830,346,'Replaceable wetness probes',11,'#829779')
b+=label(40,702,'Illustrative placement and signal paths only. No electrical-rule check, RF tuning or PCB layout release has been performed.',11,'#8c987d')
save('edge-node-pcb.svg',1000,725,'Mock ColonyWatch controller PCB','Annotated 85 by 65 millimetre board concept with ESP32-S3, protected power rails, optional LoRa, and external sensor, RFID and servo headers. Not a routed PCB.',b)

# Figure 2. Functional signals and power, explicitly separate from a schematic.
b=label(35,35,'FUNCTIONAL ARCHITECTURE / PLANNED',14,'#55775f',700)
for y,title,sub in [(78,'Hopper distance','UART · headspace estimate'),(190,'Climate + wetness','I²C / ADC · temp, RH, local water'),(302,'Animal-chip reader','UART · 134.2 kHz FDX-B')]:
    b+=rect(35,y,245,82,'#eaf0df',13,'#d0ddc4')+label(57,y+31,title,17,'#45684f',700)+label(57,y+58,sub,11,'#7f9271')
    b+=wire(f'280,{y+41} 360,{y+41} 360,232 390,232','#8cb39e',3)
b+=rect(390,117,228,224,'#377c6b',22)+label(504,162,'ESP32-S3',26,'#f0f3da',700,'middle')+label(504,196,'Local policy + event log',13,'#cae0bd',500,'middle')+label(504,227,'Chip → visit sessions',12,'#cae0bd',500,'middle')+label(504,254,'Bounded gate requests',12,'#cae0bd',500,'middle')+label(504,281,'Queue → ACK → replay',12,'#cae0bd',500,'middle')
for y,title,sub in [(78,'Food-gate actuator','PWM + enable + feedback'),(190,'Wi-Fi / BLE / optional LoRa','Compact event packets → shared hub'),(302,'Care team record','People verify identity and delivery')]:
    b+=rect(720,y,245,82,'#f7ecd9',13,'#e6d8bb')+label(742,y+31,title,16,'#6d7454',700)+label(742,y+58,sub,10,'#979171')
    b+=wire(f'618,232 675,232 675,{y+41} 720,{y+41}','#b2b38a',3)
b+=rect(115,425,770,77,'#edf0e1',14,'#d2ddc3')+label(143,454,'12 V protected input',16,'#63825c',700)+label(143,479,'RFID supply rail',11,'#8e9b7c')+label(440,454,'5 V switched actuator rail',16,'#63825c',700)+label(440,479,'Current budget + bulk capacitance',11,'#8e9b7c')+label(707,454,'Clean 3.3 V',16,'#63825c',700)+label(707,479,'Logic + sensors',11,'#8e9b7c')
b+=label(35,540,'Separate motor and logic regulation, a common return strategy, protected ADC inputs and antenna keep-outs need an actual schematic review.',11,'#8a9878')
save('edge-node-system.svg',1000,565,'Functional sensor and actuator architecture','Sensors feed an ESP32-S3 local controller; the servo and radio are distinct outputs. A protected input supplies separate RFID, actuator and logic power rails.',b)

# Figure 3. Feeder placement concept, including separation from animal access.
b=label(35,35,'FEEDING STATION / MECHANICAL STUDY',14,'#587a5d',700)
b+=rect(95,87,205,175,'#dce8d3',17,'#8cad8b')+label(197,122,'SEALED CONTROL BOX',14,'#4d7353',700,'middle')+label(197,153,'PCB + power protection',12,'#7a9070',500,'middle')
b+=rect(140,182,118,47,'#3c806d',8)+label(199,211,'ESP32 edge node',12,'#dce8cc',600,'middle')
b+=rect(360,96,215,246,'#f3e6c7',22,'#bdac83')+label(469,132,'DRY-FOOD RESERVE',14,'#8e8057',700,'middle')
b+=f'<path d="M374 193h188v113l-59 48h-72l-57-48Z" fill="#dfbd7a"/>'
for x,y in [(397,217),(444,241),(494,213),(530,250),(407,284),(476,297),(516,284)]:b+=f'<ellipse cx="{x}" cy="{y}" rx="9" ry="5" fill="#b18c55"/>'
b+=rect(438,146,62,27,'#849f8a',6)+wire('455,176 455,211 439,228','#9db89b',2,'5 5')+wire('483,176 483,211 499,228','#9db89b',2,'5 5')
b+=rect(417,349,102,24,'#a1bda6',6)+rect(540,326,70,59,'#709c98',10,'#527f7b')+wire('568,350 510,359','#b98765',8)+label(575,408,'FEEDBACK SERVO',11,'#71927b',700,'middle')
b+=f'<path d="M396 391h142l-21 66h-98Z" fill="#f4e9d3" stroke="#c2ae86" stroke-width="2"/><path d="M403 472h156l-17 38H420Z" fill="#d6a186" stroke="#b98b70" stroke-width="2"/>'
b+=label(480,543,'Bowl + food path',13,'#927b60',600,'middle')
b+=f'<path d="M696 489V329a74 74 0 0 1 148 0v160" stroke="#a6bf97" stroke-width="9" fill="none"/>'
b+=label(770,288,'TUNED LF LOOP',12,'#7b9870',700,'middle')+label(770,314,'Close pass near neck',11,'#8e9c7c',500,'middle')
b+=f'<ellipse cx="798" cy="467" rx="66" ry="47" fill="#c4b08c"/><path d="m699 446 5-66 34 25h25l30-26 7 62c11 60-110 66-101 5Z" fill="#d2bc95"/><path d="m715 410 2-15 16 13m42 0-2-15-16 13" fill="#c99884"/><path d="m719 441 11 2m34-2-11 2" stroke="#5d634c" stroke-width="3" stroke-linecap="round"/><path d="m737 453 7 4 6-4" fill="#987b64"/><path d="M844 474c60 18 50-48 28-56" stroke="#b4a27f" stroke-width="17" fill="none" stroke-linecap="round"/>'
b+=label(764,542,'Open approach · no restraint',12,'#8d9b7d',600,'middle')
b+=wire('300,203 328,203 328,350 417,350','#8baa90',3)+wire('299,224 326,224 326,570 690,570 690,422','#9db398',3,'6 5')
b+=wire('480,373 480,388','#9ca98d',4)+label(335,60,'Sonar over hopper',12,'#8e9b7d')+wire('461,66 461,96','#a9b89c',2)
b+=rect(635,69,215,62,'#e7efdc',13,'#c2d5b5')+label(741,95,'SHADED CLIMATE PROBE',12,'#6c8a62',700,'middle')+label(741,116,'Airflow outside warm electronics',10,'#95a07e',500,'middle')
b+=rect(32,353,285,119,'#f5eddd',13,'#e2d6bb')+label(51,382,'DESIGN TARGETS',12,'#8c805e',700)+label(51,408,'Motion guarded from the feeding opening',11,'#a09372')+label(51,430,'Spring bias + jam detection to validate',11,'#a09372')+label(51,452,'Calibrate grams with an external scale',11,'#a09372')
b+=label(35,619,'Concept only: passage geometry, chip-read reliability, food hygiene and power-loss gate behavior have not been physically validated.',11,'#919d7e')
save('edge-node-feeder.svg',1000,645,'Feeder and microchip antenna placement concept','A hopper with overhead distance sensor feeds a guarded servo gate and bowl. The animal approaches an open neck-height RFID antenna. Climate sensing stays outside the controller enclosure.',b)

# Figure 4. A shared hub is local infrastructure, with optional existing backhaul.
b=label(35,35,'MANY SMALL NODES / ONE SHARED PICTURE',14,'#577c5f',700)
for y,n in [(75,'South Point'),(196,'Banyan Corner'),(317,'Palm Courtyard')]:
    b+=rect(48,y,223,82,'#e9f1df',15,'#c5d9b9')+label(73,y+32,n,16,'#577b53',700)+label(73,y+59,'Sense • log • bounded local control',10,'#8e9f7e')
    b+=wire(f'271,{y+41} 377,{y+41} 377,238 439,238','#95b39b',3,'7 6')
b+=rect(439,155,220,169,'#377e6e',21)+label(549,199,'SHARED HUB',20,'#e4edcf',700,'middle')+label(549,229,'Receive → ACK → deduplicate',12,'#c7dcbc',500,'middle')+label(549,257,'Powered + suitable antenna',11,'#c7dcbc',500,'middle')+label(549,286,'Existing backhaul or local service',11,'#c7dcbc',500,'middle')
b+=wire('659,238 752,238','#a5ba93',4)+rect(752,155,208,169,'#f6edd9',20,'#e4d9ba')+label(856,201,'CARE TEAM',20,'#7a8057',700,'middle')+label(856,232,'Visits + needs + verified records',11,'#9c9b7b',500,'middle')+label(856,260,'A radio read stays a sensor event',11,'#9c9b7b',500,'middle')
b+=label(346,109,'Wi-Fi / BLE / LoRa',12,'#7e9877',600,'middle')+label(549,371,'LoRa design: private point-to-point star, not a LoRaWAN concentrator gateway.',11,'#859879',500,'middle')
b+=rect(106,437,787,71,'#eff2e4',13,'#dbe3cf')+label(499,465,'When the hub is offline, local event IDs and sequence numbers remain queued.',13,'#6e885e',600,'middle')+label(499,489,'No cloud-controlled gate dependency. No cellular modem or SIM is included in a node.',11,'#929e7e',500,'middle')
save('edge-node-network.svg',1000,545,'Proposed edge-node to shared-hub topology','Three colony nodes transmit compact events to a powered hub, which acknowledges identities and forwards to the care team using existing backhaul. Local logging continues through hub outages.',b)
print('Wrote four editable SVG concept figures to public/assets/.')
