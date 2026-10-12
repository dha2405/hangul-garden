'use strict';
(()=>{
 const $=id=>document.getElementById(id),key='hangul-garden-student-session';
 let session=null,queue=[],sending=false,context=null,sessionExpired=false;const seen=new Set();
 try{session=JSON.parse(localStorage.getItem(key)||'null');if(session)queue=JSON.parse(localStorage.getItem('hangul-garden-queue-'+session.id)||'[]');}catch{session=null;queue=[];}
 function save(){try{if(session){localStorage.setItem(key,JSON.stringify(session));localStorage.setItem('hangul-garden-queue-'+session.id,JSON.stringify(queue));}}catch{$('studentRecordStatus').textContent='이 기기의 저장 공간을 확인해 주세요.';}}
 function status(text){$('studentRecordStatus').textContent=text;}
 function display(){$('studentLabel').textContent=session?session.alias+' · '+session.className:'자유 학습 중';$('studentJoin').textContent=session?'학생 변경':'학생 참여';$('completeActivity').disabled=!session||!context||['blank','dictation_choice'].includes(context.mode);$('completeActivity').textContent=['blank','dictation_choice'].includes(context?.mode)?'정답을 맞히면 완료돼요':'✓ 학습 완료';}
 async function flush(){
  if(sending||!session||!queue.length)return;sending=true;
  try{while(queue.length){status('기록을 저장하고 있어요. '+queue.length+'개');const response=await fetch('/api/progress/events',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.token},body:JSON.stringify(queue[0])});
   if(!response.ok){if(response.status===401){sessionExpired=true;throw new Error('참여 코드로 다시 들어와 주세요.');}if(response.status===400){queue.shift();save();continue;}throw new Error('인터넷 연결 후 다시 저장해 주세요.');}
   queue.shift();save();
  }status('✓ 학습 기록이 저장됐어요.');
  }catch(error){status(error.message||'인터넷 연결 후 다시 저장해 주세요.');}
  finally{sending=false;$('retryRecords').hidden=!queue.length;}
 }
 function record(data){if(!session)return;if(queue.length>=1000){status('저장할 기록이 많아요. 인터넷 연결 후 다시 저장해 주세요.');return;}queue.push({id:crypto.randomUUID(),occurredAt:Date.now(),...data});save();$('retryRecords').hidden=false;flush();}
 function visit(){if(!session||!context)return;const k=context.word+':'+context.mode;if(seen.has(k))return;seen.add(k);record({...context,kind:'seen'});}
 window.LearningProgress={
  setContext(next){context=next;display();visit();},
  answer(answer){record({word:answer.word,mode:answer.mode||'blank',kind:'answer',round:answer.round,blank:answer.blank,chosen:answer.chosen});}
 };
 $('completeActivity').onclick=()=>{if(session&&context&&!['blank','dictation_choice'].includes(context.mode))record({...context,kind:'complete'});};
 $('retryRecords').onclick=flush;
 $('studentJoin').onclick=()=>{
  if(session&&queue.length&&!sessionExpired){status('학생을 바꾸기 전에 저장할 기록 '+queue.length+'개를 먼저 저장해 주세요.');flush();return;}
  $('studentCode').value='';$('joinError').textContent='';$('studentDialog').showModal();$('studentCode').focus();
 };
 $('closeStudentDialog').onclick=()=>$('studentDialog').close();
 $('joinStudentForm').onsubmit=async e=>{
  e.preventDefault();$('confirmStudentJoin').disabled=true;$('joinError').textContent='';
  try{
   const response=await fetch('/api/progress/join',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:$('studentCode').value})});
   const result=await response.json();if(!response.ok)throw new Error(result.error||'다시 시도해 주세요.');
   if(queue.length&&session&&session.id!==result.id)throw new Error('먼저 같은 학생의 참여 코드로 들어와 저장할 기록을 저장해 주세요.');session=result;sessionExpired=false;seen.clear();save();display();$('studentDialog').close();status('학습한 내용을 선생님께 저장해요.');visit();history.replaceState(null,'',location.pathname+location.search);
  }catch(error){$('joinError').textContent=error.message;}finally{$('confirmStudentJoin').disabled=false;}
 };
 $('practiceMode').onclick=()=>{if(queue.length){status('기록을 먼저 저장한 뒤 자유 학습으로 바꿔주세요.');flush();return;}session=null;seen.clear();try{localStorage.removeItem(key);}catch{}display();status('자유 학습은 학생 기록을 저장하지 않아요.');$('studentDialog').close();};
 window.addEventListener('online',flush);setInterval(()=>{if(!document.hidden)flush();},15000);
 display();$('retryRecords').hidden=!queue.length;
 if(session){status(queue.length?'저장 대기 중인 기록이 있어요.':'학생으로 참여 중이에요.');fetch('/api/progress/session',{headers:{Authorization:'Bearer '+session.token}}).then(async r=>{if(r.ok){Object.assign(session,await r.json());save();display();flush();}else if(r.status===401){sessionExpired=true;status('참여 코드로 다시 들어와 주세요.');}}).catch(()=>status('인터넷 연결 후 기록을 저장해요.'));}
 const code=new URLSearchParams(location.hash.slice(1)).get('student');if(code&&!session){$('studentCode').value=code;$('studentDialog').showModal();}
})();