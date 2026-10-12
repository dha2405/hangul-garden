import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const dir='F:/gpt/hangul-garden/public';
const html=fs.readFileSync(dir+'/learning.html','utf8');
const ids=[...html.matchAll(/id="([^"]+)"/g)].map(x=>x[1]);
class Element{
 constructor(){this.children=[];this.dataset={};this.attrs={};this.disabled=false;this.style={setProperty(){}};this.classList={add(){},toggle(){}};this.events={};}
 play(){this.playCalls=(this.playCalls||0)+1;this.paused=false;return this.playError?Promise.reject(new Error('Playback blocked')):Promise.resolve()} pause(){this.paused=true;this.pauseCalls=(this.pauseCalls||0)+1}
 querySelectorAll(){return [...(this.innerHTML||'').matchAll(/<img /g)].map(()=>({decode:()=>Promise.resolve()}))} focus(){this.focused=true} append(e){this.children.push(e)} replaceChildren(...children){this.children=children} setAttribute(k,v){this.attrs[k]=v} addEventListener(k,fn){this.events[k]=fn} getBoundingClientRect(){return {width:360,height:155,left:0,top:0}} showModal(){this.open=true} close(){this.open=false} toDataURL(){return 'data:image/png;base64,test'} setPointerCapture(){} getContext(){return new Proxy({}, {get:(t,k)=>t[k]||(()=>{}),set:(t,k,v)=>(t[k]=v,true)})}
}
const elements=Object.fromEntries(ids.map(id=>[id,new Element()]));
const tabs=['read','trace','blank','dictation'].map(mode=>Object.assign(new Element(),{dataset:{mode}}));
const categories=['all','daily','animal','fruit','vegetable','institution','vehicle','sea','school'].map(category=>Object.assign(new Element(),{dataset:{category}}));
let printed=false;
const ctx=vm.createContext({crypto,document:{hidden:false,addEventListener(){},getElementById:id=>{assert.ok(elements[id],'Missing DOM id '+id);return elements[id]},createElement:()=>new Element(),documentElement:new Element(),querySelectorAll:s=>s==='[data-mode]'?tabs:s==='[data-category]'?categories:[]},window:{devicePixelRatio:1,addEventListener(){},print(){printed=true}},localStorage:{getItem:()=>null,setItem(){}},requestAnimationFrame:fn=>fn(),Image:class{},console});
vm.runInContext(fs.readFileSync(dir+'/sounds.js','utf8'),ctx);
vm.runInContext(fs.readFileSync(dir+'/dictation.js','utf8'),ctx);
vm.runInContext(fs.readFileSync(dir+'/app.js','utf8'),ctx);
const run=s=>vm.runInContext(s,ctx);
assert.equal(run('words.length'),162);
assert.equal(run('words.filter(w=>w.group==="animal").length'),20);
assert.equal(run('new Set(words.map(w=>w.word)).size'),162);
for(let i=0;i<162;i++){
 run('selectWord('+i+')');
 assert.equal(elements.mainPhoto.src,'assets/'+run('words[index].photo'));
 assert.ok(fs.existsSync(dir+'/'+elements.mainPhoto.src));
 for(let b=0;b<run('words[index].word.length');b++){
  run('blank='+b+'; renderBlank()');
  assert.equal(elements.choices.children.length,3);
  const answer=run('words[index].word[blank]');
  const wrong=elements.choices.children.find(x=>x.textContent!==answer);
  wrong.onclick();assert.equal(elements.blankResult.textContent,'X');assert.equal(elements.blankResult.hidden,false);assert.match(elements.feedback.textContent,/다시/);
  const correct=elements.choices.children.find(x=>x.textContent===answer);
  correct.onclick();assert.equal(elements.blankResult.textContent,'O');assert.match(elements.feedback.textContent,/잘했어요/);
  assert.equal(elements.blankWord.children[b].textContent,answer);
  assert.ok(elements.choices.children.every(x=>x.disabled));
  elements.retry.onclick();assert.equal(elements.blankResult.hidden,true);assert.equal(elements.feedback.textContent,'');
 }
 run('size=80; setSize(); setMode("trace")');assert.equal(elements.tracePanel.hidden,false);assert.equal(elements.writing.width,360);
 if(run('Boolean(words[index].facility)')){assert.equal(elements.photoInfo.hidden,false);assert.ok(elements.photoInfo.innerHTML.includes(run('words[index].facility')));assert.ok(!run('words[index].alt').includes('AI'));}
 run('updateSheet()');if(run('Boolean(words[index].facility)'))assert.ok(elements.sheetMount.innerHTML.includes(run('escapeHTML(words[index].source)')));assert.equal((elements.sheetMount.innerHTML.match(/class="sheet-section"/g)||[]).length,3);assert.ok(elements.sheetMount.innerHTML.includes(run('words[index].word')));
}
categories[2].onclick();assert.equal(elements.wordList.children.length,20);assert.equal(elements.wordCount.textContent,'1 / 20');assert.equal(elements.previous.disabled,true);
for(let i=1;i<20;i++)elements.next.onclick();assert.equal(elements.wordCount.textContent,'20 / 20');assert.equal(elements.next.disabled,true);
categories[1].onclick();assert.equal(elements.wordList.children.length,20);assert.equal(elements.wordCount.textContent,'1 / 20');assert.equal(elements.next.disabled,false);assert.equal(elements.previous.disabled,true);
for(const [cat,count] of [[1,20],[3,22],[4,20],[5,20],[6,20],[7,20],[8,20]]){categories[cat].onclick();assert.equal(elements.wordList.children.length,count);assert.equal(elements.wordCount.textContent,'1 / '+count);for(let i=1;i<count;i++)elements.next.onclick();assert.equal(elements.wordCount.textContent,count+' / '+count);assert.equal(elements.next.disabled,true);for(let i=1;i<count;i++)elements.previous.onclick();assert.equal(elements.wordCount.textContent,'1 / '+count);assert.equal(elements.previous.disabled,true);}
for(const word of ['파인애플','블루베리','파프리카','보건지소','읍사무소','면사무소','문화회관','전동킥보드','쓰레기통','스케치북','크레파스']){
 const i=run('words.findIndex(w=>w.word==='+JSON.stringify(word)+')');
 elements.writing.getBoundingClientRect=()=>({width:240,height:155,left:0,top:0});
 run('category="all"; selectWord('+i+'); size=80; setSize(); setMode("trace"); resizeCanvas()');
 const fontPx=Number(run('ctx.font').match(/([0-9.]+)px/)[1]);
 assert.ok(fontPx*word.length<=224,'Long word should fit the narrow drawing surface');
 run('updateSheet()');assert.ok(elements.sheetMount.innerHTML.includes('font-size="80"'));
 assert.equal((elements.sheetMount.innerHTML.match(/class="write-box"/g)||[]).length,word.length);
}
elements.worksheetBtn.onclick();assert.equal(elements.worksheetDialog.open,true);await elements.printSheet.onclick();assert.equal(printed,true);
elements.printScope.value='all';const oldIndex=run('index'),oldBlank=run('blank');elements.printScope.onchange();assert.equal((elements.printMount.innerHTML.match(/class="sheet"/g)||[]).length,162);assert.equal(run('index'),oldIndex);assert.equal(run('blank'),oldBlank);
elements.printScope.value='filtered';categories[2].onclick();elements.printScope.onchange();assert.equal((elements.printMount.innerHTML.match(/class="sheet"/g)||[]).length,20);
elements.printScope.value='current';elements.printScope.onchange();assert.equal((elements.printMount.innerHTML.match(/class="sheet"/g)||[]).length,1);
console.log('PASS: current, filtered and all 162 A4 sheets; image loading before print; study state preserved');
const available=run('words.map((w,i)=>({w,i})).filter(x=>soundLibrary[x.w.word])');
assert.equal(available.length,40,'All 20 animal and 20 vehicle words have real recordings');
assert.equal(elements.naturalSound.playCalls||0,0,'No sound auto-plays when browsing');
for(const {w,i} of available){
 run('selectWord('+i+')');assert.equal(elements.soundPanel.hidden,false);assert.equal(elements.playSound.disabled,false);
 const record=run('soundLibrary[words[index].word]');assert.ok(fs.existsSync(dir+'/'+record.src));
 await elements.playSound.onclick();assert.equal(elements.naturalSound.paused,false);assert.equal(elements.naturalSound.src,record.src);assert.equal(elements.playSound.attrs['aria-pressed'],'true');
 elements.naturalSound.currentTime=(record.start||0)+6;elements.naturalSound.events.timeupdate();assert.equal(elements.naturalSound.paused,true);assert.equal(elements.playSound.attrs['aria-pressed'],'false');
 await elements.playSound.onclick();elements.stopSound.onclick();assert.equal(elements.naturalSound.paused,true);
 await elements.playSound.onclick();run('selectWord(0)');assert.equal(elements.naturalSound.paused,true);assert.equal(elements.soundPanel.hidden,true);
}
run('selectWord('+available[0].i+')');elements.naturalSound.playError=true;await elements.playSound.onclick();assert.equal(elements.naturalSound.paused,true);assert.match(elements.soundStatus.textContent,/재생할 수 없어요/);elements.naturalSound.playError=false;
elements.soundVolume.oninput({target:{value:'50'}});assert.equal(elements.naturalSound.volume,.5);assert.equal(elements.volumeValue.textContent,'50%');
console.log('PASS:  162 photos and all nine categories; every blank position, wrong/correct/retry, tracing initialization, font size 80, three worksheet sections, filtered navigation and print trigger; manual audio play, stop, 6-second limit, navigation cleanup, blocked-playback recovery and volume.');


