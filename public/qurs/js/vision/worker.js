// عامل الرؤية الحاسوبية: يعمل في خيط مستقل حتى تبقى الواجهة والمؤثرات سلسة.
// يستقبل إطارات ImageData (PW×PH) ويرد بوضعية القرص والإصابات. منقول من محرك الإصدار ٣ المختبَر.
'use strict';
const Z_OUT=[30,10,40,10,50,10,60,10,70,10,20,10];
const Z_IN=[150,100,160,110,170,120,180,130,190,80,140,90];
let R_BULL=0.165,R_IN=0.615,R_RIM=0.965;const ANG0=-1.0,R_BULL0=0.165,R_IN0=0.615,R_RIM0=0.965;          // أنصاف الأقطار نسبةً لحافة القرص، وانحراف خطوط التقسيم بالدرجات
const CLS_OUT=i=>[2,3,2,1][i%4], CLS_IN=i=>[3,1,3,2][i%4]; // 1 أحمر/برتقالي، 2 أصفر، 3 أخضر
const COL={1:'#e8452c',2:'#f6cf1c',3:'#17804f',o:'#f0703f'};
const TIERS=[{key:'easy',name:'سهل',c:'#39d98a'},{key:'mid',name:'متوسط',c:'#f6cf1c'},{key:'hard',name:'صعب',c:'#ff7a3d'},{key:'legend',name:'أسطوري',c:'#ff3d6e'}];
const tierOf=p=>p>=200?3:p>=80?2:p>=20?1:0;
function zoneAt(u,v){
  const r=Math.hypot(u,v); if(r>1.04) return null;
  if(r<R_BULL) return {id:'b',pts:200,cls:1,ring:'b',idx:0};
  let a=Math.atan2(u,-v)*180/Math.PI-ANG0; a=((a%360)+360)%360; const i=Math.floor(a/30)%12;
  return r<R_IN?{id:'i'+i,pts:Z_IN[i],cls:CLS_IN(i),ring:'i',idx:i}:{id:'o'+i,pts:Z_OUT[i],cls:CLS_OUT(i),ring:'o',idx:i};
}
function zoneColor(z){return z.ring==='o'&&z.cls===1?COL.o:COL[z.cls];}

function solveH(B,P){ // B: نقاط القرص، P: نقاط الصورة
  const A=[];for(let i=0;i<4;i++){const x=B[i][0],y=B[i][1],X=P[i][0],Y=P[i][1];A.push([x,y,1,0,0,0,-x*X,-y*X,X]);A.push([0,0,0,x,y,1,-x*Y,-y*Y,Y]);}
  for(let c=0;c<8;c++){let p=c;for(let r=c+1;r<8;r++)if(Math.abs(A[r][c])>Math.abs(A[p][c]))p=r;if(Math.abs(A[p][c])<1e-10)return null;[A[c],A[p]]=[A[p],A[c]];
    for(let r=0;r<8;r++)if(r!==c){const f=A[r][c]/A[c][c];for(let k=c;k<9;k++)A[r][k]-=f*A[c][k];}}
  const h=[];for(let i=0;i<8;i++)h.push(A[i][8]/A[i][i]);h.push(1);return h;}
function inv3(m){const [a,b,c,d,e,f,g,h,i]=m,A=e*i-f*h,B=-(d*i-f*g),C=d*h-e*g,det=a*A+b*B+c*C;
  return [A/det,-(b*i-c*h)/det,(b*f-c*e)/det,B/det,(a*i-c*g)/det,-(a*f-c*d)/det,C/det,-(a*h-b*g)/det,(a*e-b*d)/det];}
const BP=[[0,-1],[1,0],[0,1],[-1,0]];
let cal=null;           // {pts,H,Hi}
function setCal(pts){const Hm=solveH(BP,pts);if(!Hm)return false;cal={pts:pts.map(p=>p.slice()),H:Hm,Hi:inv3(Hm)};return true;}
function apply(m,x,y){const w=m[6]*x+m[7]*y+m[8];return [(m[0]*x+m[1]*y+m[2])/w,(m[3]*x+m[4]*y+m[5])/w];}

const b2v=(u,v)=>apply(cal.H,u,v), v2b=(x,y)=>apply(cal.Hi,x,y);
let src={w:1280,h:720},frame=null,paused=false,mode='scan';
const post=(type,d)=>self.postMessage(Object.assign({type},d||{}));
/* ================= التعرف على القرص بالألوان (مع تصحيح المنظور) ================= */
const PW=800;let PH=450;
function colorClass(r,g,b){const mx=r>g?(r>b?r:b):(g>b?g:b),mn=r<g?(r<b?r:b):(g<b?g:b),d=mx-mn;if(mx<55||d<mx*0.36)return 0;
  let h;if(mx===r)h=(g-b)/d;else if(mx===g)h=(b-r)/d+2;else h=(r-g)/d+4;h*=60;if(h<0)h+=360;
  return (h<33||h>335)?1:h<75?2:h<190?3:0;}
