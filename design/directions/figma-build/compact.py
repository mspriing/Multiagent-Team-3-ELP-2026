import json
def r(v): return round(v,1) if isinstance(v,float) else v
def c(col): return [round(x,3) for x in col] if col else None
def hv(v): return {kk:round(vv,1) for kk,vv in v.items()} if isinstance(v,dict) else round(v,3)
out={}
import sys
NAMES = [sys.argv[1]] if len(sys.argv) > 1 else [f'{st}-{w}' for st in ['ask','typed','working','answer','copied','error-net','error-server'] for w in [1440,390]]
for nm in NAMES:
  if True:
    d=json.load(open(f'{nm}.json')); L=[]
    for l in d['layers']:
      if l['k']=='box': L.append(['b',r(l['x']),r(l['y']),r(l['w']),r(l['h']),c(l['bg']),r(l['blur']),r(l['radius']),l['shadow'] and [c(l['shadow']['color']),l['shadow']['x'],l['shadow']['y'],l['shadow']['blur'],l['shadow']['spread']],l['border'] and [l['border']['w'],c(l['border']['c'])],(l['cls'] or l['tag'])[:24]])
      elif l['k']=='icon': L.append(['i',l['name'],r(l['x']),r(l['y']),r(l['w']),r(l['h']),c(l['color']),r(l['glyph']),c(l['bg']),r(l['radius'])])
      elif l['k']=='img': L.append(['g',r(l['x']),r(l['y']),r(l['w']),r(l['h']),l['src'],r(l['radius'])])
      elif l['k']=='svg': L.append(['s',r(l['x']),r(l['y']),r(l['w']),r(l['h']),l['svg']])
      elif l['k']=='feather': L.append(['f',r(l['x']),r(l['y']),r(l['w']),r(l['h']),l['f'],c(l['color'])])
      elif l['k']=='dot': L.append(['d',r(l['x']),r(l['y']),l['d'],c(l['color'])])
      else:
        rg=[[x['s'],x['e'],c(x['color']),x['weight'],1 if x['u'] else 0,1 if x['badge'] else 0] for x in l['ranges'] if x['badge'] or x['u'] or x['weight']!=l['weight'] or c(x['color'])!=c(l['color'])]
        L.append(['t',l['text'],r(l['x']),r(l['y']),r(l['w']),r(l['h']),1 if l['multi'] else 0,r(l['size']),l['weight'],r(l['lh']),r(l['ls']),c(l['color']),l['align'][0],rg])
    out[nm]={'W':d['W'],'H':d['H'],'VH':d.get('VH',d['H']),'heat':{k:hv(v) for k,v in d['heat'].items()},'L':L}
json.dump(out,open('all.json' if len(sys.argv)==1 else sys.argv[1]+'.c.json','w'),separators=(',',':'))
for k,v in out.items(): print(k,len(json.dumps(v,separators=(',',':'))))