run("selectWord(0);renderBlank();soundVolume=30;feedbackEnabled=true");
let bad=elements.choices.children.find(x=>x.textContent!==run('words[index].word[blank]'));
bad.onclick();assert.equal(elements.feedbackSound.src,'assets/feedback-retry.wav');
let good=elements.choices.children.find(x=>x.textContent===run('words[index].word[blank]'));
good.onclick();assert.equal(elements.feedbackSound.src,'assets/feedback-correct.wav');
let plays=elements.feedbackSound.playCalls;good.onclick();assert.equal(elements.feedbackSound.playCalls,plays);
run('renderBlank();feedbackEnabled=false');elements.choices.children[0].onclick();assert.equal(elements.feedbackSound.playCalls,plays);
run('renderBlank();feedbackEnabled=true;soundVolume=0');elements.choices.children[0].onclick();assert.equal(elements.feedbackSound.playCalls,plays);
run('soundVolume=30;renderBlank()');elements.choices.children[0].onclick();run("setMode('read')");assert.equal(elements.feedbackSound.paused,true);
assert.ok(fs.existsSync(dir+'/assets/feedback-correct.wav'));assert.ok(fs.existsSync(dir+'/assets/feedback-retry.wav'));
console.log('PASS: correct/retry effects, repeat-answer guard, mute, zero volume, mode cleanup');

