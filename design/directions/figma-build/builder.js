const SH='2d4c7d6e-2f45-4c15-8d54-d73330e4537d/b1290163738ac646d886398b03080a91bf618161';
const KEYS={calm:'2223313668:2515499520',heat:'2479277377:866816204',steps:'2749202968:91252086',cool:'2817391737:243349778',speed:'2819734563:1538716866',refraction:'2827717885:2327425690',coolStrength:'2973295810:3688976570',style:'3690253666:2931448088',hot2:'4010734628:774540962',grain:'4147693045:2222518238',hot:'4148040030:1496491354',flutes:'4249803101:3366875456'};
const ICON={'compass':'35:58','chart-bar':'35:64','pen-nib':'35:67','github-logo':'35:97','magnifying-glass':'35:61','link':'35:76','copy':'35:79','plus-circle':'35:82','warning':'35:88','arrow-clockwise':'35:91','arrow-up':'35:100','check-circle':'35:73','globe':'35:94'};
const WT={400:'Regular',500:'Medium',600:'SemiBold',700:'Bold'};
for (const s of Object.values(WT)) await figma.loadFontAsync({family:'Geist',style:s});
await figma.importShaderById(SH);
const sol=(c)=>({type:'SOLID',color:{r:c[0],g:c[1],b:c[2]},opacity:c[3]??1});
async function build(name,D,X,Y,parent){
  const f=figma.createFrame(); f.name=name; f.resize(D.W,D.H); f.x=X; f.y=Y; f.clipsContent=true; f.fills=[sol([.122,.125,.161,1])]; parent.appendChild(f);
  const bg=figma.createRectangle(); bg.name='Heat (ELP isotherm heat, Fluted blended)'; bg.resize(D.W,D.VH||D.H); f.appendChild(bg);
  const pr={style:3,flutes:44,refraction:.04,grain:1,steps:9,...D.heat}; const props={}; for(const k in pr) if(KEYS[k]) props[KEYS[k]]=pr[k];
  bg.fills=[{type:'SHADER',id:SH,properties:props}];
  const cites=[]; const badgeDigits=[];
  for(const l of D.L){
    if(l[0]==='b'){ const [_,x,y,w,h,c,blur,rad,sh,bd,nm]=l; const r=figma.createRectangle(); r.name=nm||'box'; r.resize(Math.max(w,.5),Math.max(h,.5)); r.x=x; r.y=y; r.cornerRadius=rad; r.fills=c&&c[3]>0?[sol(c)]:[];
      const ef=[]; if(blur) ef.push({type:'BACKGROUND_BLUR',radius:blur,visible:true}); if(sh) ef.push({type:'DROP_SHADOW',color:{r:sh[0][0],g:sh[0][1],b:sh[0][2],a:sh[0][3]},offset:{x:sh[1],y:sh[2]},radius:sh[3],spread:sh[4],visible:true,blendMode:'NORMAL'}); r.effects=ef;
      if(bd){ r.strokes=[sol(bd[1])]; r.strokeWeight=bd[0]; r.strokeAlign='INSIDE'; }
      f.appendChild(r); if(/cite/.test(nm||'')) cites.push(r); }
    else if(l[0]==='i'){ const [_,n,x,y,w,h,c,g,bgc,rad]=l; if(bgc&&bgc[3]>0){ const r=figma.createRectangle(); r.name='icon tile'; r.resize(w,h); r.x=x; r.y=y; r.cornerRadius=rad; r.fills=[sol(bgc)]; f.appendChild(r); }
      const comp=await figma.getNodeByIdAsync(ICON[n]); if(!comp) continue; const ins=comp.createInstance(); ins.name='Icon/'+n; ins.rescale(g/ins.width); ins.x=x+(w-g)/2; ins.y=y+(h-g)/2; f.appendChild(ins);
      for(const v of ins.findAll(q=>'fills' in q && Array.isArray(q.fills) && q.fills.length)) v.fills=[sol(c)]; }
    else if(l[0]==='g'){ const [_,x,y,w,h,src,rad]=l; const r=figma.createRectangle(); r.name='favicon '+((src.match(/domain=([^&]+)/)||[])[1]||''); r.resize(w,h); r.x=x; r.y=y; r.cornerRadius=rad; r.fills=[sol([.9,.91,.92,1])]; f.appendChild(r); }
    else if(l[0]==='s'){ const [_,x,y,w,h,svg]=l; const n=figma.createNodeFromSvg(svg); n.name='logo mark'; n.rescale(w/n.width); n.x=x; n.y=y; f.appendChild(n); }
    else if(l[0]==='f'){ const [_,x,y,w,h,fr,c]=l; if(w<1) continue; for(const side of [0,1]){ const r=figma.createRectangle(); r.name='feather '+(side?'right':'left'); r.resize(w*fr,h); r.x=side?x+w-w*fr:x; r.y=y; const a={r:c[0],g:c[1],b:c[2],a:1}, z={r:c[0],g:c[1],b:c[2],a:0}; r.fills=[{type:'GRADIENT_LINEAR',gradientTransform:[[1,0,0],[0,1,0]],gradientStops:side?[{position:0,color:z},{position:1,color:a}]:[{position:0,color:a},{position:1,color:z}]}]; f.appendChild(r); } }
    else if(l[0]==='d'){ const [_,x,y,dd,c]=l; const e=figma.createEllipse(); e.name='bullet'; e.resize(dd,dd); e.x=x; e.y=y-1.5; e.fills=[sol(c)]; f.appendChild(e); }
    else { const [_,txt,x,y,w,h,multi,size,wt,lh,ls,c,al,rg]=l; let s=txt; const bad=[];
      for(const q of rg) if(q[5]){ bad.push(s.slice(q[0],q[1])); s=s.slice(0,q[0])+' '.repeat(q[1]-q[0])+s.slice(q[1]); }
      badgeDigits.push(...bad);
      const t=figma.createText(); t.fontName={family:'Geist',style:WT[wt]||'Regular'}; t.characters=s; t.fontSize=size; t.lineHeight={unit:'PIXELS',value:lh}; if(ls) t.letterSpacing={unit:'PIXELS',value:ls};
      t.fills=[sol(c)]; t.textAlignHorizontal=al==='C'?'CENTER':al==='R'?'RIGHT':'LEFT'; t.name=txt.slice(0,40);
      for(const q of rg){ if(q[5]) continue; t.setRangeFills(q[0],q[1],[sol(q[2])]); if(q[3]!==wt) t.setRangeFontName(q[0],q[1],{family:'Geist',style:WT[q[3]]||'Regular'}); if(q[4]) t.setRangeTextDecoration(q[0],q[1],'UNDERLINE'); }
      f.appendChild(t);
      { const st=t.characters; for(let i=st.length-1;i>=0;i--) if(st[i]==='\u2003') t.insertCharacters(i+1,'\u2002','BEFORE'); }
      if(multi){ t.textAutoResize="HEIGHT"; t.resize(w+8,t.height); t.x = al==='L' ? x : x-4; } else { t.textAutoResize='WIDTH_AND_HEIGHT'; t.x = al==='C' ? x+w/2-t.width/2 : al==='R' ? x+w-t.width : x; }
      t.y=y+h/2-t.height/2; }
  }
  cites.forEach((r,i)=>{ const d=badgeDigits[i]; if(!d) return; const t=figma.createText(); t.fontName={family:'Geist',style:'SemiBold'}; t.characters=d; t.fontSize=11.5; t.fills=[sol([.988,1,1,1])]; t.textAutoResize='WIDTH_AND_HEIGHT'; f.appendChild(t); t.x=r.x+r.width/2-t.width/2; t.y=r.y+r.height/2-t.height/2; t.name='cite '+d; });
  return f.id;
}
