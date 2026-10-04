"""Independent Qimen oracle: retain unmodified kinqimen pan(1) and a docs §3 projection.
Usage: venv Python (kinqimen 0.0.6.6, ephem 4.2.1, sxtwl 2.0.6), terms JSON from lunar-typescript.
The projection is deliberately separate: never relabel upstream disagreements as raw matches.
"""
import sys, json, pathlib, datetime, kinqimen
sys.path.insert(0,kinqimen.__path__[0])  # Released wheel uses absolute import config.
from kinqimen.kinqimen import Qimen
import config
TERMS=json.loads(pathlib.Path(sys.argv[1]).read_text())
NAMES=['立春','雨水','驚蟄','春分','清明','穀雨','立夏','小滿','芒種','夏至','小暑','大暑','立秋','處暑','白露','秋分','寒露','霜降','立冬','小雪','大雪','冬至','小寒','大寒']
KEYS=['li_chun','yu_shui','jing_zhe','chun_fen','qing_ming','gu_yu','li_xia','xiao_man','mang_zhong','xia_zhi','xiao_shu','da_shu','li_qiu','chu_shu','bai_lu','qiu_fen','han_lu','shuang_jiang','li_dong','xiao_xue','da_xue','dong_zhi','xiao_han','da_han']
TABLE=[[8,5,2],[9,6,3],[1,7,4],[3,9,6],[4,1,7],[5,2,8],[4,1,7],[5,2,8],[6,3,9],[9,3,6],[8,2,5],[7,1,4],[2,5,8],[1,4,7],[9,3,6],[7,1,4],[6,9,3],[5,8,2],[6,9,3],[5,8,2],[4,7,1],[1,7,4],[2,8,5],[3,9,6]]
STEMS=['jia','yi','bing','ding','wu_stem','ji','geng','xin','ren','gui']; BRANCHES=['zi','chou','yin','mao','chen','si','wu','wei','shen','you','xu','hai']
RING=[1,8,3,4,9,2,7,6]; GONG=list('坎坤震巽中乾兌艮離'); STAR=['tian_peng','tian_rui','tian_chong','tian_fu','tian_qin','tian_xin','tian_zhu','tian_ren','tian_ying'];GATE=['xiu','si','shang','du',None,'kai','jing','sheng','jing_view'];DEITY=['zhi_fu','teng_she','tai_yin','liu_he','bai_hu','xuan_wu','jiu_di','jiu_tian']
def parse(s): return datetime.datetime.fromisoformat(s.split('[')[0])
def projection(at,term,next_term):
    clock=parse(at); t=parse(term['at']);term_day=t.date()+datetime.timedelta(days=1 if t.hour==23 else 0);elapsed=(clock.date()-term_day).days
    if clock.hour==23:elapsed+=1
    name=term['name']; n=KEYS.index(name); yi=0 if elapsed>=15 else elapsed//5
    ju=TABLE[KEYS.index(next_term['name']) if elapsed>=15 else n][yi];dun='yang' if n<9 or n>=21 else 'yin'; sign=1 if dun=='yang' else -1
    gz=config.gangzhi(clock.year,clock.month,clock.day,clock.hour,clock.minute)
    pillars={k:{'stem':STEMS[list('甲乙丙丁戊己庚辛壬癸').index(v[0])],'branch':BRANCHES[list('子丑寅卯辰巳午未申酉戌亥').index(v[1])]} for k,v in zip(['year','month','day','hour'],gz)}
    h=pillars['hour']; hi=next(i for i in range(60) if i%10==STEMS.index(h['stem']) and i%12==BRANCHES.index(h['branch']));inst=['wu_stem','ji','geng','xin','ren','gui','ding','bing','yi'];earth=['']*9
    for i,s in enumerate(inst):earth[(ju-1+sign*i)%9]=s
    xun=hi//10; origin=earth.index(inst[xun])+1; source=2 if origin==5 else origin
    target=earth.index(inst[xun] if h['stem']=='jia' else h['stem'])+1;target=2 if target==5 else target
    gate_target=(origin-1+sign*(hi%10))%9+1;gate_target=2 if gate_target==5 else gate_target
    so=(RING.index(target)-RING.index(source))%8;go=(RING.index(gate_target)-RING.index(source))%8
    palaces=[]
    for i in range(1,10):
        ss=5 if i==5 else RING[(RING.index(i)-so)%8];gs=5 if i==5 else RING[(RING.index(i)-go)%8]
        p={'index':i,'earthStem':earth[i-1],'skyStem':earth[ss-1],'star':STAR[ss-1],'gate':GATE[gs-1],'deity':None if i==5 else DEITY[((RING.index(i)-RING.index(target))*sign)%8]}
        if ss==2:p['hiddenStem']=earth[4]
        palaces.append(p)
    return {'pillars':pillars,'dun':dun,'ju':ju,'solarTerm':{'name':name,'yuan':['upper','middle','lower'][yi]},'xunShou':{'stem':'jia','branch':BRANCHES[(xun*10)%12],'yi':inst[xun]},'zhiFu':{'star':STAR[origin-1],'palaceEarth':origin,'palaceSky':target},'zhiShi':{'gate':GATE[source-1],'palaceEarth':source,'palaceSky':gate_target},'palaces':palaces}
inputs=[]
for i,term in enumerate(TERMS):
    # Exercise upper/middle/lower throughout the 24-term year, clear of ephemeris minute uncertainty.
    dt=parse(term['at'])+datetime.timedelta(days=[1,6,11][i%3]);dt=dt.replace(hour=[1,9,15,21][i%4],minute=30,second=0)
    inputs.append(dt.isoformat(timespec='minutes')+'[Asia/Shanghai]')
inputs+=['2026-10-04T15:30+08:00[Asia/Shanghai]','2026-06-21T23:30+08:00[Asia/Shanghai]','2026-12-22T00:30+08:00[Asia/Shanghai]','2026-03-20T12:30+08:00[Asia/Shanghai]','2026-08-08T05:30+08:00[Asia/Shanghai]','2026-02-05T19:30+08:00[Asia/Shanghai]']
out=pathlib.Path('packages/engine/test/fixtures/qimen-baseline');out.mkdir(parents=True,exist_ok=True)
for i,at in enumerate(inputs):
    dt=parse(at); preceding=[t for t in TERMS if parse(t['at'])<=dt];term=preceding[-1];index=TERMS.index(term);next_term=TERMS[index+1] if index+1<len(TERMS) else {'name':'xiao_han'}
    try:raw=Qimen(dt.year,dt.month,dt.day,dt.hour,dt.minute).pan(1)
    except Exception as e:raise RuntimeError(f'kinqimen failed at {at}') from e
    expected=projection(at,term,next_term)
    row={'source':{'package':'kinqimen','version':'0.0.6.6','method':'pan(1)','ephem':'4.2.1','sxtwl':'2.0.6','timeZone':'Asia/Shanghai'},'at':at,'raw':raw,'documented':expected,'adapter':'docs §3.2 elapsed-day yuan; §3.4–3.5 center Kun2 hosting. Raw upstream results remain unchanged.'}
    (out/f'{i+1:02}.json').write_text(json.dumps(row,ensure_ascii=False,indent=2)+'\n')
print(f'{len(inputs)} fixtures written; {len(set(f["name"] for f in TERMS))} solar terms')
