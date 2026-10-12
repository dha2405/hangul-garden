'use strict';
(()=>{
 const el=id=>document.getElementById(id);
 const cities=[['광양시',34.9407,127.6959],['목포시',34.8118,126.3922],['여수시',34.7604,127.6622],['순천시',34.9506,127.4872],['나주시',35.0159,126.7108],['담양군',35.3211,126.9882],['곡성군',35.2820,127.2919],['구례군',35.2024,127.4628],['고흥군',34.6112,127.2849],['보성군',34.7715,127.0799],['화순군',35.0645,126.9865],['장흥군',34.6816,126.9071],['강진군',34.6421,126.7672],['해남군',34.5732,126.5992],['영암군',34.8002,126.6968],['무안군',34.9905,126.4817],['함평군',35.0660,126.5166],['영광군',35.2772,126.5121],['장성군',35.3018,126.7849],['완도군',34.3111,126.7547],['진도군',34.4869,126.2634],['신안군',34.8336,126.3512]];
 let city=cities[0],requestId=0,controller=null,expanded=false,lastAttempt=0;
 try{const saved=localStorage.getItem('hangul-garden-weather-city');city=cities.find(c=>c[0]===saved)||city;}catch{}
 cities.forEach(c=>{const option=document.createElement('option');option.value=c[0];option.textContent=c[0];el('weatherCity').append(option);});
 el('weatherCity').value=city[0];
 function updateDate(){
  const date=new Date();
  el('todayTime').textContent=new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',hour:'numeric',minute:'2-digit',hour12:true}).format(date);
  el('todayTime').dateTime=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Seoul',hour:'2-digit',minute:'2-digit',hour12:false}).format(date);
  el('todayDate').textContent=new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',month:'long',day:'numeric',weekday:'long'}).format(date);
  el('todayDate').dateTime=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
 }
 function describeWeather(code,day){
  if(code===0)return[day?'☀️':'🌙','맑음'];
  if(code===1)return[day?'🌤️':'🌙','대체로 맑음'];
  if(code===2)return['⛅','구름 조금'];
  if(code===3)return['☁️','흐림'];
  if([45,48].includes(code))return['🌫️','안개'];
  if([51,53,55,56,57].includes(code))return['🌦️','이슬비'];
  if([61,63,65,66,67,80,81,82].includes(code))return['🌧️','비'];
  if([71,73,75,77,85,86].includes(code))return['❄️','눈'];
  if([95,96,99].includes(code))return['⛈️','천둥과 비'];
  return['🌈','날씨 확인 중'];
 }
 async function loadWeather(){
  const id=++requestId;lastAttempt=Date.now();
  if(controller)controller.abort();controller=new AbortController();
  const currentController=controller;const timer=setTimeout(()=>currentController.abort(),12000);
  el('weatherText').textContent='날씨를 불러오고 있어요.';
  el('weatherIcon').textContent='🌈';el('weatherUpdated').textContent='';
  el('weatherRefresh').disabled=true;
  try{
   const params=new URLSearchParams({latitude:city[1],longitude:city[2],current:'temperature_2m,weather_code,is_day',timezone:'Asia/Seoul',forecast_days:1});
   const response=await fetch('https://api.open-meteo.com/v1/forecast?'+params,{signal:currentController.signal});
   if(!response.ok)throw new Error('Weather unavailable');
   const data=await response.json(),current=data.current;
   if(!current||!Number.isFinite(current.temperature_2m)||!Number.isInteger(current.weather_code))throw new Error('Invalid weather');
   if(id!==requestId)return;
   const [icon,label]=describeWeather(current.weather_code,current.is_day===1);
   el('weatherIcon').textContent=icon;
   el('weatherText').textContent=label+' · '+Math.round(current.temperature_2m)+'℃';
   el('weatherUpdated').textContent=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(current.time||'')?'예보 기준 '+current.time.slice(11,16)+' · 한국 시간':'현재 예보';
  }catch{
   if(id===requestId){el('weatherIcon').textContent='☁️';el('weatherText').textContent='날씨를 불러오지 못했어요.';el('weatherUpdated').textContent='인터넷 연결 후 새로고침을 눌러주세요.';}
  }finally{clearTimeout(timer);if(id===requestId)el('weatherRefresh').disabled=false;}
 }
 el('weatherCity').onchange=e=>{city=cities.find(c=>c[0]===e.target.value)||cities[0];try{localStorage.setItem('hangul-garden-weather-city',city[0]);}catch{}loadWeather();};
 el('weatherRefresh').onclick=loadWeather;
 function syncFullscreen(){
  const active=Boolean(document.fullscreenElement)||expanded;
  document.body.classList.toggle('learning-fullscreen',active);
  el('fullscreenBtn').textContent=active?'↙ 전체화면 나가기':'⛶ 전체화면 학습';
  el('fullscreenBtn').setAttribute('aria-pressed',String(active));
 }
 el('fullscreenBtn').onclick=async()=>{
  try{
   if(document.fullscreenElement){await document.exitFullscreen();expanded=false;el('fullscreenStatus').textContent='';}
   else if(expanded){expanded=false;el('fullscreenStatus').textContent='';}
   else if(document.documentElement.requestFullscreen){await document.documentElement.requestFullscreen();el('fullscreenStatus').textContent='';}
   else{expanded=true;el('fullscreenStatus').textContent='이 브라우저는 전체화면을 지원하지 않아 넓은 학습 화면으로 표시해요.';}
  }catch{expanded=!expanded;el('fullscreenStatus').textContent=expanded?'전체화면을 열 수 없어 넓은 학습 화면으로 표시해요.':'';}
  syncFullscreen();
 };
 document.addEventListener('fullscreenchange',()=>{if(document.fullscreenElement)expanded=false;syncFullscreen();});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&expanded){expanded=false;el('fullscreenStatus').textContent='';syncFullscreen();}});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden){updateDate();if(Date.now()-lastAttempt>600000)loadWeather();}});
 window.addEventListener('online',loadWeather);
 setInterval(()=>{updateDate();if(!document.hidden&&Date.now()-lastAttempt>600000)loadWeather();},60000);
 updateDate();syncFullscreen();loadWeather();
})();
