import{p as et}from"./chunk-JWPE2WC7-DflBTh35.js";import{g as at,s as rt,a as it,b as nt,n as st,m as ot,_ as l,l as z,c as lt,A as ct,D as dt,E as gt,d as ht,o as pt,B as ft}from"./vendor-mermaid-BVI92ksd.js";import{p as ut}from"./cynefin-VYW2F7L2-DVmhLqHj.js";import{A as U,B as mt,C as vt}from"./vendor-d3-zo1-0k1r.js";import"./vendor-ai-BFZOlLET.js";var St=ft.pie,R={sections:new Map,showData:!1},A=R.sections,L=R.showData,xt=structuredClone(St),wt=l(()=>structuredClone(xt),"getConfig"),Ct=l(()=>{A=new Map,L=R.showData,pt()},"clear"),$t=l(({label:t,value:a})=>{if(a<0)throw new Error(`"${t}" has invalid value: ${a}. Negative values are not allowed in pie charts. All slice values must be >= 0.`);A.has(t)||(A.set(t,a),z.debug(`added new section: ${t}, with value: ${a}`))},"addSection"),Dt=l(()=>A,"getSections"),yt=l(t=>{L=t},"setShowData"),At=l(()=>L,"getShowData"),V={getConfig:wt,clear:Ct,setDiagramTitle:ot,getDiagramTitle:st,setAccTitle:nt,getAccTitle:it,setAccDescription:rt,getAccDescription:at,addSection:$t,getSections:Dt,setShowData:yt,getShowData:At},Tt=l((t,a)=>{et(t,a),a.setShowData(t.showData),t.sections.map(a.addSection)},"populateDb"),bt={parse:l(async t=>{const a=await ut("pie",t);z.debug(a),Tt(a,V)},"parse")},_t=l(t=>`
  .pieCircle{
    stroke: ${t.pieStrokeColor};
    stroke-width : ${t.pieStrokeWidth};
    opacity : ${t.pieOpacity};
  }
  .pieCircle.highlighted{
    scale: 1.05;
    opacity: 1;
  }
  .pieCircle.highlightedOnHover:hover{
    transition-duration: 250ms;
    scale: 1.05;
    opacity: 1;
  }
  .pieOuterCircle{
    stroke: ${t.pieOuterStrokeColor};
    stroke-width: ${t.pieOuterStrokeWidth};
    fill: none;
  }
  .pieTitleText {
    text-anchor: middle;
    font-size: ${t.pieTitleTextSize};
    fill: ${t.pieTitleTextColor};
    font-family: ${t.fontFamily};
  }
  .slice {
    font-family: ${t.fontFamily};
    fill: ${t.pieSectionTextColor};
    font-size:${t.pieSectionTextSize};
    // fill: white;
  }
  .legend text {
    fill: ${t.pieLegendTextColor};
    font-family: ${t.fontFamily};
    font-size: ${t.pieLegendTextSize};
  }
`,"getStyles"),kt=_t,Et=l(t=>{const a=[...t.values()].reduce((s,m)=>s+m,0),W=[...t.entries()].map(([s,m])=>({label:s,value:m})).filter(s=>s.value/a*100>=1);return vt().value(s=>s.value).sort(null)(W)},"createPieArcs"),zt=l((t,a,W,B)=>{var I;z.debug(`rendering pie chart
`+t);const s=B.db,m=lt(),p=ct(s.getConfig(),m.pie),F=40,i=18,c=4,C=450,S=C,T=dt(a),$=T.append("g");$.attr("transform","translate("+S/2+","+C/2+")");const{themeVariables:n}=m;let[H]=gt(n.pieOuterStrokeWidth);H??(H=2);const X=p.legendPosition,M=p.textPosition,Z=p.donutHole>0&&p.donutHole<=.9?p.donutHole:0,f=Math.min(S,C)/2-F,j=U().innerRadius(Z*f).outerRadius(f),q=U().innerRadius(f*M).outerRadius(f*M),x=$.append("g");x.append("circle").attr("cx",0).attr("cy",0).attr("r",f+H/2).attr("class","pieOuterCircle");const D=s.getSections(),J=Et(D),K=[n.pie1,n.pie2,n.pie3,n.pie4,n.pie5,n.pie6,n.pie7,n.pie8,n.pie9,n.pie10,n.pie11,n.pie12];let b=0;D.forEach(e=>{b+=e});const O=J.filter(e=>(e.data.value/b*100).toFixed(0)!=="0"),_=mt(K).domain([...D.keys()]);x.selectAll("mySlices").data(O).enter().append("path").attr("d",j).attr("fill",e=>_(e.data.label)).attr("class",e=>{let r="pieCircle";return p.highlightSlice==="hover"?r+=" highlightedOnHover":p.highlightSlice===e.data.label&&(r+=" highlighted"),r}),x.selectAll("mySlices").data(O).enter().append("text").text(e=>(e.data.value/b*100).toFixed(0)+"%").attr("transform",e=>"translate("+q.centroid(e)+")").style("text-anchor","middle").attr("class","slice");const Q=$.append("text").text(s.getDiagramTitle()).attr("x",0).attr("y",-400/2).attr("class","pieTitleText"),w=[...D.entries()].map(([e,r])=>({label:e,value:r})),u=$.selectAll(".legend").data(w).enter().append("g").attr("class","legend");u.append("rect").attr("width",i).attr("height",i).style("fill",e=>_(e.label)).style("stroke",e=>_(e.label)),u.append("text").attr("x",i+c).attr("y",i-c).text(e=>s.getShowData()?`${e.label} [${e.value}]`:e.label);const v=Math.max(...u.selectAll("text").nodes().map(e=>(e==null?void 0:e.getBoundingClientRect().width)??0));let y=C,k=S+F;const o=i+c,E=w.length*o;switch(X){case"center":u.attr("transform",(e,r)=>{const d=o*w.length/2,g=-v/2-(i+c),h=r*o-d;return"translate("+g+","+h+")"});break;case"top":y+=E,u.attr("transform",(e,r)=>{const d=f,g=-v/2-(i+c),h=r*o-d;return`translate(${g}, ${h})`}),x.attr("transform",()=>`translate(0, ${E+o})`);break;case"bottom":y+=E,u.attr("transform",(e,r)=>{const d=-f-o,g=-v/2-(i+c),h=r*o-d;return"translate("+g+","+h+")"});break;case"left":k+=i+c+v,u.attr("transform",(e,r)=>{const d=o*w.length/2,g=-f-(i+c),h=r*o-d;return"translate("+g+","+h+")"}),x.attr("transform",()=>`translate(${v+i+c}, 0)`);break;case"right":default:k+=i+c+v,u.attr("transform",(e,r)=>{const d=o*w.length/2,g=12*i,h=r*o-d;return"translate("+g+","+h+")"});break}const P=((I=Q.node())==null?void 0:I.getBoundingClientRect().width)??0,Y=S/2-P/2,tt=S/2+P/2,G=Math.min(0,Y),N=Math.max(k,tt)-G;T.attr("viewBox",`${G} 0 ${N} ${y}`),ht(T,y,N,p.useMaxWidth)},"draw"),Rt={draw:zt},Ot={parser:bt,db:V,renderer:Rt,styles:kt};export{Ot as diagram};