run('category="all";searchTerm="";selectWord(0)');
elements.wordSearch.value='연필';elements.wordSearch.oninput({isComposing:false});assert.equal(elements.wordList.children.length,2);assert.equal(run('words[index].word'),'연필');elements.next.onclick();assert.equal(run('words[index].word'),'색연필');
elements.wordSearch.value='바다 거북';elements.wordSearch.oninput({isComposing:false});assert.equal(run('words[index].word'),'바다거북');
elements.wordSearch.value='없는낱말';elements.wordSearch.oninput({isComposing:false});assert.equal(elements.wordList.children.length,0);assert.equal(elements.learningCard.hidden,true);assert.equal(elements.searchEmpty.hidden,false);assert.equal(elements.next.disabled,true);assert.equal(elements.worksheetBtn.disabled,true);
categories[8].onclick();assert.equal(elements.wordList.children.length,0);elements.resetSearch.onclick();assert.equal(elements.wordList.children.length,20);assert.equal(elements.learningCard.hidden,false);assert.equal(elements.worksheetBtn.disabled,false);
categories[0].onclick();elements.wordSearch.events.compositionstart();elements.wordSearch.value='고';elements.wordSearch.oninput({isComposing:true});assert.equal(elements.wordList.children.length,162);
elements.wordSearch.value='고양이';elements.wordSearch.events.compositionend();assert.equal(elements.wordList.children.length,1);assert.equal(run('words[index].word'),'고양이');
categories[8].onclick();assert.equal(elements.wordList.children.length,0);categories[2].onclick();assert.equal(elements.wordList.children.length,1);elements.clearSearch.onclick();assert.equal(elements.wordList.children.length,20);assert.equal(elements.clearSearch.hidden,true);
console.log('PASS: partial search, spacing, result navigation, empty results, categories, clear, Korean IME');