function mul3(a,b){const o=new Array(9);for(let r=0;r<3;r++)for(let c=0;c<3;c++)o[r*3+c]=a[r*3]*b[c]+a[r*3+1]*b[3+c]+a[r*3+2]*b[6+c];return o;}
const det={cl:null,m:null,o:null,lab:null,st:null,n:0};
function detectBoard(prev){
  const S=3,w=Math.floor(PW/S),h=Math.floor(PH/S),n=w*h,d=frame.data;
  if(det.n!==n){det.n=n;det.cl=new Uint8Array(n);det.m=new Uint8Array(n);det.o=new Uint8Array(n);det.lab=new Int32Array(n);det.st=new Int32Array(n);}
  const cl=det.cl;let m=det.m,o=det.o;const lab=det.lab,st=det.st;lab.fill(0);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const j=(y*S*PW+x*S)*4;cl[y*w+x]=colorClass(d[j],d[j+1],d[j+2]);}
  for(let i=0;i<n;i++)m[i]=cl[i]?1:0;
  for(let pass=0;pass<2;pass++){o.fill(0);for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){const i=y*w+x;o[i]=m[i]|m[i-1]|m[i+1]|m[i-w]|m[i+w];}const tmp=m;m=o;o=tmp;}
  let best=0,bestA=0,L=0;
  for(let i=0;i<n;i++){if(!m[i]||lab[i])continue;L++;let sp=0,a=0;st[sp++]=i;lab[i]=L;
    while(sp){const p=st[--sp];a++;const x=p%w;if(x>0&&m[p-1]&&!lab[p-1]){lab[p-1]=L;st[sp++]=p-1;}if(x<w-1&&m[p+1]&&!lab[p+1]){lab[p+1]=L;st[sp++]=p+1;}
      if(p>=w&&m[p-w]&&!lab[p-w]){lab[p-w]=L;st[sp++]=p-w;}if(p<n-w&&m[p+w]&&!lab[p+w]){lab[p+w]=L;st[sp++]=p+w;}}
    if(a>bestA){bestA=a;best=L;}}
  if(bestA<n*0.012)return null;
  let s0=0,sx=0,sy=0,sxx=0,sxy=0,syy=0;
  for(let i=0;i<n;i++)if(lab[i]===best&&cl[i]){const x=i%w,y=(i/w)|0;s0++;sx+=x;sy+=y;sxx+=x*x;sxy+=x*y;syy+=y*y;}
  if(s0<50)return null;
  const cx=sx/s0,cy=sy/s0,cxx=sxx/s0-cx*cx,cxy=sxy/s0-cx*cy,cyy=syy/s0-cy*cy;
  const tr=cxx+cyy,dt=Math.sqrt(Math.max(0,(cxx-cyy)*(cxx-cyy)/4+cxy*cxy)),l1=tr/2+dt,l2=tr/2-dt;if(l2<=1)return null;
  const th=0.5*Math.atan2(2*cxy,cxx-cyy),c=Math.cos(th),s=Math.sin(th),a=2*Math.sqrt(l1),b=2*Math.sqrt(l2);
  if(b/a<0.3)return null;
  let S00=c*c*a+s*s*b,S01=c*s*(a-b),S11=s*s*a+c*c*b;                       // S = R diag(a,b) Rᵀ
  let dd=S00*S11-S01*S01,i00=S11/dd,i01=-S01/dd,i11=S00/dd;const hist=new Int32Array(64);
  for(let i=0;i<n;i++)if(lab[i]===best&&cl[i]){const dx=i%w-cx,dy=((i/w)|0)-cy,q=Math.hypot(i00*dx+i01*dy,i01*dx+i11*dy);hist[Math.min(63,(q*40)|0)]++;}
  let acc=0,k=1;for(let q=0;q<64;q++){acc+=hist[q];if(acc>=s0*0.98){k=(q+1)/40;break;}}
  const sc=k/0.965;S00*=sc;S01*=sc;S11*=sc;i00/=sc;i01/=sc;i11/=sc;
  // المنظور: أي صورة لدائرة = قطع ناقص + إزاحة للمركز (bx,by) + دوران psi. نبحث عن القيم التي تطابق ألوان الخانات أفضل مطابقة.
  if(!detectBoard.smp){const smp=detectBoard.smp=[];const ring=(r,offs,f)=>{for(let i=0;i<12;i++)for(const off of offs){const an=(i*30+off+ANG0)*Math.PI/180;smp.push([r*Math.sin(an),-r*Math.cos(an),f(i)]);}};
    ring(0.92,[5,15,25],CLS_OUT);ring(0.8,[5,25],CLS_OUT);ring(0.68,[5,15,25],CLS_OUT);ring(0.55,[6,15,24],CLS_IN);ring(0.4,[6,24],CLS_IN);ring(0.25,[8,15,22],CLS_IN);
    smp.push([0,0,1],[0.08,0,1],[-0.08,0,1],[0,0.08,1],[0,-0.08,1]);}
  const smp=detectBoard.smp,A=[S00,S01,cx,S01,S11,cy,0,0,1];
  const build=(bx,by,psi)=>{const am=Math.hypot(bx,by),ph=Math.atan2(by,bx),cp=Math.cos(ph),sn=Math.sin(ph),ks=Math.sqrt(1-am*am),pr=psi*Math.PI/180,pc=Math.cos(pr),ps=Math.sin(pr);
    return mul3(mul3(mul3(mul3(A,[cp,-sn,0,sn,cp,0,0,0,1]),[1,0,am,0,ks,0,am,0,1]),[cp,sn,0,-sn,cp,0,0,0,1]),[pc,-ps,0,ps,pc,0,0,0,1]);};
  const evalP=(bx,by,psi)=>{if(bx*bx+by*by>0.56)return -1;const B=build(bx,by,psi);let ok=0;
    for(const q of smp){const ww=B[6]*q[0]+B[7]*q[1]+B[8],x=Math.round((B[0]*q[0]+B[1]*q[1]+B[2])/ww),y=Math.round((B[3]*q[0]+B[4]*q[1]+B[5])/ww);if(x>=0&&y>=0&&x<w&&y<h&&cl[y*w+x]===q[2])ok++;}
    return ok/smp.length;};
  const climb=(P)=>{let sb=0.06,sp=2;P.s=evalP(P.bx,P.by,P.psi);
    while(sb>0.006){let imp=false;for(const dlt of[[sb,0,0],[-sb,0,0],[0,sb,0],[0,-sb,0],[0,0,sp],[0,0,-sp]]){const v=evalP(P.bx+dlt[0],P.by+dlt[1],P.psi+dlt[2]);if(v>P.s+1e-9){P.s=v;P.bx+=dlt[0];P.by+=dlt[1];P.psi+=dlt[2];imp=true;}}
      if(!imp){sb/=2;sp/=2;}}return P;};
  let P=null;
  if(prev){P=climb({bx:prev.bx,by:prev.by,psi:prev.psi});}
  if(!P||P.s<0.6){ // بحث شامل: من مركز الدائرة الحمراء ومن الصفر
    let bx=0,by=0;
    for(let it=0;it<4;it++){const R=it?0.2:0.3,px=cx+S00*bx+S01*by,py=cy+S01*bx+S11*by,ext=Math.ceil(R*a*sc)+1;let nn=0,su=0,sv=0;
      for(let y=Math.max(0,(py-ext)|0);y<=Math.min(h-1,(py+ext)|0);y++)for(let x=Math.max(0,(px-ext)|0);x<=Math.min(w-1,(px+ext)|0);x++){
        if(cl[y*w+x]!==1)continue;const dx=x-cx,dy=y-cy,u=i00*dx+i01*dy,v=i01*dx+i11*dy;if(Math.hypot(u-bx,v-by)<R){nn++;su+=u;sv+=v;}}
      if(nn<5)break;bx=su/nn;by=sv/nn;}
    const am=Math.hypot(bx,by);if(am>0.7){bx*=0.7/am;by*=0.7/am;}
    const p0=prev?prev.psi:0;
    const starts=[[bx,by],[0,0]];for(let k=0;k<8;k++)starts.push([0.35*Math.cos(k*Math.PI/4),0.35*Math.sin(k*Math.PI/4)]);
    for(const st of starts){let bs=-1,bp=0;for(let p=p0-60;p<p0+60;p+=1.5){const v=evalP(st[0],st[1],p)-Math.abs(p-p0)*1e-4;if(v>bs){bs=v;bp=p;}}
      const Q=climb({bx:st[0],by:st[1],psi:bp});if(!P||Q.s>P.s)P=Q;}
  }
  const B=build(P.bx,P.by,P.psi),f=S*src.w/PW;
  const pts=BP.map(q=>{const ww=B[6]*q[0]+B[7]*q[1]+B[8];return [(B[0]*q[0]+B[1]*q[1]+B[2])/ww*f,(B[3]*q[0]+B[4]*q[1]+B[5])/ww*f];});
  return {pts,score:P.s,P:{bx:P.bx,by:P.by,psi:P.psi},rad:Math.sqrt(a*b)*sc*f};
}

