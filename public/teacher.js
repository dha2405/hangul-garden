'use strict';
(()=>{
 const $=id=>document.getElementById(id);let classId='',overview=null,busy=false,detailId='',epoch=0,detailEpoch=0,pendingRefresh=false;
 const date=value=>value?new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',month:'numeric',day:'numeric',hour:'numeric',minute:'2-digit'}).format(new Date(value)):'아직 학습 전';
 const percent=(n,d)=>d?Math.round(n/d*100)+'%':'—';
 const node=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e;};
 async function api(path,body){const r=await fetch('/api/progress/'+path,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined});const data=await r.json();if(!r.ok)throw new Error(data.error||'다시 시도해 주세요.');return data;}
 function message(text){$('teacherStatus').textContent=text;}
 async function copy(text){try{await navigator.clipboard.writeText(text);message('복사했어요.');}catch{message('복사하지 못했어요. 표시된 코드를 직접 적어 주세요.');}}
 
 function filterQuery(prefix){const from=$(prefix+'From').value,to=$(prefix+'To').value,group=$(prefix+'Group').value||'all';if(from&&to&&from>to)throw new Error('시작일은 종료일보다 늦을 수 없어요.');return new URLSearchParams({from,to,group}).toString();}
 function filterLabel(prefix){const group=$(prefix+'Group');return ($(prefix+'From').value||'처음')+' ~ '+($(prefix+'To').value||'오늘까지')+' · '+group.options[group.selectedIndex].textContent;}
 function resetFilter(prefix){$(prefix+'From').value='';$(prefix+'To').value='';$(prefix+'Group').value='all';}

 async function loadClasses(selected){
  const data=await api('classes');$('classSelect').replaceChildren();for(const c of data.classes){const o=node('option',c.name);o.value=c.id;$('classSelect').append(o);}
  classId=selected||data.classes[0]?.id||'';$('classSelect').value=classId;$('studentForm').hidden=!classId;$('classEmpty').hidden=Boolean(classId);
  if(classId)await refresh();else{$('studentRows').replaceChildren();$('summaryCards').replaceChildren();$('exportCsv').disabled=true;}
 }
 async function refresh(){
  if(!classId)return;if(busy){pendingRefresh=true;epoch++;return;}let query;try{query=filterQuery('roster');}catch(error){$('rosterFilterStatus').textContent=error.message;return;}busy=true;const selected=classId,current=++epoch;$('rosterFilterStatus').textContent='기록을 조회하고 있어요.';$('exportCsv').disabled=true;
  try{const data=await api('overview?classId='+encodeURIComponent(selected)+'&'+query);if(classId!==selected||current!==epoch)return;overview=data;draw(data);$('rosterFilterStatus').textContent=filterLabel('roster');message('마지막 확인: '+date(Date.now()));}
  catch(error){if(current===epoch){overview=null;$('studentRows').replaceChildren();$('summaryCards').replaceChildren();$('rosterFilterStatus').textContent=error.message;message(error.message);}}finally{busy=false;if(pendingRefresh){pendingRefresh=false;refresh();}}
 }
 function draw(data){
  $('summaryCards').replaceChildren();const total=data.students.reduce((a,s)=>a+Number(s.attempts||0),0),correct=data.students.reduce((a,s)=>a+Number(s.correct||0),0);
  for(const [label,value] of [['참여 학생',data.students.length+'명'],['학습 시작',data.students.filter(s=>s.last_active).length+'명'],['정답 / 시도',correct+' / '+total],['정답률',percent(correct,total)]]){const card=node('div');card.className='summary-card';card.append(node('small',label),node('strong',value));$('summaryCards').append(card);}
  $('studentRows').replaceChildren();$('rosterEmpty').hidden=Boolean(data.students.length);$('exportCsv').disabled=!data.students.length;
  for(const s of data.students){
   const tr=node('tr');tr.append(node('td',s.alias));
   const code=node('td');const label=node('code',s.code.match(/.{1,4}/g).join('-'));const cb=node('button','코드 복사');cb.onclick=()=>copy(s.code);const link=node('button','참여 링크');link.onclick=()=>copy(location.origin+'/learning.html#student='+s.code);code.append(label,cb,link);tr.append(code);
   tr.append(node('td',s.completed_words+' / '+data.totalWords),node('td',s.completed_activities+' / '+data.totalActivities),node('td',(s.correct||0)+' / '+(s.wrong||0)),node('td',percent(s.correct,s.attempts)),node('td',(s.first_correct||0)+' / '+(s.rounds||0)),node('td',date(s.last_active)));
   const action=node('td'),b=node('button','자세히');b.onclick=()=>detail(s.id);action.append(b);tr.append(action);$('studentRows').append(tr);
  }
 }
 async function detail(id,preserve=false){
  if(!preserve){for(const suffix of ['From','To','Group'])$('detail'+suffix).value=$('roster'+suffix).value;}let query;try{query=filterQuery('detail');}catch(error){$('detailFilterStatus').textContent=error.message;return;}const current=++detailEpoch;detailId=id;$('detailSummary').textContent='';$('detailFilterStatus').textContent='기록을 조회하고 있어요.';$('detailTitle').textContent='학습 기록을 불러오고 있어요.';$('detailCompleted').replaceChildren();$('answerRows').replaceChildren();if(!$('studentDetail').open)$('studentDetail').showModal();
  try{const data=await api('detail?studentId='+encodeURIComponent(id)+'&'+query);if(detailId!==id||current!==detailEpoch)return;$('detailTitle').textContent=data.alias+'의 학습 기록';$('detailFilterStatus').textContent=filterLabel('detail');const n=data.summary;$('detailSummary').textContent='완료 낱말 '+n.completed_words+' / '+data.totalWords+' · 완료 활동 '+n.completed_activities+' / '+data.totalActivities+' · 정답 '+(n.correct||0)+' · 오답 '+(n.wrong||0)+' · 정답률 '+percent(n.correct,n.attempts);
   for(const c of data.completed){const item=node('li',c.word+' · '+({read:'보고 읽기',trace:'따라쓰기',blank:'빈칸 넣기',dictation_write:'받아쓰기 · 터치펜',dictation_choice:'받아쓰기 · 객관식'})[c.mode]+' · '+date(c.created));$('detailCompleted').append(item);}if(!data.completed.length)$('detailCompleted').append(node('li','완료한 활동이 아직 없어요.'));
   for(const a of data.answers){const tr=node('tr');tr.append(node('td',a.word),node('td',a.mode==='dictation_choice'?'받아쓰기 · 객관식':(a.blank+1)+'번째 글자'),node('td',a.chosen),node('td',a.correct?'정답':'다시 시도'),node('td',date(a.created)));$('answerRows').append(tr);}
   $('answerEmpty').hidden=Boolean(data.answers.length);
  }catch(error){if(current===detailEpoch){$('detailTitle').textContent=error.message;$('detailFilterStatus').textContent=error.message;}}
 }
 $('createClassForm').onsubmit=async e=>{e.preventDefault();$('createClass').disabled=true;try{const c=await api('classes',{name:$('className').value});$('className').value='';await loadClasses(c.id);}catch(error){message(error.message);}finally{$('createClass').disabled=false;}};
 $('studentForm').onsubmit=async e=>{e.preventDefault();$('addStudent').disabled=true;try{await api('students',{classId,alias:$('studentAlias').value});$('studentAlias').value='';await refresh();}catch(error){message(error.message);}finally{$('addStudent').disabled=false;}};
 $('classSelect').onchange=()=>{classId=$('classSelect').value;epoch++;overview=null;busy=false;refresh();};
 $('refreshTeacher').onclick=refresh;$('closeDetail').onclick=()=>{detailId='';detailEpoch++;$('studentDetail').close();};
 $('rosterFilterForm').onsubmit=e=>{e.preventDefault();refresh();};$('rosterReset').onclick=()=>{resetFilter('roster');refresh();};$('detailFilterForm').onsubmit=e=>{e.preventDefault();if(detailId)detail(detailId,true);};$('detailReset').onclick=()=>{resetFilter('detail');if(detailId)detail(detailId,true);};
 $('exportCsv').onclick=()=>{
  if(!overview)return;const safe=v=>'"'+String(v??'').replace(/^[=+@\-\t\r]/,"'$&").replaceAll('"','""')+'"';
  const rows=[['학생 번호/별명','완료 낱말','전체 낱말','완료 활동','전체 활동','정답','오답','정답률','첫 시도 정답','문제 수','마지막 학습','시작일','종료일','분류']];
  for(const s of overview.students)rows.push([s.alias,s.completed_words,overview.totalWords,s.completed_activities,overview.totalActivities,s.correct||0,s.wrong||0,percent(s.correct,s.attempts),s.first_correct||0,s.rounds||0,s.last_active?new Date(s.last_active).toISOString():'',overview.filters.from,overview.filters.to,overview.filters.group]);
  const blob=new Blob(['\uFEFF'+rows.map(r=>r.map(safe).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=node('a');a.href=url;a.download='한글놀이터-학생진도.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 };
 async function init(){try{const identity=await api('identity');$('teacherLogin').hidden=identity.signedIn;$('teacherWorkspace').hidden=!identity.signedIn;if(identity.signedIn){$('teacherName').textContent=identity.displayName+' 선생님';await loadClasses();}}catch(error){message(error.message);}}
 setInterval(()=>{if(!document.hidden)refresh();},30000);init();
})();