run('category="all";searchTerm="";selectWord(0);Math.random=()=>0.99');
elements.blankPosition.onchange({target:{value:'random'}});assert.equal(run('blank'),1);assert.equal(elements.blankPosition.value,'random');elements.retry.onclick();assert.equal(run('blank'),1);
run("Math.random=()=>0;selectWord(words.findIndex(w=>w.word==='전동킥보드'))");assert.equal(run('blank'),0);assert.equal(elements.blankPosition.value,'random');
elements.blankPosition.onchange({target:{value:'2'}});assert.equal(run('blankRandom'),false);elements.retry.onclick();assert.equal(run('blank'),2);
const captured=[];ctx.window.LearningProgress={answer:x=>captured.push(x),setContext:x=>{}};
run('renderBlank()');elements.choices.children[0].onclick();assert.equal(captured.length,1);assert.equal(captured[0].blank,2);assert.match(captured[0].round,/^[a-f0-9-]{36}$/);
console.log('PASS: random blank, new-word random, retry, manual position and recording actual blank');

const dictRecords=[];const dictContexts=[];ctx.window.LearningProgress={answer:x=>dictRecords.push(x),setContext:x=>dictContexts.push(x)};
run("size=160;setSize();selectWord(0);setMode('dictation')");
assert.equal(elements.fontValue.textContent,'160px');assert.equal(elements.dictationPanel.hidden,false);assert.equal(elements.readPanel.hidden,true);assert.equal(elements.soundPanel.hidden,true);assert.equal(elements.mainPhoto.alt,'받아쓰기 문제 사진');
assert.equal(elements.dictAnswer.hidden,true);elements.dictReveal.onclick();assert.equal(elements.dictAnswer.textContent,'사과');assert.equal(elements.dictManualCheck.hidden,false);elements.dictMarkCorrect.onclick();assert.equal(elements.dictWriteResult.textContent,'O');elements.dictMarkWrong.onclick();assert.equal(elements.dictWriteResult.textContent,'X');elements.dictClear.onclick();assert.equal(elements.dictAnswer.hidden,true);assert.equal(elements.dictWriteResult.hidden,true);
elements.dictCanvas.events.pointerdown({clientX:10,clientY:20,pointerId:1,preventDefault(){}});
elements.dictCanvas.events.pointermove({clientX:30,clientY:40});elements.dictCanvas.events.pointerup();
elements.dictChoice.onclick();assert.equal(elements.dictChoices.children.length,3);assert.equal(new Set(elements.dictChoices.children.map(x=>x.textContent)).size,3);
const right=elements.dictChoices.children.find(x=>x.textContent==='사과');const wrong=elements.dictChoices.children.find(x=>x!==right);
wrong.onclick();assert.equal(elements.dictResult.textContent,'X');assert.match(elements.dictFeedback.textContent,/다시/);right.onclick();assert.equal(elements.dictResult.textContent,'O');assert.match(elements.dictFeedback.textContent,/잘했어요/);right.onclick();assert.equal(dictRecords.length,2);assert.equal(dictRecords[1].mode,'dictation_choice');assert.equal(dictRecords[1].chosen,'사과');assert.equal(dictRecords[0].round,dictRecords[1].round);
elements.dictRetry.onclick();assert.equal(elements.dictResult.hidden,true);assert.ok(elements.dictChoices.children.every(x=>!x.disabled));elements.dictWrite.onclick();assert.equal(dictContexts.at(-1).mode,'dictation_write');
run("selectWord(1)");assert.equal(elements.dictAnswer.hidden,true);run("setMode('read')");assert.equal(elements.dictationPanel.hidden,true);
console.log('PASS: 160px, dictation blank canvas, pen input, reveal/clear, picture only, three unique choices, correct/wrong/retry and record mode');

const spoken=[];let canceled=0;
ctx.window.speechSynthesis={};ctx.speechSynthesis={getVoices:()=>[{lang:'ko-KR'}],cancel(){canceled++},speak:u=>spoken.push(u)};ctx.SpeechSynthesisUtterance=class{constructor(text){this.text=text}};
run("selectWord(0);setMode('dictation')");elements.dictSpeak.onclick();assert.equal(spoken.length,1);assert.equal(spoken[0].text,'사과');assert.equal(spoken[0].lang,'ko-KR');assert.equal(spoken[0].rate,.7);assert.equal(spoken[0].volume,run('soundVolume/100'));
elements.dictSpeak.onclick();assert.equal(spoken.length,2);assert.ok(canceled>=2);
run("setMode('blank')");assert.equal(elements.dictationPanel.hidden,true);
delete ctx.window.speechSynthesis;elements.dictSpeak.onclick();assert.match(elements.dictSpeechNote.textContent,/선생님/);
assert.ok(fs.readFileSync(dir+'/style.css','utf8').includes('.question-active #wordList .word-choice span{display:none}'));
console.log('PASS: Korean dictation speech, repeat cancellation, configured volume, unavailable speech guidance and hidden sidebar text in question modes');
