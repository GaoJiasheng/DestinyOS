"""Offline, independent oracles. Never imports engine or reads its outputs.
Run with the disposable venv described in README.md. JSON is the only CI input.
"""
import calendar
import datetime as dt
import functools
import importlib.metadata
import json
import math
from pathlib import Path
import random
import sys
from zoneinfo import ZoneInfo

import sxtwl
import swisseph as swe
import kinqimen
from iztro_py import astro

# Released kinqimen wheel uses absolute imports; no repository path is injected.
sys.path.insert(0, str(Path(kinqimen.__file__).parent))
from kinqimen.kinqimen import Qimen
import config as kin_config

OUT = Path(__file__).resolve().parents[1] / 'fixtures' / 'xval'
SEED = 0xD3571
RNG = random.Random(SEED)
UTC = dt.timezone.utc
CST = dt.timezone(dt.timedelta(hours=8))
STEMS = ['jia', 'yi', 'bing', 'ding', 'wu_stem', 'ji', 'geng', 'xin', 'ren', 'gui']
BRANCHES = ['zi', 'chou', 'yin', 'mao', 'chen', 'si', 'wu', 'wei', 'shen', 'you', 'xu', 'hai']
TERM_KEYS = ['dong_zhi', 'xiao_han', 'da_han', 'li_chun', 'yu_shui', 'jing_zhe',
             'chun_fen', 'qing_ming', 'gu_yu', 'li_xia', 'xiao_man', 'mang_zhong',
             'xia_zhi', 'xiao_shu', 'da_shu', 'li_qiu', 'chu_shu', 'bai_lu',
             'qiu_fen', 'han_lu', 'shuang_jiang', 'li_dong', 'xiao_xue', 'da_xue']
JU = [[1,7,4],[2,8,5],[3,9,6],[8,5,2],[9,6,3],[1,7,4],[3,9,6],[4,1,7],
      [5,2,8],[4,1,7],[5,2,8],[6,3,9],[9,3,6],[8,2,5],[7,1,4],[2,5,8],
      [1,4,7],[9,3,6],[7,1,4],[6,9,3],[5,8,2],[6,9,3],[5,8,2],[4,7,1]]
BODIES = dict(sun=swe.SUN, moon=swe.MOON, mercury=swe.MERCURY, venus=swe.VENUS,
              mars=swe.MARS, jupiter=swe.JUPITER, saturn=swe.SATURN, uranus=swe.URANUS,
              neptune=swe.NEPTUNE, pluto=swe.PLUTO, north_node=swe.TRUE_NODE,
              mean_node=swe.MEAN_NODE, lilith=swe.MEAN_APOG)
LORDS = ['ketu','shukra','surya','chandra','mangala','rahu','guru','shani','budha']
YEARS = [7,20,6,10,7,18,16,19,17]
PLACES = [('Beijing',39.90,116.40,'Asia/Shanghai'),('New York',40.71,-74.01,'America/New_York'),
          ('Sydney',-33.87,151.21,'Australia/Sydney'),('London',51.51,-0.12,'Europe/London'),
          ('Sao Paulo',-23.55,-46.63,'America/Sao_Paulo'),('Auckland',-36.85,174.76,'Pacific/Auckland'),
          ('Los Angeles',34.05,-118.24,'America/Los_Angeles'),('Delhi',28.61,77.21,'Asia/Kolkata'),
          ('Tromso',69.65,18.96,'Europe/Oslo'),('Ushuaia',-54.80,-68.30,'America/Argentina/Ushuaia'),
          ('Cape Town',-33.92,18.42,'Africa/Johannesburg'),('Singapore',1.35,103.82,'Asia/Singapore')]


def jd(t):
    return t.timestamp()/86400 + 2440587.5


def instant(j):
    return dt.datetime.fromtimestamp((j-2440587.5)*86400, UTC)


@functools.lru_cache(None)
def terms(year):
    result = []
    start = dt.date(year-1, 1, 1)
    for i in range((dt.date(year+2,1,1)-start).days):
        t = start + dt.timedelta(days=i)
        d = sxtwl.fromSolar(t.year,t.month,t.day)
        if d.hasJieQi():
            result.append((d.getJieQiJD()-8/24, d.getJieQi()))
    return result


