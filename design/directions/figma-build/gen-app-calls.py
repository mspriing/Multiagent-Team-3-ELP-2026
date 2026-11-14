import json
B=open('builder.js').read()
svgs={n:open(f'icons/{n}.svg').read().strip() for n in ['list','x','caret-down','caret-up']}
B=B.replace("const WT=", "const SVG="+json.dumps(svgs,separators=(',',':'))+";\nconst FAV={'azure.microsoft.com':'99f232a444661441b9720b1630d68d10100dc141','cloud.google.com':'529847a01b8920e69b223112987b74bddc6536de','microsoft.com':'99f232a444661441b9720b1630d68d10100dc141','workspace.google.com':'ce7e56b4bdfe95b45f8591fe4de78640c80dbeba'};\nconst WT=",1)
old="const comp=await figma.getNodeByIdAsync(ICON[n]); if(!comp) continue; const ins=comp.createInstance(); ins.name='Icon/'+n; ins.rescale(g/ins.width);"
assert old in B
B=B.replace(old,"let ins; if(ICON[n]){ const comp=await figma.getNodeByIdAsync(ICON[n]); if(!comp) continue; ins=comp.createInstance(); } else if(SVG[n]){ ins=figma.createNodeFromSvg(SVG[n]); } else continue; ins.name='Icon/'+n; ins.rescale(g/ins.width);")
old="r.fills=[sol([.9,.91,.92,1])]; f.appendChild(r); }"
assert old in B
B=B.replace(old,"const dm=(src.match(/domain=([^&]+)/)||[])[1]; r.fills=FAV[dm]?[{type:'IMAGE',imageHash:FAV[dm],scaleMode:'FILL'}]:[sol([.9,.91,.92,1])]; f.appendChild(r); }")
DN={'new-list':'New chat with sidebar','new-empty':'New chat, no saved conversations','thread':'Conversation','sources':'Sources open','followup':'Follow-up researching','loading':'Loading conversation','missing':"Couldn't load conversation",'thread-closed':'Sidebar closed','full-thread':'Whole conversation page'}
PN={'drawer':'Conversations drawer','drawer-empty':'Drawer, no saved conversations','thread':'Conversation','sources':'Sources open','followup':'Follow-up researching','loading':'Loading conversation','missing':"Couldn't load conversation",'full-thread':'Whole conversation page'}
D=['new-list','new-empty','thread','sources','followup','loading','missing','thread-closed']
P=['drawer','drawer-empty','thread','sources','followup','loading','missing']
jobs=[]
for i,s in enumerate(D): jobs.append((f'app-{s}-1440',f'Desktop 1440 / {DN[s]}',i*1560,7600))
for i,s in enumerate(P): jobs.append((f'app-{s}-390',f'Phone 390 / {PN[s]}',i*1560,8660))
jobs.append(('app-full-thread-1440','Desktop 1440 / Whole conversation page',0,9700))
jobs.append(('app-full-thread-390','Phone 390 / Whole conversation page',1560,9700))
groups=[jobs[0:4],jobs[4:8],jobs[8:15],jobs[15:17]]
for gi,g in enumerate(groups):
  A={}
  for k,_,_,_ in g: A.update(json.load(open(k+'.c.json')))
  pre="const page=figma.root.children.find(p=>p.name==='Master'); await figma.setCurrentPageAsync(page);\n"
  extra=''
  if gi==0:
    extra="{ const t=figma.createText(); t.fontName={family:'Geist',style:'SemiBold'}; t.characters='Conversations: sidebar, follow-ups, sources, loading (Nov 9)'; t.fontSize=56; t.fills=[sol([.122,.125,.161,1])]; page.appendChild(t); t.x=0; t.y=7440; t.name='Label / Conversations'; }\n"
  code=pre+B+"\nconst A="+json.dumps(A,separators=(',',':'))+";\nconst J="+json.dumps([[n,k,x,y] for k,n,x,y in g],separators=(',',':'))+";\n"+extra+"const ids={}; for (const [n,k,x,y] of J) ids[n]=await build(n,A[k],x,y,page);\nreturn ids;"
  open(f'call-app-{gi+1}.js','w').write(code); print(gi+1,len(code))