/* ================= التتبع المستمر للقرص ================= */
const THR=0.62;
let scan={manual:false,good:0,locked:false,drag:-1,rot:0};
const trk={P:null,ok:false,jump:false,lost:99,score:0,rms:1,q:0,mode:'search',frames:0};
function rotPts(pts,k){ // تدوير تعيين الخانات ١٢٠° حول القرص
  const Hm=solveH(BP,pts);const a=k*120*Math.PI/180,c=Math.cos(a),s=Math.sin(a);return BP.map(q=>apply(Hm,c*q[0]-s*q[1],s*q[0]+c*q[1]));}

/* ---- تحسين الوضعية بالحواف (دقة دون البكسل) ----
   نأخذ الهوموغرافي التقريبي، ونبحث على طول خطوط شعاعية عن حواف القرص الحقيقية:
   حافة الحلقة الخارجية، الخط الأسود الفاصل بين الحلقتين، دائرة المركز، والخطوط الشعاعية الـ١٢.
   ثم نحسّن المعاملات الثمانية بطريقة غاوس-نيوتن حتى تطابق كل الحواف معًا. */
const satAt=(x,y)=>{ // تشبّع اللون عند نقطة (استيفاء ثنائي الخط)
  if(x<0||y<0||x>=PW-1||y>=PH-1)return -1;const x0=x|0,y0=y|0,fx=x-x0,fy=y-y0,d=frame.data;
  const sv=(xx,yy)=>{const j=(yy*PW+xx)*4,r=d[j],g=d[j+1],b=d[j+2];return Math.max(r,g,b)-Math.min(r,g,b);};
  return sv(x0,y0)*(1-fx)*(1-fy)+sv(x0+1,y0)*fx*(1-fy)+sv(x0,y0+1)*(1-fx)*fy+sv(x0+1,y0+1)*fx*fy;};
