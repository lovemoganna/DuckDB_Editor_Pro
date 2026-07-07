import{g as U,s as H,a as K,b as V,p as Z,o as j,_ as s,l as w,c as q,D as J,H as Q,K as X,d as Y,x as ee,E as te}from"./vendor-mermaid-mY658xPw.js";import{p as ae}from"./chunk-4BX2VUAB-DzSCGo6o.js";import{p as re}from"./treemap-KMMF4GRG-Dxxbic2v.js";import{A as G,B as ie,C as se}from"./vendor-d3-C6NLcHOR.js";import"./vendor-codemirror-CGQFcGUm.js";import"./min--OW7SMrp.js";import"./_baseUniq-jWpWn4sl.js";var le=te.pie,D={sections:new Map,showData:!1},g=D.sections,C=D.showData,oe=structuredClone(le),ne=s(()=>structuredClone(oe),"getConfig"),ce=s(()=>{g=new Map,C=D.showData,ee()},"clear"),pe=s(({label:e,value:a})=>{if(a<0)throw new Error(`"${e}" has invalid value: ${a}. Negative values are not allowed in pie charts. All slice values must be >= 0.`);g.has(e)||(g.set(e,a),w.debug(`added new section: ${e}, with value: ${a}`))},"addSection"),de=s(()=>g,"getSections"),ge=s(e=>{C=e},"setShowData"),ue=s(()=>C,"getShowData"),W={getConfig:ne,clear:ce,setDiagramTitle:j,getDiagramTitle:Z,setAccTitle:V,getAccTitle:K,setAccDescription:H,getAccDescription:U,addSection:pe,getSections:de,setShowData:ge,getShowData:ue},fe=s((e,a)=>{ae(e,a),a.setShowData(e.showData),e.sections.map(a.addSection)},"populateDb"),he={parse:s(async e=>{const a=await re("pie",e);w.debug(a),fe(a,W)},"parse")},me=s(e=>`
  .pieCircle{
    stroke: ${e.pieStrokeColor};
    stroke-width : ${e.pieStrokeWidth};
    opacity : ${e.pieOpacity};
  }
  .pieOuterCircle{
    stroke: ${e.pieOuterStrokeColor};
    stroke-width: ${e.pieOuterStrokeWidth};
    fill: none;
  }
  .pieTitleText {
    text-anchor: middle;
    font-size: ${e.pieTitleTextSize};
    fill: ${e.pieTitleTextColor};
    font-family: ${e.fontFamily};
  }
  .slice {
    font-family: ${e.fontFamily};
    fill: ${e.pieSectionTextColor};
    font-size:${e.pieSectionTextSize};
    // fill: white;
  }
  .legend text {
    fill: ${e.pieLegendTextColor};
    font-family: ${e.fontFamily};
    font-size: ${e.pieLegendTextSize};
  }
`,"getStyles"),ve=me,Se=s(e=>{const a=[...e.values()].reduce((r,l)=>r+l,0),$=[...e.entries()].map(([r,l])=>({label:r,value:l})).filter(r=>r.value/a*100>=1).sort((r,l)=>l.value-r.value);return se().value(r=>r.value)($)},"createPieArcs"),xe=s((e,a,$,y)=>{w.debug(`rendering pie chart
`+e);const r=y.db,l=q(),T=J(r.getConfig(),l.pie),A=40,o=18,p=4,c=450,u=c,f=Q(a),n=f.append("g");n.attr("transform","translate("+u/2+","+c/2+")");const{themeVariables:i}=l;let[b]=X(i.pieOuterStrokeWidth);b??(b=2);const E=T.textPosition,d=Math.min(u,c)/2-A,M=G().innerRadius(0).outerRadius(d),O=G().innerRadius(d*E).outerRadius(d*E);n.append("circle").attr("cx",0).attr("cy",0).attr("r",d+b/2).attr("class","pieOuterCircle");const h=r.getSections(),P=Se(h),R=[i.pie1,i.pie2,i.pie3,i.pie4,i.pie5,i.pie6,i.pie7,i.pie8,i.pie9,i.pie10,i.pie11,i.pie12];let m=0;h.forEach(t=>{m+=t});const _=P.filter(t=>(t.data.value/m*100).toFixed(0)!=="0"),v=ie(R);n.selectAll("mySlices").data(_).enter().append("path").attr("d",M).attr("fill",t=>v(t.data.label)).attr("class","pieCircle"),n.selectAll("mySlices").data(_).enter().append("text").text(t=>(t.data.value/m*100).toFixed(0)+"%").attr("transform",t=>"translate("+O.centroid(t)+")").style("text-anchor","middle").attr("class","slice"),n.append("text").text(r.getDiagramTitle()).attr("x",0).attr("y",-400/2).attr("class","pieTitleText");const k=[...h.entries()].map(([t,x])=>({label:t,value:x})),S=n.selectAll(".legend").data(k).enter().append("g").attr("class","legend").attr("transform",(t,x)=>{const F=o+p,L=F*k.length/2,N=12*o,B=x*F-L;return"translate("+N+","+B+")"});S.append("rect").attr("width",o).attr("height",o).style("fill",t=>v(t.label)).style("stroke",t=>v(t.label)),S.append("text").attr("x",o+p).attr("y",o-p).text(t=>r.getShowData()?`${t.label} [${t.value}]`:t.label);const I=Math.max(...S.selectAll("text").nodes().map(t=>(t==null?void 0:t.getBoundingClientRect().width)??0)),z=u+A+o+p+I;f.attr("viewBox",`0 0 ${z} ${c}`),Y(f,c,z,T.useMaxWidth)},"draw"),we={draw:xe},Ee={parser:he,db:W,renderer:we,styles:ve};export{Ee as diagram};