def gz(g):
    return dict(stem=STEMS[g.tg], branch=BRANCHES[g.dz])


def lunar(t):
    d = sxtwl.fromSolar(t.year,t.month,t.day)
    return dict(year=d.getLunarYear(),month=d.getLunarMonth(),day=d.getLunarDay(),isLeap=d.isLunarLeap())


def pillars(clock, term_jd, unknown=False, split=False):
    # sxtwl year/month default changes at midnight of jie day. Explicitly adapt to exact instant.
    cst = instant(term_jd).astimezone(CST)
    frame = sxtwl.fromSolar(cst.year,cst.month,cst.day)
    if frame.hasJieQi() and frame.getJieQi()%2 == 1 and term_jd < frame.getJieQiJD()-8/24:
        frame = frame.before(1)
    d = sxtwl.fromSolar(clock.year,clock.month,clock.day)
    day = d.after(1) if clock.hour==23 and not split else d
    return dict(year=gz(frame.getYearGZ()),month=gz(frame.getMonthGZ()),day=gz(day.getDayGZ()),
                hour=None if unknown else gz(d.getHourGZ(clock.hour)))


def ziwei(clock,gender):
    c = astro.by_solar(clock.strftime('%Y-%m-%d'),(clock.hour+1)//2,'女' if gender=='female' else '男')
    stars = {'ziweiMaj':'zi_wei','tianjiMaj':'tian_ji','taiyangMaj':'tai_yang','wuquMaj':'wu_qu',
             'tiantongMaj':'tian_tong','lianzhenMaj':'lian_zhen','tianfuMaj':'tian_fu','taiyinMaj':'tai_yin',
             'tanlangMaj':'tan_lang','jumenMaj':'ju_men','tianxiangMaj':'tian_xiang','tianliangMaj':'tian_liang',
             'qishaMaj':'qi_sha','pojunMaj':'po_jun'}
    return dict(soul=c.earthly_branch_of_soul_palace.replace('Earthly',''),
                body=c.earthly_branch_of_body_palace.replace('Earthly',''),
                fiveElementsClass=int(c.raw_five_elements_class.value),
                majorStars={p.earthly_branch.replace('Earthly',''):[stars[s.name] for s in p.major_stars] for p in c.palaces})


def birth_ref(b):
    zone = ZoneInfo(b['place']['tz'])
    clock = dt.datetime(b['year'],b['month'],b['day'],12 if b['timeUnknown'] else b['hour'],
                        0 if b['timeUnknown'] else b['minute'],tzinfo=zone)
    # Reject nonexistent clocks during random sampling; overlap uses fold=0, matching Temporal compatible.
    if clock.astimezone(UTC).astimezone(zone).replace(tzinfo=None) != clock.replace(tzinfo=None):
        return None
    j = jd(clock)
    eot = swe.time_equ(j)*1440
    correction = b['place']['lng']*4-clock.utcoffset().total_seconds()/60
    solar = clock.replace(tzinfo=None)+dt.timedelta(minutes=correction+eot)
    solar = solar.replace(second=0,microsecond=0)
    corrected = clock.replace(tzinfo=None) if b['timeUnknown'] else solar
    pos = {key:swe.calc_ut(j,value,swe.FLG_MOSEPH|swe.FLG_SPEED)[0][0] for key,value in BODIES.items()}
    swe.set_sid_mode(swe.SIDM_LAHIRI)
    aya = swe.get_ayanamsa_ut(j)
    moon = (pos['moon']-aya)%360
    n = int(moon/(40/3))
    end = j+(1-(moon/(40/3)-n))*YEARS[n%9]*365.25
    houses = {}
    for key,code in [('placidus',b'P'),('whole_sign',b'W')]:
        # Docs require >66° Whole Sign even when Swiss still converges.
        actual = b'W' if key=='placidus' and abs(b['place']['lat'])>66 else code
        cusps,axes = swe.houses_ex(j,b['place']['lat'],b['place']['lng'],actual)
        houses[key] = dict(cusps=list(cusps),asc=axes[0],mc=axes[1])
    mansion = dict(index=n,pada=int((moon%(40/3))/(10/3))+1,lord=LORDS[n%9],firstEndJD=end)
    # Independently integrate the whole local civil day for unknown-time uncertainty.
    begin = clock.replace(hour=0,minute=0)
    next_day = begin+dt.timedelta(days=1)
    edge = [int(((swe.calc_ut(jd(t),swe.MOON,swe.FLG_MOSEPH)[0][0]-swe.get_ayanamsa_ut(jd(t)))%360)/(40/3))
            for t in [begin,next_day-dt.timedelta(seconds=1)]]
    mansion['possibleIndices'] = [(edge[0]+i)%27 for i in range((edge[1]-edge[0])%27+1)]
    # Bazi year/month and luck jie distances are physical instants; solar changes day/hour only.
    ps = pillars(corrected,j,b['timeUnknown'])
    forward = (STEMS.index(ps['year']['stem'])%2 == 0) == (b['gender'] != 'female')
    js = [(tj,n) for tj,n in terms(clock.year) if n%2 == 1]
    previous = max(v for v in js if v[0]<=j)
    following = min(v for v in js if v[0]>j)
    boundary = following if forward else previous
    luck_days = int(abs(boundary[0]-j)*1440/12)
    result = dict(utc=clock.astimezone(UTC).isoformat(),jd=j,lunar=lunar(clock),
                  solar=dict(offsetMinutes=correction+eot,local=solar.isoformat(timespec='minutes')),
                  pillars=ps,
                  luck=dict(direction='forward' if forward else 'backward',ageDays=luck_days),
                  jie=dict(previous=dict(name=TERM_KEYS[previous[1]],jd=previous[0]),
                           following=dict(name=TERM_KEYS[following[1]],jd=following[0])),
                  splitPillars=pillars(corrected,j,b['timeUnknown'],True),
                  positions=pos,ayanamsa=aya,houses=houses,moon=mansion,
                  ziwei=None if b['timeUnknown'] else ziwei(corrected,b['gender']))
    return result


def birth(t,place,unknown=False):
    name,lat,lng,tz = place
    return dict(calendar='gregorian',year=t.year,month=t.month,day=t.day,hour=t.hour,minute=t.minute,
                timeUnknown=unknown,gender=RNG.choice(['male','female','unspecified']),
                place=dict(name=name,lat=lat,lng=lng,tz=tz))


def cast_ref(t,label):
    t = t.astimezone(ZoneInfo('Asia/Shanghai'))
    j = jd(t)
    ts = terms(t.year)
    idx = max(i for i,v in enumerate(ts) if v[0]<=j)
    current,nxt = ts[idx],ts[idx+1]
    term_clock = instant(current[0]).astimezone(ZoneInfo('Asia/Shanghai'))
    term_day = term_clock.date()+dt.timedelta(days=int(term_clock.hour==23))
    zi_day = t.date()+dt.timedelta(days=int(t.hour==23))
    elapsed = (zi_day-term_day).days
    yuan = 0 if elapsed>=15 else elapsed//5
    selected = nxt[1] if elapsed>=15 else current[1]
    ju = JU[selected][yuan]
    dun = '陽遁' if current[1]<12 else '陰遁'
    q = Qimen(t.year,t.month,t.day,t.hour,t.minute)
    raw = q.pan(1)
    # Separate, explicit school adapter: force ONLY documented ju into independent library.
    original = kin_config.qimen_ju_name_chaibu
    try:
        kin_config.qimen_ju_name_chaibu = lambda *args: f'{dun}{list("一二三四五六七八九")[ju-1]}局{["上","中","下"][yuan]}元'
        adapted = q.pan(1)
    finally:
        kin_config.qimen_ju_name_chaibu = original
    lu = lunar(t)
    source = [((lu['year']-4)%12)+1,lu['month'],lu['day'],((t.hour+1)//2)%12+1]
    base = sum(source[:3]);total = base+source[3]
    return dict(at=t.isoformat(timespec='minutes')+'[Asia/Shanghai]',label=label,
                reference=dict(pillars=pillars(t,j),lunar=lu,term=TERM_KEYS[current[1]],
                               termJD=current[0],yuan=['upper','middle','lower'][yuan],ju=ju,
                               dun='yang' if dun=='陽遁' else 'yin',elapsedDays=elapsed,
                               meihua=dict(source=source,upper=base%8 or 8,lower=total%8 or 8,moving=total%6 or 6)),
                kinqimenRaw=raw,kinqimenDocumentedJu=adapted)


def write(name,value):
    (OUT/name).write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n')


def main():
    OUT.mkdir(parents=True,exist_ok=True)
    rows = []
    while len(rows)<300:
        i=len(rows)
        year = 1900 if i==0 else 2030 if i==299 else RNG.randint(1900,2030)
        month=RNG.randint(1,12);day=RNG.randint(1,calendar.monthrange(year,month)[1])
        hour=23 if i%5==0 else 0 if i%7==0 else RNG.randint(0,23)
        t=dt.datetime(year,month,day,hour,RNG.randint(0,59))
        b=birth(t,PLACES[i%len(PLACES)],i%10==3)
        ref=birth_ref(b)
        if ref is not None: rows.append(dict(id=f'birth-{i:03}',input=b,reference=ref))
    write('births.json',rows)
    # ±2 min around all 24 independently computed terms (including 1900/1988 DST/2000/2030).
    edges=[]
    for year in [1900,1988,2000,2030]:
        for j,n in terms(year):
            if instant(j).astimezone(CST).year!=year:continue
            for delta in [-2,2]:
                t=(instant(j).astimezone(CST)+dt.timedelta(minutes=delta)).replace(second=0,microsecond=0)
                p=PLACES[1] if year==1988 else PLACES[0]
                local=t.astimezone(ZoneInfo(p[3]));b=birth(local,p)
                edges.append(dict(id=f'{year}-{TERM_KEYS[n]}-{delta}',input=b,reference=birth_ref(b),term=dict(name=TERM_KEYS[n],jd=j)))
    write('term-edges.json',edges)
    casts=[]
    for i in range(30):
        t=dt.datetime(RNG.randint(1900,2030),RNG.randint(1,12),RNG.randint(1,28),RNG.randint(0,23),RNG.randint(0,59),tzinfo=CST)
        casts.append(cast_ref(t,'random'))
    # Civil midnight and late-Zi boundaries at 5/10/15 elapsed days, both sides.
    ts=[v for v in terms(2026) if instant(v[0]).astimezone(CST).year==2026]
    for i in range(30):
        tj,_=ts[i%len(ts)];term=instant(tj).astimezone(CST)
        day=term.date()+dt.timedelta(days=int(term.hour==23)+[5,10,15][i//10])
        t=dt.datetime.combine(day,dt.time(0,0),CST)+dt.timedelta(minutes=-61 if i%2==0 else -60)
        casts.append(cast_ref(t,f'yuan-{[5,10,15][i//10]}-day-{"before" if i%2==0 else "after"}'))
    write('casts.json',casts)
    # Exact mansion/Pada boundaries and analytic Dasha fractions, independent of ephemeris error.
    nak=[]
    for k in range(108):
        for delta in [-1e-7,0,1e-7]:
            lon=(k*10/3+delta)%360
            n=int(lon/(40/3)+1e-12);p=int(lon/(10/3)+1e-12)%4+1
            nak.append(dict(lon=lon,index=n,pada=p,lord=LORDS[n%9],
                            remainingDays=(1-(lon/(40/3)-n))*YEARS[n%9]*365.25))
    write('nakshatra-edges.json',nak)
    write('manifest.json',dict(seed=SEED,births=len(rows),casts=len(casts),termEdges=len(edges),
         libraries={p:importlib.metadata.version(p) for p in ['sxtwl','pyswisseph','kinqimen','ephem','iztro-py']},
         swissBackend='Moshier analytical, no external ephemeris files',
         ziweiProvenance='iztro-py pure Python reimplementation; shares iztro algorithm, not JS runtime',
         excludedBodies={'chiron':'No Moshier Chiron; runtime two-body approximation, not verified here'},
         schools=dict(qimen='docs elapsed-day yuan vs kinqimen fu-tou; forced ju results stored separately',
                      bazi='sxtwl day-level jie adapted to exact sxtwl instant; zi_unified/split separately')))
    print(f'{len(rows)} births, {len(casts)} casts, {len(edges)} term edges generated independently')


if __name__=='__main__':
    main()