const EDGE_ANG=[];for(let i=0;i<12;i++)for(const o of[4,7.5,11,19,22.5,26])EDGE_ANG.push(i*30+o+ANG0);
function refinePose(H0){
  const f=PW/src.w;let Hs=[H0[0]*f,H0[1]*f,H0[2]*f,H0[3]*f,H0[4]*f,H0[5]*f,H0[6],H0[7],H0[8]];
  const pr=(Hm,u,v)=>{const w=Hm[6]*u+Hm[7]*v+Hm[8];return [(Hm[0]*u+Hm[1]*v+Hm[2])/w,(Hm[3]*u+Hm[4]*v+Hm[5])/w];};
  const minPick=v=>{let k=0;for(let i=1;i<v.length;i++)if(v[i]<v[k])k=i;return (k<2||k>=v.length-2)?-1:k;};
  const SW=6,stepPick=v=>{let k=-1,best=-1e9;for(let i=SW;i<v.length-SW;i++){let a=0,b=0;for(let j=1;j<=SW;j++){a+=v[i-j];b+=v[i+j];}if(a-b>best){best=a-b;k=i;}}
    return (k<=SW||k>=v.length-SW-1||best<SW*25)?-1:k;};
  const measure=()=>{const obs=[];
    const scanRadial=(ang,r0,r1,step,pick,rExp)=>{const sn=Math.sin(ang*Math.PI/180),cs=-Math.cos(ang*Math.PI/180),vals=[],rs=[];
      for(let r=r0;r<=r1+1e-9;r+=step){const p=pr(Hs,r*sn,r*cs),v=satAt(p[0],p[1]);if(v<0)return;vals.push(v);rs.push(r);}
      const k=pick(vals);if(k<0)return;const a=vals[k-1],b=vals[k],c=vals[k+1],dn=a-2*b+c,off=dn?Math.max(-1,Math.min(1,0.5*(a-c)/dn)):0;
      const r=rs[k]+off*step,p=pr(Hs,r*sn,r*cs);obs.push({x:p[0],y:p[1],kind:'r',val:rExp});};
    for(const ang of EDGE_ANG){
      scanRadial(ang,0.80,1.15,0.01,stepPick,R_RIM);                       // حافة الحلقة الخارجية (0.965)
      scanRadial(ang,0.50,0.73,0.0075,minPick,R_IN);                      // الخط الأسود عند R_IN
      if(ang%30-ANG0>6&&ang%30-ANG0<24)scanRadial(ang,0.08,0.26,0.006,minPick,R_BULL); // دائرة المركز
    }
    for(let i=0;i<12;i++)for(const r of[0.36,0.5,0.75,0.9]){ // الخطوط الشعاعية: أظلم نقطة عرضيًا
      const a0=i*30+ANG0,vals=[],as=[];const span=Math.min(9,3.6/r),st=span/12;
      for(let d=-span;d<=span+1e-9;d+=st){const an=(a0+d)*Math.PI/180,p=pr(Hs,r*Math.sin(an),-r*Math.cos(an)),v=satAt(p[0],p[1]);if(v<0){vals.length=0;break;}vals.push(v);as.push(a0+d);}
      if(vals.length<5)continue;const k=minPick(vals);if(k<0)continue;const a=vals[k-1],b=vals[k],c=vals[k+1],dn=a-2*b+c,off=dn?Math.max(-1,Math.min(1,0.5*(a-c)/dn)):0;
      const an=(as[k]+off*st)*Math.PI/180,p=pr(Hs,r*Math.sin(an),-r*Math.cos(an));obs.push({x:p[0],y:p[1],kind:'a',val:a0*Math.PI/180,r});}
    return obs;};
  const resid=(hh,o)=>{const Hm=hh.concat([1]),Hi=inv3(Hm),b=apply(Hi,o.x,o.y);
    if(o.kind==='r')return Math.hypot(b[0],b[1])-o.val;let da=Math.atan2(b[0],-b[1])-o.val;da=Math.atan2(Math.sin(da),Math.cos(da));return da*o.r;};
  let rms=1,nUse=0,lastUse=null,lastH=null;
  for(let outer=0;outer<3;outer++){
    const obs=measure();if(obs.length<40)return null;
    let h=Hs.slice(0,8),use=obs;lastH=h;
    for(let it=0;it<4;it++){
      const n=use.length,J=[],base=use.map(o=>resid(h,o));
      for(let k=0;k<8;k++){const eps=(k<6?(k===2||k===5?0.05:1e-4):1e-7);const hh=h.slice();hh[k]+=eps;J.push(use.map((o,i)=>(resid(hh,o)-base[i])/eps));}
      const A=[];for(let a=0;a<8;a++){A.push(new Float64Array(9));for(let b=0;b<8;b++){let sum=0;for(let i=0;i<n;i++)sum+=J[a][i]*J[b][i];A[a][b]=sum;}let sb=0;for(let i=0;i<n;i++)sb-=J[a][i]*base[i];A[a][8]=sb;A[a][a]*=1.02;}
      for(let c=0;c<8;c++){let p=c;for(let rr=c+1;rr<8;rr++)if(Math.abs(A[rr][c])>Math.abs(A[p][c]))p=rr;if(Math.abs(A[p][c])<1e-14)return null;[A[c],A[p]]=[A[p],A[c]];
        for(let rr=0;rr<8;rr++)if(rr!==c){const fct=A[rr][c]/A[c][c];for(let k=c;k<9;k++)A[rr][k]-=fct*A[c][k];}}
      for(let k=0;k<8;k++)h[k]+=A[k][8]/A[k][k];
      const rs=obs.map(o=>Math.abs(resid(h,o))).sort((a,b)=>a-b);const cut=Math.max(0.01,rs[Math.floor(rs.length*0.6)]*2.5);
      use=obs.filter(o=>Math.abs(resid(h,o))<cut);if(use.length<30)return null;
      let ss=0;for(const o of use)ss+=resid(h,o)**2;rms=Math.sqrt(ss/use.length);nUse=use.length;lastUse=use;lastH=h;if(rms<0.002)break;}
    const c0=pr(Hs,0,0),Hn=h.concat([1]),c1=pr(Hn,0,0),moved=Math.hypot(c1[0]-c0[0],c1[1]-c0[1]);Hs=Hn;
    if(moved<0.3&&rms<0.015)break;   // استقر: لا داعي لإعادة القياس
  }
  // معايرة ذاتية لأنصاف أقطار الحلقات حسب القرص الحقيقي (انزياح متوسط لكل حلقة)
  if(rms<0.02&&lastUse){const adj={};for(const o of lastUse){if(o.kind!=='r')continue;const r=resid(lastH,o);(adj[o.val]=adj[o.val]||[]).push(r);}
    const upd=(key,cur,base)=>{const arr=adj[key];if(!arr||arr.length<12)return cur;const m=arr.reduce((q,v)=>q+v,0)/arr.length;return Math.max(base-0.03,Math.min(base+0.03,cur+m*0.15));};
    const nr=upd(R_RIM,R_RIM,R_RIM0),ni=upd(R_IN,R_IN,R_IN0),nb=upd(R_BULL,R_BULL,R_BULL0);R_RIM=nr;R_IN=ni;R_BULL=nb;}
  return {H:[Hs[0]/f,Hs[1]/f,Hs[2]/f,Hs[3]/f,Hs[4]/f,Hs[5]/f,Hs[6],Hs[7],Hs[8]],rms,n:nUse};
}
function setCalH(Hm){const pts=BP.map(q=>apply(Hm,q[0],q[1]));return setCal(pts);}
function track(){
  if(scan.manual){trk.ok=!!cal;trk.jump=false;trk.mode='manual';return;}
  trk.frames++;
  // ١) إن كان لدينا وضعية سابقة: حسّنها مباشرة بالحواف (سريع ودقيق)
  if(cal&&trk.lost<8&&trk.frames%60!==0){
    const Hp=trk.prevH?cal.H.map((v,i)=>v+(v-trk.prevH[i])*0.8):cal.H;   // تنبؤ بسرعة ثابتة
    const R=refinePose(Hp)||refinePose(cal.H);
    if(R&&R.rms<0.03){const c0=b2v(0,0),c1=apply(R.H,0,0),e1=b2v(1,0),rad=Math.hypot(e1[0]-c0[0],e1[1]-c0[1]),mv=Math.hypot(c1[0]-c0[0],c1[1]-c0[1]);
      trk.jump=mv>rad*0.08;const al=mv<rad*0.003?0.5:1;   // ثابت: تنعيم خفيف؛ متحرك: بلا تأخير
      trk.lost=0;trk.rms=R.rms;trk.q=R.rms<0.012?3:R.rms<0.02?2:1;trk.mode='track';trk.prevH=cal.H.slice();
      const Hn=cal.H.map((v,i)=>v*(1-al)+R.H[i]*al);trk.ok=setCalH(Hn);return;}}
  trk.prevH=null;
  // ٢) وإلا: كشف كامل بالألوان ثم تحسين
  const r=detectBoard(trk.lost<30?trk.P:null);trk.score=r?r.score:0;trk.mode='search';
  if(!r||r.score<THR){trk.ok=false;trk.lost++;trk.q=0;return;}
  let pts=scan.rot?rotPts(r.pts,scan.rot):r.pts;trk.jump=false;
  if(cal&&trk.lost<10){const dm=Math.max(...pts.map((p,i)=>Math.hypot(p[0]-cal.pts[i][0],p[1]-cal.pts[i][1])))/r.rad;trk.jump=dm>0.07;}
  trk.P=r.P;trk.lost=0;trk.ok=setCal(pts);
  const R=refinePose(cal.H);if(R&&R.rms<0.03){setCalH(R.H);trk.rms=R.rms;trk.q=R.rms<0.012?3:2;}else{trk.rms=0.04;trk.q=1;}
  trk.prevH=cal.H.slice();
}
function scanStep(){
  if(scan.manual)return;track();
  if(trk.ok){scan.good++;if(scan.good>=3&&!scan.locked){scan.locked=true;post('locked',{});}}
  else{scan.good=0;if(trk.lost>12){scan.locked=false;cal=null;}}
}

