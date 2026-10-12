import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '../../../chatgpt-auth';
import catalog from '../../../../word-catalog.json';
export const dynamic='force-dynamic';
const json=(data:any,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
const uuid=(v:any)=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const clean=(v:any,max=40)=>typeof v==='string'?v.trim().slice(0,max):'';
const random=(bytes=32)=>Array.from(crypto.getRandomValues(new Uint8Array(bytes))).map(x=>x.toString(16).padStart(2,'0')).join('');
async function hash(value:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))).map(x=>x.toString(16).padStart(2,'0')).join('');}
function db(){if(!env.DB)throw new Error('Database unavailable');return env.DB;}
async function all(sql:string,...args:any[]){return (await db().prepare(sql).bind(...args).all()).results as any[];}
async function one(sql:string,...args:any[]){return await db().prepare(sql).bind(...args).first() as any;}
async function newPin(){
 for(let i=0;i<100;i++){const n=crypto.getRandomValues(new Uint32Array(1))[0];if(n>=4294960000)continue;const pin=String(n%10000).padStart(4,'0');if(!await one('SELECT id FROM learning_students WHERE code=?',pin))return pin;}
 throw Object.assign(new Error('참여 코드를 발급하지 못했어요. 다시 시도해 주세요.'),{status:409});
}
async function convertPins(classId:string){
 const legacy=await all("SELECT id,code FROM learning_students WHERE class_id=? AND (length(code)<>4 OR code GLOB '*[^0-9]*')",classId);
 for(const st of legacy){for(let attempt=0;attempt<20;attempt++){const pin=await newPin();const result=await db().prepare('UPDATE OR IGNORE learning_students SET code=? WHERE id=? AND code=?').bind(pin,st.id,st.code).run();if(result.meta.changes)break;const current=await one('SELECT code FROM learning_students WHERE id=?',st.id);if(/^\d{4}$/.test(current?.code||''))break;}}
}
async function owner(){const u=await getChatGPTUser();if(!u)throw Object.assign(new Error('선생님 로그인이 필요해요.'),{status:401});return u.userId;}
async function owned(id:string,user:string){const row=await one('SELECT * FROM learning_classes WHERE id=? AND owner=?',id,user);if(!row)throw Object.assign(new Error('학급을 찾을 수 없어요.'),{status:404});return row;}
async function student(request:Request){
 const bearer=request.headers.get('Authorization')||'';if(!/^Bearer [a-f0-9]{64}$/.test(bearer))throw Object.assign(new Error('학생 참여가 필요해요.'),{status:401});
 const s=await one('SELECT st.* FROM learning_sessions se JOIN learning_students st ON st.id=se.student_id WHERE se.token_hash=? AND se.expires>?',await hash(bearer.slice(7)),Date.now());
 if(!s)throw Object.assign(new Error('참여 코드로 다시 들어와 주세요.'),{status:401});return s;
}
async function body(request:Request){if(Number(request.headers.get('content-length')||0)>4096)throw Object.assign(new Error('요청이 너무 커요.'),{status:413});const text=await request.text();if(text.length>4096)throw Object.assign(new Error('요청이 너무 커요.'),{status:413});try{return JSON.parse(text);}catch{throw Object.assign(new Error('입력 내용을 확인해 주세요.'),{status:400});}}

function recordFilter(url:URL,alias='e'){
 const group=url.searchParams.get('group')||'all',from=url.searchParams.get('from')||'',to=url.searchParams.get('to')||'';
 const groups=['all',...new Set((catalog as any[]).map(w=>w.group))];
 const day=(v:string)=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(v)||!Number.isFinite(Date.parse(v+'T00:00:00+09:00'))||new Date(v+'T00:00:00Z').toISOString().slice(0,10)!==v)throw Object.assign(new Error('날짜를 확인해 주세요.'),{status:400});return Date.parse(v+'T00:00:00+09:00');};
 if(!groups.includes(group))throw Object.assign(new Error('분류를 확인해 주세요.'),{status:400});
 const start=from?day(from):null,end=to?day(to)+86400000:null;
 if(start!==null&&end!==null&&start>=end)throw Object.assign(new Error('시작일은 종료일보다 늦을 수 없어요.'),{status:400});
 const selected=(catalog as any[]).filter(w=>group==='all'||w.group===group),args:any[]=[],parts:string[]=[];
 if(start!==null){parts.push(alias+'.created>=?');args.push(start);}if(end!==null){parts.push(alias+'.created<?');args.push(end);}
 if(group!=='all'){parts.push(alias+'.word IN ('+selected.map(()=>'?').join(',')+')');args.push(...selected.map(w=>w.word));}
 return {sql:parts.length?' AND '+parts.join(' AND '):'',args,totalWords:selected.length,group,from,to};
}

