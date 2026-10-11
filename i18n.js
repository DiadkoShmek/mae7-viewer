import {catalog} from './i18n-catalog.js';
const reverse=new Map(Object.entries(catalog).map(([uk,et])=>[et,uk]));
const entries=Object.entries(catalog).sort(([a],[b])=>b.length-a.length),letters=/[А-Яа-яІіЇїЄєҐґ]/;
const escapePattern=text=>text.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
// Match the longest authored phrase once. Repeated replacements previously
// translated short words inside longer phrases before they could match.
const alphabet='А-Яа-яІіЇїЄєҐґ';
const authoredPattern=new RegExp(entries.map(([uk])=>(letters.test(uk[0])?`(?<![${alphabet}])`:'')+escapePattern(uk)+(letters.test(uk.at(-1))?`(?![${alphabet}])`:'')).join('|'),'gu');
const translationCache=new Map();
const units=[[/\bВт\/(м·К)/g,'W/(m·K)'],[/мм/g,'mm'],[/м²/g,'m²'],[/\bкН/g,'kN'],[/кПа/g,'kPa'],[/г\/м²/g,'g/m²']];
const phrases=[
 [/(\d+) на (\d+) мм/g,(_,width,height)=>`${width} × ${height} mm`],
 [/^Розкладка плит фасаду (.+), варіант (.+)\. Помаранчеві деталі мають конфлікти крайових відстаней\.$/,(_,face,variant)=>`Fassaadiplaatide paigutus: ${translate(face)} · variant ${variant}. Oranžidel detailidel on servakauguste konfliktid.`],
 [/^(\d+) деталі фасаду · проріз ([\d ×]+) мм\.$/,(_,n,size)=>`${n} fassaadidetaili · ava ${size} mm.`],
 [/^Усі розміри фасаду · (\d+)$/,(_,n)=>`Kõik fassaadi mõõdud · ${n}`],
 [/^На моделі: (\d+) \/ (\d+) · усі значення у списку$/,(_,n,total)=>`Mudelil: ${n} / ${total} · kõik väärtused on loendis`],
 [/^Наблизити вхід (\d+)$/,(_,n)=>`Vaata sissepääsu ${n} lähemalt`],
 [/^Матеріал ([\d ,]+) мм\. Відкрий фактичний профіль цієї деталі; примикання й кріплення ще звіряємо\.$/,(_,n)=>`Materjal ${n} mm. Vaata detaili tegelikku profiili; liiteid ja kinnitusi veel kontrollitakse.`],
 [/^Осі ([\d ,]+) мм; чистий проміжок ([\d ,]+) мм\. Відкрий зріз цієї дошки\.$/,(_,a,b)=>`Telgede samm ${a} mm; puhas vahe ${b} mm. Vaata selle roovi lõiget.`],
 [/^P070 · 8 мм · (\d+) отворів Ø8 мм\. Відкрий креслення цієї панелі й місце її заготовки на листі\.$/,(_,n)=>`P070 · 8 mm · ${n} ava Ø8 mm. Vaata plaadi joonist ja tooriku paigutust lehel.`],
 [/^([\d ,]+ × [\d ,]+) мм · показові розміри\. Оглядова копія цієї деталі не додає закупівлю\.$/,(_,size)=>`${size} mm · näitlikud mõõdud. Detaili vaatamiseks loodud koopia ei lisa ostukogust.`]
];
export function translate(text,language='et'){
 if(language==='uk')return reverse.get(text)??text;
 if(catalog[text])return catalog[text];
 if(!letters.test(text))return text;
 if(translationCache.has(text))return translationCache.get(text);
 // Dynamic fragments still contain authored words around numbers and IDs.
 // Continue through the catalog after replacing them, rather than returning
 // a half-translated accessible label.
 let out=text;
 for(const [pattern,replacement] of phrases){pattern.lastIndex=0;if(pattern.test(out)){pattern.lastIndex=0;out=out.replace(pattern,replacement);}}
 // Exact authored phrases may form a composite label with an ID or number.
 // Word boundaries prevent partial Ukrainian words becoming mixed-language.
 out=out.replace(authoredPattern,uk=>catalog[uk]);
 for(const [pattern,replacement] of units)out=out.replace(pattern,replacement);
 translationCache.set(text,out);return out;
}
export function startLanguageUI(document,storage=globalThis.localStorage){
 let language='et';try{const saved=storage.getItem('mae7-language');if(saved==='uk')language='uk';}catch{}
 const textState=new WeakMap(),attributeState=new WeakMap(),missing=new Set(),skip='script,style,code,button[data-language],[data-i18n-source]';
 const renderedSources=new Map(reverse),canonical=v=>renderedSources.get(v)??v;
 function value(node,current,map,key){const previous=map.get(key);const source=current===previous?.rendered?previous.source:canonical(current);const rendered=translate(source,language);map.set(key,{source,rendered});renderedSources.set(rendered,source);return rendered;}
 function text(node){if(node.parentElement?.closest(skip))return;const current=node.nodeValue,core=current.trim();if(!core)return;let state=textState.get(node);if(!state){state=new Map();textState.set(node,state);}const rendered=value(node,core,state,'text');const next=current.replace(core,rendered);if(next!==current)node.nodeValue=next;if(language==='et'&&letters.test(rendered))missing.add(core);}
 const attrs=['aria-label','title','alt','placeholder','content'];
 function element(node){if(node.matches(skip))return;let state=attributeState.get(node);if(!state){state=new Map();attributeState.set(node,state);}for(const attr of attrs){const current=node.getAttribute(attr);if(current===null)continue;const rendered=value(node,current,state,attr);if(rendered!==current)node.setAttribute(attr,rendered);}}
 function walk(root){if(root.nodeType===3){text(root);return;}if(root.nodeType!==1&&root.nodeType!==9)return;if(root.nodeType===1)element(root);const walker=document.createTreeWalker(root,NodeFilter.SHOW_ELEMENT|NodeFilter.SHOW_TEXT);while(walker.nextNode()){const node=walker.currentNode;if(node.nodeType===3)text(node);else element(node);}}
 function setLanguage(next){if(!['et','uk'].includes(next))return;language=next;document.documentElement.lang=language;document.documentElement.dataset.language=language;for(const button of document.querySelectorAll('[data-language]'))button.setAttribute('aria-pressed',String(button.dataset.language===language));walk(document.documentElement);try{storage.setItem('mae7-language',language);}catch{}document.dispatchEvent(new CustomEvent('mae7-language-change',{detail:{language}}));}
 for(const button of document.querySelectorAll('[data-language]'))button.addEventListener('click',()=>setLanguage(button.dataset.language));
 const observer=new MutationObserver(records=>{for(const r of records){if(r.type==='characterData')text(r.target);else if(r.type==='attributes')element(r.target);else for(const node of r.addedNodes)walk(node);}});
 observer.observe(document.documentElement,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:attrs});setLanguage(language);
 return {setLanguage,get language(){return language;},missing,disconnect(){observer.disconnect();}};
}
if(typeof document!=='undefined')startLanguageUI(document);