function enterScan(){R_BULL=R_BULL0;R_IN=R_IN0;R_RIM=R_RIM0;mode='scan';scan={manual:false,good:0,locked:false,drag:-1,rot:0};cal=null;trk.lost=99;trk.P=null;trk.ok=false;trk.prevH=null;cv.balls=[];cv.cands=[];}
/* ================= كشف الكرات ================= */
const G=160,EXT=1.22,N=G*G;
const cv={map:new Int32Array(N),cur:new Uint8Array(N*3),prev:new Uint8Array(N*3),bg:new Float32Array(N*3),clean:new Float32Array(N*3),
  mask:new Uint8Array(N),er:new Uint8Array(N),lab:new Int32Array(N),st:new Int32Array(N),age:new Uint16Array(N),balls:[],cands:[],lastHit:0,
  flight:null,cleanH:null,cleanFrame:null,out:new Uint8Array(N),hi:new Uint8Array(N),tmp:new Uint8Array(N)};
for(let j=0;j<G;j++)for(let i=0;i<G;i++){const u=((i+0.5)/G*2-1)*EXT,v=((j+0.5)/G*2-1)*EXT;cv.out[j*G+i]=u*u+v*v>1.0*1.0?1:0;}
function buildMap(){const f=PW/src.w,Hm=cal.H;for(let j=0;j<G;j++)for(let i=0;i<G;i++){const u=((i+0.5)/G*2-1)*EXT,v=((j+0.5)/G*2-1)*EXT,k=j*G+i;
  if(u*u+v*v>EXT*EXT*0.98){cv.map[k]=-1;continue;}const w=Hm[6]*u+Hm[7]*v+1,x=Math.round((Hm[0]*u+Hm[1]*v+Hm[2])/w*f),y=Math.round((Hm[3]*u+Hm[4]*v+Hm[5])/w*f);cv.map[k]=(x<0||y<0||x>=PW||y>=PH)?-1:(y*PW+x)*4;}}
