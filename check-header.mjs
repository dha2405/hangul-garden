import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const html=fs.readFileSync('F:/gpt/hangul-garden/public/learning.html','utf8');
class Element {
 constructor(){this.children=[];this.attrs={};this.classes=new Set();this.classList={toggle:(n,on)=>on?this.classes.add(n):this.classes.delete(n)};}
 append(e){this.children.push(e);}setAttribute(k,v){this.attrs[k]=v;}
}
const ids=[...html.matchAll(/id="([^"]+)"/g)].map(x=>x[1]),els=Object.fromEntries(ids.map(x=>[x,new Element()]));
const events={},root=new Element(),body=new Element(),pending=[],saved=new Map();
const doc={documentElement:root,body,hidden:false,fullscreenElement:null,getElementById:id=>els[id],createElement:()=>new Element(),addEventListener:(k,f)=>events[k]=f};
root.requestFullscreen=async()=>{doc.fullscreenElement=root;events.fullscreenchange();};
doc.exitFullscreen=async()=>{doc.fullscreenElement=null;events.fullscreenchange();};
const FixedDate=class extends Date {constructor(...a){super(...(a.length?a:['2026-10-08T15:01:00Z']));}static now(){return new Date('2026-10-08T15:01:00Z').getTime();}};
const context=vm.createContext({document:doc,window:{addEventListener(){}},localStorage:{getItem:k=>saved.get(k)||null,setItem:(k,v)=>saved.set(k,v)},fetch:(url,opts)=>new Promise((resolve,reject)=>pending.push({url,opts,resolve,reject})),AbortController,URLSearchParams,Date:FixedDate,Intl,setTimeout:()=>1,clearTimeout(){},setInterval(){},console});
vm.runInContext(fs.readFileSync('F:/gpt/hangul-garden/public/header.js','utf8'),context);
const settle=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
const response=(temp=22,code=0)=>({ok:true,json:async()=>({current:{temperature_2m:temp,weather_code:code,is_day:1,time:'2026-10-09T00:00'}})});
assert.equal(els.weatherCity.value,'광양시');assert.equal(els.weatherCity.children.length,22);
assert.match(els.todayDate.textContent,/10월 9일/);assert.equal(els.todayDate.dateTime,'2026-10-09');assert.equal(els.todayTime.dateTime,'00:01');assert.match(els.todayTime.textContent,/오전/);
assert.match(pending[0].url,/latitude=34.9407/);
pending[0].resolve(response());await settle();
assert.equal(els.weatherText.textContent,'맑음 · 22℃');assert.equal(els.weatherRefresh.disabled,false);
els.weatherCity.onchange({target:{value:'목포시'}});assert.equal(saved.get('hangul-garden-weather-city'),'목포시');
els.weatherCity.onchange({target:{value:'순천시'}});
assert.equal(pending[1].opts.signal.aborted,true);
pending[2].resolve(response(19,61));await settle();pending[1].resolve(response(30,0));await settle();
assert.equal(els.weatherText.textContent,'비 · 19℃','An older city response must not replace the selected city');
els.weatherRefresh.onclick();pending[3].reject(new Error('offline'));await settle();assert.match(els.weatherText.textContent,/불러오지 못/);assert.equal(els.weatherRefresh.disabled,false);
els.weatherRefresh.onclick();pending[4].resolve(response(0,71));await settle();assert.equal(els.weatherText.textContent,'눈 · 0℃');
await els.fullscreenBtn.onclick();assert.equal(doc.fullscreenElement,root);assert.equal(els.fullscreenBtn.attrs['aria-pressed'],'true');
await els.fullscreenBtn.onclick();assert.equal(doc.fullscreenElement,null);assert.equal(els.fullscreenBtn.attrs['aria-pressed'],'false');
root.requestFullscreen=undefined;await els.fullscreenBtn.onclick();assert.equal(body.classes.has('learning-fullscreen'),true);assert.match(els.fullscreenStatus.textContent,/지원하지/);events.keydown({key:'Escape'});assert.equal(body.classes.has('learning-fullscreen'),false);
root.requestFullscreen=async()=>{throw new Error('denied')};await els.fullscreenBtn.onclick();assert.equal(body.classes.has('learning-fullscreen'),true);await els.fullscreenBtn.onclick();assert.equal(body.classes.has('learning-fullscreen'),false);
console.log('PASS: Korean date rollover, Gwangyang default, 22 cities, forecast, stale-response protection, failure/retry, fullscreen enter/exit and fallback Escape');