async function handle(request:Request){
 const url=new URL(request.url),path=url.pathname.replace('/api/progress/','');
 if(request.method==='POST'&&request.headers.get('Origin')!==url.origin)return json({error:'잘못된 요청이에요.'},403);
 if(path==='identity'&&request.method==='GET'){const u=await getChatGPTUser();return json({signedIn:Boolean(u),displayName:u?.displayName||''});}
 if(path==='classes'){
  const user=await owner();
  if(request.method==='GET')return json({classes:await all('SELECT id,name,created FROM learning_classes WHERE owner=? ORDER BY created',user)});
  if(request.method==='POST'){const b=await body(request),name=clean(b.name);if(!name)return json({error:'학급 이름을 입력해 주세요.'},400);const count=await one('SELECT COUNT(*) AS n FROM learning_classes WHERE owner=?',user);if(count.n>=20)return json({error:'학급은 20개까지 만들 수 있어요.'},400);const id=crypto.randomUUID();await db().prepare('INSERT INTO learning_classes(id,owner,name,created) VALUES(?,?,?,?)').bind(id,user,name,Date.now()).run();return json({id,name},201);}
 }
 if(path==='students'&&request.method==='POST'){
  const user=await owner(),b=await body(request);await owned(b.classId,user);const alias=clean(b.alias,20);if(!alias)return json({error:'학생 번호나 별명을 입력해 주세요.'},400);
  const count=await one('SELECT COUNT(*) AS n FROM learning_students WHERE class_id=?',b.classId);if(count.n>=100)return json({error:'한 학급은 100명까지 등록할 수 있어요.'},400);
  if(await one('SELECT id FROM learning_students WHERE class_id=? AND alias=?',b.classId,alias))return json({error:'이미 등록한 번호나 별명이에요.'},409);
  const id=crypto.randomUUID();
  for(let attempt=0;attempt<20;attempt++){const code=await newPin();const result=await db().prepare('INSERT OR IGNORE INTO learning_students(id,class_id,alias,code,created) VALUES(?,?,?,?,?)').bind(id,b.classId,alias,code,Date.now()).run();if(result.meta.changes)return json({id,alias,code},201);if(await one('SELECT id FROM learning_students WHERE class_id=? AND alias=?',b.classId,alias))return json({error:'이미 등록한 번호나 별명이에요.'},409);}
  return json({error:'코드를 발급하지 못했어요. 다시 시도해 주세요.'},409);
 }
 if(path==='join'&&request.method==='POST'){
  const b=await body(request),code=clean(b.code,30).normalize('NFKC');if(!/^\d{4}$/.test(code))return json({error:'숫자 4자리 참여 코드를 입력해 주세요.'},400);
  const ip=request.headers.get('cf-connecting-ip')||'unknown';
  const key=await hash('pin-fail:'+ip+':'+Math.floor(Date.now()/300000));
  const rate=await one('SELECT count FROM learning_join_limits WHERE key=?',key);if(rate&&rate.count>=10)return json({error:'잘못된 코드를 여러 번 입력했어요. 5분 후 다시 시도해 주세요.'},429);
  await db().prepare('DELETE FROM learning_join_limits WHERE until<?').bind(Date.now()).run();
  const st=await one('SELECT st.id,st.alias,c.name AS className FROM learning_students st JOIN learning_classes c ON c.id=st.class_id WHERE st.code=?',code);
  if(!st){await db().prepare('INSERT INTO learning_join_limits(key,count,until) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1').bind(key,Date.now()+300000).run();return json({error:'참여 코드가 맞지 않아요. 선생님께 확인해 주세요.'},404);}
  const token=random();await db().batch([db().prepare('DELETE FROM learning_sessions WHERE expires<?').bind(Date.now()),db().prepare('INSERT INTO learning_sessions(token_hash,student_id,expires) VALUES(?,?,?)').bind(await hash(token),st.id,Date.now()+2592000000)]);
  return json({...st,token});
 }
 if(path==='session'&&request.method==='GET'){const st=await student(request);const cl=await one('SELECT name FROM learning_classes WHERE id=?',st.class_id);return json({id:st.id,alias:st.alias,className:cl.name});}
 if(path==='events'&&request.method==='POST'){
  const st=await student(request),b=await body(request),w=(catalog as any[]).find(x=>x.word===b.word);
  if(!uuid(b.id)||!w||!['read','trace','blank','dictation_write','dictation_choice'].includes(b.mode)||!['seen','complete','answer'].includes(b.kind))return json({error:'학습 기록을 확인해 주세요.'},400);
  if(b.kind==='answer'&&(!uuid(b.round)||typeof b.chosen!=='string'||(b.mode==='blank'?(!Number.isInteger(b.blank)||b.blank<0||b.blank>=w.word.length||b.chosen.length!==1):b.mode==='dictation_choice'?(!(catalog as any[]).some(x=>x.word===b.chosen)):true)))return json({error:'답안을 확인해 주세요.'},400);
  if(b.kind==='complete'&&['blank','dictation_choice'].includes(b.mode))return json({error:'빈칸 정답을 제출해 주세요.'},400);
  const correct=b.kind==='answer'?Number((b.mode==='dictation_choice'?w.word:w.word[b.blank])===b.chosen):null,now=Number.isInteger(b.occurredAt)&&b.occurredAt>Date.now()-2592000000&&b.occurredAt<=Date.now()+300000?b.occurredAt:Date.now();
  const statements=[db().prepare('INSERT OR IGNORE INTO learning_events(event_key,student_id,word,mode,kind,round,blank,chosen,correct,created) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(b.id,st.id,b.word,b.mode,b.kind,b.kind==='answer'?b.round:null,b.kind==='answer'&&b.mode==='blank'?b.blank:null,b.kind==='answer'?b.chosen:null,correct,now),db().prepare('UPDATE learning_students SET last_active=CASE WHEN last_active IS NULL OR last_active<? THEN ? ELSE last_active END WHERE id=?').bind(now,now,st.id)];
  if(correct===1)statements.push(db().prepare("INSERT OR IGNORE INTO learning_events(event_key,student_id,word,mode,kind,created) VALUES(?,?,?,?,'complete',?)").bind(b.id+'-complete',st.id,b.word,b.mode,now));
  await db().batch(statements);return json({saved:true,correct:correct===null?null:Boolean(correct)});
 }
 if(path==='overview'&&request.method==='GET'){
  const user=await owner(),classId=url.searchParams.get('classId')||'';const cl=await owned(classId,user);await convertPins(classId);const filter=recordFilter(url);
  const rows=await all(`SELECT s.id,s.alias,s.code,MAX(e.created) AS last_active,
    COUNT(DISTINCT CASE WHEN e.kind='seen' THEN e.word END) AS viewed,
    COUNT(DISTINCT CASE WHEN e.kind='complete' THEN e.word END) AS completed_words,
    COUNT(DISTINCT CASE WHEN e.kind='complete' THEN e.word||':'||e.mode END) AS completed_activities,
    SUM(CASE WHEN e.kind='answer' THEN 1 ELSE 0 END) AS attempts,
    SUM(CASE WHEN e.kind='answer' AND e.correct=1 THEN 1 ELSE 0 END) AS correct,
    SUM(CASE WHEN e.kind='answer' AND e.correct=0 THEN 1 ELSE 0 END) AS wrong
    FROM learning_students s LEFT JOIN learning_events e ON e.student_id=s.id${filter.sql} WHERE s.class_id=? GROUP BY s.id ORDER BY s.created`,...filter.args,classId);
  const first=await all(`SELECT e.student_id,COUNT(*) AS rounds,SUM(e.correct) AS first_correct FROM learning_events e JOIN (SELECT MIN(id) AS first_id FROM learning_events WHERE kind='answer' AND student_id IN (SELECT id FROM learning_students WHERE class_id=?) GROUP BY student_id,round) r ON e.id=r.first_id WHERE 1=1${filter.sql} GROUP BY e.student_id`,classId,...filter.args);
  rows.forEach(r=>Object.assign(r,first.find(f=>f.student_id===r.id)||{rounds:0,first_correct:0}));
  return json({class:cl.name,totalWords:filter.totalWords,totalActivities:filter.totalWords*5,filters:{from:filter.from,to:filter.to,group:filter.group},students:rows});
 }
 if(path==='detail'&&request.method==='GET'){
  const user=await owner(),id=url.searchParams.get('studentId')||'';
  const st=await one('SELECT s.* FROM learning_students s JOIN learning_classes c ON c.id=s.class_id WHERE s.id=? AND c.owner=?',id,user);if(!st)return json({error:'학생을 찾을 수 없어요.'},404);
  const filter=recordFilter(url);
  const completed=await all(`SELECT word,mode,MAX(created) AS created FROM learning_events e WHERE student_id=? AND kind='complete'${filter.sql} GROUP BY word,mode ORDER BY created DESC`,id,...filter.args);
  const answers=await all(`SELECT word,mode,blank,chosen,correct,round,created FROM learning_events e WHERE student_id=? AND kind='answer'${filter.sql} ORDER BY id DESC LIMIT 100`,id,...filter.args);
  const summary=await one(`SELECT COUNT(DISTINCT CASE WHEN kind='complete' THEN word END) AS completed_words,COUNT(DISTINCT CASE WHEN kind='complete' THEN word||':'||mode END) AS completed_activities,SUM(CASE WHEN kind='answer' THEN 1 ELSE 0 END) AS attempts,SUM(CASE WHEN kind='answer' AND correct=1 THEN 1 ELSE 0 END) AS correct,SUM(CASE WHEN kind='answer' AND correct=0 THEN 1 ELSE 0 END) AS wrong FROM learning_events e WHERE student_id=?${filter.sql}`,id,...filter.args);
  return json({alias:st.alias,completed,answers,summary,totalWords:filter.totalWords,totalActivities:filter.totalWords*5});
 }
 return json({error:'요청을 찾을 수 없어요.'},404);
}
async function safe(request:Request){try{return await handle(request);}catch(error:any){return json({error:error.status?error.message:'기록 저장 서버에 연결하지 못했어요. 다시 시도해 주세요.'},error.status||503);}}
export const GET=safe;export const POST=safe;