function sample(){const d=frame.data,cur=cv.cur,map=cv.map;for(let k=0;k<N;k++){const m=map[k];if(m<0)continue;const j=k*3;cur[j]=d[m];cur[j+1]=d[m+1];cur[j+2]=d[m+2];}}
function rebase(){buildMap();sample();for(let i=0;i<N*3;i++){cv.bg[i]=cv.cur[i];cv.clean[i]=cv.cur[i];cv.prev[i]=cv.cur[i];}cv.age.fill(0);cv.cands=[];cv.balls=[];cv.flight=null;
  cv.cleanH=cal.H.slice();cv.cleanFrame=new Uint8ClampedArray(frame.data);}
const g2b=(x,y)=>[((x+0.5)/G*2-1)*EXT,((y+0.5)/G*2-1)*EXT];
let sens=38;
function sdiffT(ref,k,gain,thr){ // فرق يتحمّل إزاحة خلية واحدة، حتى لا يُحسب اهتزاز الصورة تغيّرًا
  const cur=cv.cur,j=k*3,r=cur[j],g=cur[j+1],b=cur[j+2];
  let best=Math.max(Math.abs(r-ref[j]*gain),Math.abs(g-ref[j+1]*gain),Math.abs(b-ref[j+2]*gain));if(best<=thr)return best;
  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){if(!dx&&!dy)continue;const kk=k+dy*G+dx;if(kk<0||kk>=N||cv.map[kk]<0)continue;const q=kk*3;
    const d=Math.max(Math.abs(r-ref[q]*gain),Math.abs(g-ref[q+1]*gain),Math.abs(b-ref[q+2]*gain));if(d<best){best=d;if(best<=thr)return best;}}
  return best;}
const sdiff=(ref,k,gain)=>sdiffT(ref,k,gain,sens);
const pxAt=(d,x,y)=>{if(x<0||y<0||x>=PW-1||y>=PH-1)return null;const x0=x|0,y0=y|0,fx=x-x0,fy=y-y0,o=[0,0,0];
  for(let c=0;c<3;c++){const j=(y0*PW+x0)*4+c;o[c]=d[j]*(1-fx)*(1-fy)+d[j+4]*fx*(1-fy)+d[j+PW*4]*(1-fx)*fy+d[j+PW*4+4]*fx*fy;}return o;};
function subpixel(u0,v0,gc){ // مركز الكرة بدقة: مقارنة الإطار الحالي بصورة القرص الفارغ عند نفس نقاط القرص (كلٌّ بهوموغرافيّه)
  const f=PW/src.w,Hn=cal.H,Hc=cv.cleanH,R=0.13,n=36;let sw=0,su=0,sv=0,cr=0,cg=0,cb=0;
  for(let j=0;j<n;j++)for(let i=0;i<n;i++){const u=u0+(i/(n-1)*2-1)*R,v=v0+(j/(n-1)*2-1)*R;if(u*u+v*v>1.1)continue;
    const w1=Hn[6]*u+Hn[7]*v+Hn[8],p1=pxAt(frame.data,(Hn[0]*u+Hn[1]*v+Hn[2])/w1*f,(Hn[3]*u+Hn[4]*v+Hn[5])/w1*f);
    const w2=Hc[6]*u+Hc[7]*v+Hc[8],p2=pxAt(cv.cleanFrame,(Hc[0]*u+Hc[1]*v+Hc[2])/w2*f,(Hc[3]*u+Hc[4]*v+Hc[5])/w2*f);if(!p1||!p2)continue;
    const d=Math.max(Math.abs(p1[0]-p2[0]*gc),Math.abs(p1[1]-p2[1]*gc),Math.abs(p1[2]-p2[2]*gc));if(d<sens*0.8)continue;
    const wgt=d-sens*0.8;sw+=wgt;su+=u*wgt;sv+=v*wgt;cr+=p1[0]*wgt;cg+=p1[1]*wgt;cb+=p1[2]*wgt;}
  if(sw<1)return {u:u0,v:v0,col:null};return {u:su/sw,v:sv/sw,col:[cr/sw,cg/sw,cb/sw]};}
