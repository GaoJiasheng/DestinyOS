"""Merge MIT sources; run with venv Python plus OpenCC/PyYAML, source checkouts as arguments."""
import json, re, sys, pathlib, subprocess
import yaml
from opencc import OpenCC
first, second = map(pathlib.Path, sys.argv[1:3])
cc=OpenCC('t2s')
def simplify(s):
    return cc.convert(s.replace('乾','QIAN_PLACEHOLDER')).replace('QIAN_PLACEHOLDER','乾')
a=json.loads((first/'zh-TW/64gua.json').read_text())
b=json.loads((second/'data/zhouyi.json').read_text())
trigrams={'111':'qian','110':'dui','101':'li','100':'zhen','011':'xun','010':'kan','001':'gen','000':'kun'}
images={'qian':'天','dui':'泽','li':'火','zhen':'雷','xun':'风','kan':'水','gen':'山','kun':'地'}
pinyin='qian kun zhun meng xu song shi bi xiao_xu lv tai pi tong_ren da_you qian yu sui gu lin guan shi_he bi bo fu wu_wang da_xu yi da_guo kan li xian heng dun da_zhuang jin ming_yi jia_ren kui jian jie sun yi guai gou cui sheng kun jing ge ding zhen gen jian gui_mei feng lv xun dui huan jie zhong_fu xiao_guo ji_ji wei_ji'.split()
english=['The Creative','The Receptive','Difficulty at the Beginning','Youthful Folly','Waiting','Conflict','The Army','Holding Together','The Taming Power of the Small','Treading','Peace','Standstill','Fellowship with Men','Possession in Great Measure','Modesty','Enthusiasm','Following','Work on What Has Been Spoiled','Approach','Contemplation','Biting Through','Grace','Splitting Apart','Return','Innocence','The Taming Power of the Great','The Corners of the Mouth','Preponderance of the Great','The Abysmal','The Clinging','Influence','Duration','Retreat','The Power of the Great','Progress','Darkening of the Light','The Family','Opposition','Obstruction','Deliverance','Decrease','Increase','Break-through','Coming to Meet','Gathering Together','Pushing Upward','Oppression','The Well','Revolution','The Cauldron','The Arousing','Keeping Still','Development','The Marrying Maiden','Abundance','The Wanderer','The Gentle','The Joyous','Dispersion','Limitation','Inner Truth','Preponderance of the Small','After Completion','Before Completion']
def clean(s):
    return simplify(re.sub(r'[（(][^）)]*[A-Za-zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜüńňǹḿ][^）)]*[）)]','',s)).replace('初噬告','初筮告').replace('繋','系')
rows=[]; audit=[]
for i,g in enumerate(a):
    name=simplify(g['name']); lo=trigrams[g['id'][:3]]; up=trigrams[g['id'][3:]]
    candidates=[(k,v) for k,v in b.items() if (k.endswith(name) and k.startswith(images[up])) or (up==lo and k==name+'为'+images[up])]
    if not candidates:
        aliases={'遯':'遁','噬嗑':'噬嗑'}
        candidates=[(k,v) for k,v in b.items() if k.endswith(aliases.get(name,name))]
    assert len(candidates)==1,(name,candidates)
    title,other=candidates[0]
    yao=list(other['yao'].items())
    if len(yao)<6:
        yao=[tuple(text.split('：',1)) for text in g['yao_ci']]
    assert len(yao)>=6
    # DESIGN-GAP: Prefer the simplified source for overlapping gua/yao; retain complete freizl commentaries, recording text variants.
    guaci=clean(other['gua_ci']); lines=[]
    for pos, (label,text) in enumerate(yao[:6],1):
        lines.append({'position':pos,'original':clean(label+'：'+text),'image':clean(g['xiao_xiang'][pos-1]),'meaning':{'zh':'','en':''}})
    rows.append({'number':i+1,'key':f'hexagram_{i+1:02}','name':name,'pinyin':pinyin[i].replace('_',' '),'englishName':english[i], 'upper':up,'lower':lo,'lines':[int(v) for v in g['id']], 'judgment':guaci,'tuan':clean(g['tuan_ci']),'image':clean(g['da_xiang']),'yao':lines,'useNineSix':{'original':clean(g['yao_ci'][6]),'image':clean(g['xiao_xiang'][6])} if i<2 else None,'meaning':{'zh':'','en':''},'keywords':['','',''], 'guidance':{k:{'zh':'','en':''} for k in ['career','wealth','love','health','study','travel','decision','other']}})
    audit.append({'number':i+1,'sourceTitle':title,'guaVariants':[clean(g['gua_ci']),guaci],'yaoVariants':[[clean(g['yao_ci'][j]),lines[j]['original']] for j in range(6) if clean(g['yao_ci'][j])!=lines[j]['original']]})
out=pathlib.Path('packages/content/iching')
(out/'hexagrams.yaml').write_text(yaml.safe_dump(rows,allow_unicode=True,sort_keys=False,width=120))
(out/'source-audit.json').write_text(json.dumps({'sources':[{'repository':'https://github.com/freizl/yijing' if p==first else 'https://github.com/Johnson-Jia/liuyao-divination','commit':subprocess.check_output(['git','-C',str(p),'rev-parse','HEAD'],text=True).strip()} for p in [first,second]],'policy':'Simplified gua/yao text plus converted complete tuan/xiang/xiao-xiang. Pinyin annotations removed; 初噬告 corrected to 初筮告. Variants retained for review.','variants':audit},ensure_ascii=False,indent=2)+'\n')
(out/'LICENSE-freizl.txt').write_text((first/'LICENSE').read_text())
(out/'LICENSE-Johnson-Jia.txt').write_text((second/'LICENSE').read_text())
# DESIGN-GAP: Hexagram keys are unspecified; numbered keys avoid homophones such as 乾/谦, 坤/困, 履/旅.
# Engine uses only topology, without depending on content or IO.
pathlib.Path('packages/engine/src/iching/hexagram-data.ts').write_text('// Generated King Wen topology; provenance: packages/content/iching/source-audit.json.\nexport const HEXAGRAM_DATA = '+json.dumps([{'number':r['number'],'key':r['key'],'lines':r['lines'],'upper':r['upper'],'lower':r['lower']} for r in rows],ensure_ascii=False,indent=2)+' as const;\n')
