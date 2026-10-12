import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
class El{constructor(){this.events={};this.disabled=false;this.open=false;this.value='';}addEventListener(k,f){this.events[k]=f;}showModal(){this.open=true;}close(){this.open=false;}focus(){}}
const html=fs.readFileSync('public/learning.html','utf8'),els=Object.fromEntries([...html.matchAll(/id="([^"]+)"/g)].map(x=>[x[1],new El()])),storage=new Map(),events={},sent=[];
let offline=false,expired=false,joinId='student-a';
const fetcher=async(url,options)=>{
 if(url.endsWith('/join'))return Response.json({id:joinId,alias:joinId==='student-a'?'학생01':'학생02',className:'햇살반',token:'a'.repeat(64)});
 if(url.endsWith('/events')){sent.push({body:JSON.parse(options.body),authorization:options.headers.Authorization});if(offline)throw new Error('offline');if(expired)return Response.json({error:'expired'},{status:401});return Response.json({saved:true});}
 throw new Error('unexpected request');
};
const win={addEventListener:(k,f)=>events[k]=f},ctx=vm.createContext({document:{hidden:false,getElementById:id=>els[id]},window:win,localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},fetch:fetcher,crypto,URLSearchParams,location:{hash:'',pathname:'/learning.html',search:''},history:{replaceState(){}},setInterval(){},console});
vm.runInContext(fs.readFileSync('public/progress-client.js','utf8'),ctx);
const settle=async()=>{for(let i=0;i<25;i++)await Promise.resolve();};
win.LearningProgress.setContext({word:'사과',mode:'read'});assert.equal(sent.length,0);assert.equal(els.completeActivity.disabled,true);
await els.joinStudentForm.onsubmit({preventDefault(){}});await settle();assert.equal(sent[0].body.kind,'seen');assert.equal(els.completeActivity.disabled,false);
els.completeActivity.onclick();await settle();assert.equal(sent[1].body.kind,'complete');assert.equal(sent[1].body.word,'사과');
win.LearningProgress.setContext({word:'사과',mode:'blank'});await settle();assert.equal(els.completeActivity.disabled,true);
offline=true;const round=crypto.randomUUID();win.LearningProgress.answer({word:'사과',round,blank:1,chosen:'가'});await settle();
let queue=JSON.parse(storage.get('hangul-garden-queue-student-a'));assert.equal(queue.length,1);assert.equal(queue[0].blank,1);const id=queue[0].id;
els.studentJoin.onclick();await settle();assert.equal(els.studentDialog.open,false,'Do not reassign pending records to another student');
offline=false;events.online();await settle();queue=JSON.parse(storage.get('hangul-garden-queue-student-a'));assert.equal(queue.length,0);assert.equal(sent.at(-1).body.id,id,'Retry reuses the idempotency key');
expired=true;win.LearningProgress.answer({word:'사과',round:crypto.randomUUID(),blank:0,chosen:'사'});await settle();els.studentJoin.onclick();assert.equal(els.studentDialog.open,true);
joinId='student-b';await els.joinStudentForm.onsubmit({preventDefault(){}});assert.match(els.joinError.textContent,/같은 학생/);assert.equal(JSON.parse(storage.get('hangul-garden-student-session')).id,'student-a');
joinId='student-a';expired=false;await els.joinStudentForm.onsubmit({preventDefault(){}});await settle();assert.equal(JSON.parse(storage.get('hangul-garden-queue-student-a')).length,0);
console.log('PASS: anonymous practice, explicit completion, actual blank records, offline retry with stable event ID, pending-record student isolation, expired-session rejoin');