function cvStep(t){
  if(!trk.ok||trk.jump){cv.cands.length=0;cv.flight=null;return;}        // القرص غير ظاهر أو الجهاز يتحرك بسرعة: لا نحكم على هذا الإطار
  buildMap();sample();
  const cur=cv.cur,prev=cv.prev,bg=cv.bg,clean=cv.clean,map=cv.map,mask=cv.mask,er=cv.er,age=cv.age;let sc=0,sb=0,sl=0;
  for(let k=0;k<N;k++){if(map[k]<0)continue;const j=k*3;sc+=cur[j]+cur[j+1]+cur[j+2];sb+=bg[j]+bg[j+1]+bg[j+2];sl+=clean[j]+clean[j+1]+clean[j+2];}
  const cl=v=>Math.min(1.4,Math.max(0.7,v)),gain=cl(sb>0?sc/sb:1),gc=cl(sl>0?sc/sl:1);
  // ١) الطيران: ما تحرك بين إطارين متتاليين
  let mot=0,mx=0,my=0,mn=0;
  for(let k=0;k<N;k++){if(map[k]<0)continue;const j=k*3;const d=Math.max(Math.abs(cur[j]-prev[j]),Math.abs(cur[j+1]-prev[j+1]),Math.abs(cur[j+2]-prev[j+2]));
    prev[j]=cur[j];prev[j+1]=cur[j+1];prev[j+2]=cur[j+2];if(d>40){mot++;mx+=k%G;my+=(k/G)|0;}}
  if(mot>=10&&mot<700){const p=g2b(mx/mot,my/mot);const fl=cv.flight;
    if(fl&&t-fl.t<400&&Math.hypot(p[0]-fl.u,p[1]-fl.v)<0.6){fl.n++;fl.vu=(p[0]-fl.u)/Math.max(16,t-fl.t);fl.vv=(p[1]-fl.v)/Math.max(16,t-fl.t);fl.u=p[0];fl.v=p[1];fl.t=t;}
    else cv.flight={u:p[0],v:p[1],t,n:1,vu:0,vv:0};
    if(!paused&&cv.flight.n>=2)post('trail',{u:p[0],v:p[1]});}
  else if(cv.flight&&t-cv.flight.t>700)cv.flight=null;
  // ٢) الاستقرار: ما يختلف عن الخلفية ويثبت
  // عتبتان: منخفضة تلتقط كرة قريبة اللون من خانتها (ظلّها وتدرّج سطحها)، وعالية تميّز التغيّر الواضح
  const lo=sens*0.6,hi=cv.hi;
  for(let k=0;k<N;k++){if(map[k]<0||cv.out[k]){mask[k]=0;hi[k]=0;continue;}const j=k*3,d=sdiffT(bg,k,gain,lo);
    if(d>lo){mask[k]=1;hi[k]=d>sens?1:0;if(++age[k]>90){bg[j]=cur[j];bg[j+1]=cur[j+1];bg[j+2]=cur[j+2];age[k]=0;}}  // تغيّر ثابت طويلًا (إضاءة/شخص واقف): يُستوعب بلا نقاط
    else{mask[k]=0;hi[k]=0;age[k]=0;bg[j]+=(cur[j]-bg[j])*0.08;bg[j+1]+=(cur[j+1]-bg[j+1])*0.08;bg[j+2]+=(cur[j+2]-bg[j+2])*0.08;}}
  // إغلاق (تمديد ثم تآكل) يلحم أجزاء الكرة المتقطعة، ثم تآكل إضافي يزيل الخطوط الرفيعة الناتجة عن اهتزاز الحواف
  const tmp=cv.tmp;tmp.fill(0);for(let y=1;y<G-1;y++)for(let x=1;x<G-1;x++){const k=y*G+x;tmp[k]=mask[k]|mask[k-1]|mask[k+1]|mask[k-G]|mask[k+G];}
  er.fill(0);for(let y=1;y<G-1;y++)for(let x=1;x<G-1;x++){const k=y*G+x;er[k]=tmp[k]&tmp[k-1]&tmp[k+1]&tmp[k-G]&tmp[k+G];}
  tmp.fill(0);for(let y=1;y<G-1;y++)for(let x=1;x<G-1;x++){const k=y*G+x;tmp[k]=er[k]&er[k-1]&er[k+1]&er[k-G]&er[k+G];}
  er.set(tmp);
  const lab=cv.lab,st=cv.st;lab.fill(0);let L=0;const found=[];
  for(let i=0;i<N;i++){if(!er[i]||lab[i])continue;L++;let sp=0,a=0,sx=0,sy=0,x0=G,x1=0,y0=G,y1=0,dc=0,db=0,nh=0;st[sp++]=i;lab[i]=L;
    while(sp){const p=st[--sp],x=p%G,y=(p/G)|0;a++;sx+=x;sy+=y;if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;
      nh+=hi[p];if(a<900){dc+=sdiffT(clean,p,gc,0);db+=sdiffT(bg,p,gain,0);}
      if(er[p-1]&&!lab[p-1]){lab[p-1]=L;st[sp++]=p-1;}if(er[p+1]&&!lab[p+1]){lab[p+1]=L;st[sp++]=p+1;}
      if(er[p-G]&&!lab[p-G]){lab[p-G]=L;st[sp++]=p-G;}if(er[p+G]&&!lab[p+G]){lab[p+G]=L;st[sp++]=p+G;}}
    const bw=x1-x0+1,bh=y1-y0+1,ar=bw/bh;
    if(a<26||a>900||bw>44||bh>44)continue;                                   // ليست بحجم كرة
    const fill=a/(bw*bh),strong=nh>=a*0.2;
    if(strong?(fill<0.45||ar<0.45||ar>2.2):(fill<0.6||ar<0.65||ar>1.55))continue;   // تغيّر ضعيف: نقبله فقط إن كان مستديرًا بوضوح
    const p=g2b(sx/a,sy/a);if(Math.hypot(p[0],p[1])>1.0)continue;            // خارج القرص: الخلفية قد تتحرك نسبةً للقرص
    found.push({a,u:p[0],v:p[1],clean:dc<db*0.5,strong,x0,x1,y0,y1,n:1});}
  const next=[];
  for(const f of found){const c=cv.cands.find(c=>!c.used&&Math.hypot(c.u-f.u,c.v-f.v)<0.07&&f.a>c.a*0.5&&f.a<c.a*2);
    if(c){c.used=1;f.n=c.n+1;f.first=c.first;}else f.first=t;
    // رمية رأيناها تطير قبل لحظات واستقرت هنا: نؤكد بسرعة. وإلا ننتظر إطارات أكثر (ظل/إضاءة/يد)
    const fl=cv.flight,fromFlight=fl&&t-fl.t<900&&Math.hypot(fl.u-f.u,fl.v-f.v)<0.35;
    const need=(fromFlight?2:4)+(f.strong?0:2);
    if(f.n<need){next.push(f);continue;}
    // تأكدت: كرة التصقت، أو كرة أُزيلت
    for(let y=Math.max(0,f.y0-3);y<=Math.min(G-1,f.y1+3);y++)for(let x=Math.max(0,f.x0-3);x<=Math.min(G-1,f.x1+3);x++){const k=y*G+x,j=k*3;bg[j]=cur[j];bg[j+1]=cur[j+1];bg[j+2]=cur[j+2];age[k]=0;}
    if(f.clean)continue;                                                      // عاد القرص فارغًا هنا: كرة أُزيلت
    const sp=subpixel(f.u,f.v,gc);
    if(cv.balls.some(b=>Math.hypot(b.u-sp.u,b.v-sp.v)<0.06))continue;         // الكرة نفسها مسجّلة من قبل
    cv.balls.push({u:sp.u,v:sp.v});cv.flight=null;
    if(!paused)post('hit',{u:sp.u,v:sp.v});}
  cv.cands=next;
  // كل كرة مسجّلة يجب أن تبقى ظاهرة فوق لقطة القرص الفارغ، وإلا فقد أُزيلت
  cv.balls=cv.balls.filter(b=>{const gx=Math.round((b.u/EXT+1)/2*G-0.5),gy=Math.round((b.v/EXT+1)/2*G-0.5);let s=0,n=0;
    for(let y=gy-2;y<=gy+2;y++)for(let x=gx-2;x<=gx+2;x++){if(x<0||y<0||x>=G||y>=G)continue;const k=y*G+x;if(map[k]<0)continue;s+=sdiff(clean,k,gc);n++;}
    return !n||s/n>sens*0.8;});
}


const pose3={r1:[1,0,0],r2:[0,1,0],r3:[0,0,1],t:[0,0,3],f:1000,cx:0,cy:0,ok:false};
function updatePose(){
  if(!cal){pose3.ok=false;return;}const H=cal.H,f=Math.max(src.w,src.h)*1.05,cx=src.w/2,cy=src.h/2;
  const m=[(H[0]-cx*H[6])/f,(H[1]-cx*H[7])/f,(H[2]-cx*H[8])/f,(H[3]-cy*H[6])/f,(H[4]-cy*H[7])/f,(H[5]-cy*H[8])/f,H[6],H[7],H[8]];
  let r1=[m[0],m[3],m[6]],r2=[m[1],m[4],m[7]],t=[m[2],m[5],m[8]];const n1=Math.hypot(...r1),n2=Math.hypot(...r2),lam=2/(n1+n2);
  r1=r1.map(v=>v*lam);r2=r2.map(v=>v*lam);t=t.map(v=>v*lam);if(t[2]<0){r1=r1.map(v=>-v);r2=r2.map(v=>-v);t=t.map(v=>-v);}
  // تعامد تقريبي
  const d=r1[0]*r2[0]+r1[1]*r2[1]+r1[2]*r2[2];r2=r2.map((v,i)=>v-d*r1[i]);const n2b=Math.hypot(...r2);r2=r2.map(v=>v/n2b);const n1b=Math.hypot(...r1);r1=r1.map(v=>v/n1b);
  let r3=[r1[1]*r2[2]-r1[2]*r2[1],r1[2]*r2[0]-r1[0]*r2[2],r1[0]*r2[1]-r1[1]*r2[0]];
  // R دوران حقيقي (محدده +١): المحور z يدخل في القرص بعيدًا عن الكاميرا؛ المشهد يعكس z للارتفاع فوق القرص
  Object.assign(pose3,{r1,r2,r3,t,f,cx,cy,ok:true});}

let armT=0;
self.onmessage=(e)=>{const m=e.data;
  switch(m.type){
    case 'init': src={w:m.w,h:m.h}; enterScan(); break;
    case 'scan': enterScan(); break;
    case 'manual': scan.manual=m.on; if(m.on&&!cal){const r=Math.min(src.w,src.h)*0.3,cx=src.w/2,cy=src.h/2;setCal([[cx,cy-r],[cx+r,cy],[cx,cy+r],[cx-r,cy]]);} if(m.on)trk.ok=true; else{scan.locked=false;scan.good=0;} break;
    case 'setPts': if(m.pts)setCal(m.pts); break;
    case 'rotate': if(cal){scan.rot=(scan.rot+1)%3;setCal(rotPts(cal.pts,1));} break;
    case 'arm': mode='arming'; armT=m.t; break;
    case 'pause': paused=m.on; break;
    case 'rebase': if(trk.ok&&frame){rebase();} break;
    case 'sens': sens=m.v; break;
    case 'frame': {
      PH=m.h; frame={data:new Uint8ClampedArray(m.buf),width:m.w,height:m.h};
      const t=m.t,t0=Date.now();
      if(mode==='scan')scanStep(); else if(mode==='arming'){track(); if(t-armT>1100){ if(trk.ok){rebase();mode='play';post('playing');} else armT=t; }}
      else if(mode==='play'){track();cvStep(t);}
      if(cal)updatePose(); else pose3.ok=false;
      post('pose',{ms:Date.now()-t0,ok:trk.ok,q:trk.q,rms:trk.rms,lost:trk.lost,jump:trk.jump,locked:scan.locked,manual:scan.manual,mode,pts:cal?cal.pts:null,H:cal?cal.H:null,
        pose3:pose3.ok?{r1:pose3.r1,r2:pose3.r2,r3:pose3.r3,t:pose3.t,f:pose3.f,cx:pose3.cx,cy:pose3.cy}:null,balls:cv.balls.map(b=>[b.u,b.v]),rings:[R_BULL,R_IN,R_RIM]});
      break; }
  }
};
