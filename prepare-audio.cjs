const fs=require('fs'),path=require('path'),cp=require('child_process');
const root='F:/gpt/hangul-garden',dist=root+'/dist';
const names=['animal-audio-sources.json','rare-animal-audio-sources.json','vehicle-audio-sources.json','support-vehicle-audio-sources.json','support-extra-vehicle-audio-sources.json','korean-vehicle-audio-sources.json','korean-freesound-audio-sources.json'];
const records=new Map();
for(const name of names){if(!fs.existsSync(dist+'/'+name))continue;for(const r of JSON.parse(fs.readFileSync(dist+'/'+name,'utf8'))){r.word=r.word==='배'?'보트':r.word;r.audio=r.audio||r.src;r.label=r.label||r.note;records.set(r.word,r);}}
const ff='F:/gpt/audio-tools/imageio-ffmpeg-0.6.0/runtime/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe';
for(const r of records.values()){
 let source=dist+'/'+r.audio;if(!fs.existsSync(source)&&r.audio.startsWith('assets/audio/korea/'))source='F:/gpt/hangul-garden-korean-originals-20261008/'+path.basename(r.audio);if(!fs.existsSync(source))throw Error('Missing '+source);
 const target='assets/audio/clips/'+path.basename(r.audio,path.extname(r.audio))+'.mp3';fs.mkdirSync(dist+'/assets/audio/clips',{recursive:true});
 cp.execFileSync(ff,['-v','error','-y','-ss',String(r.start||0),'-i',source,'-vn','-t','6','-codec:a','libmp3lame','-b:a','128k',dist+'/'+target]);
 const volume=cp.spawnSync(ff,['-hide_banner','-i',dist+'/'+target,'-af','volumedetect','-f','null','-'],{encoding:'utf8'});
 if(volume.status!==0||/max_volume: -inf/.test(volume.stderr))throw Error('Invalid or silent '+r.word);
 r.originalAudio=r.audio;r.audio=target;r.start=0;r.changes=(r.changes||'')+'; 学습용 MP3 전환, 최대 6초로 편집'.replace('学습','학습');
 console.log(r.word+' '+fs.statSync(dist+'/'+target).size+' bytes');
}
const all=[...records.values()];fs.writeFileSync(dist+'/sound-sources.json',JSON.stringify(all,null,2));
fs.writeFileSync(dist+'/sounds.js','window.SOUND_LIBRARY='+JSON.stringify(Object.fromEntries(all.map(r=>[r.word,{src:r.audio,note:r.label,kind:r.kind||"실제 녹음",source:r.source,author:r.author,license:r.license,licenseUrl:r.licenseUrl}])) )+';\n');
const esc=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
fs.writeFileSync(dist+'/sound-sources.html','<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>소리 자료 출처 · 한글 놀이터</title><style>body{font-family:Malgun Gothic,sans-serif;background:#fff9ef;color:#354b3b;max-width:960px;margin:auto;padding:24px;line-height:1.7}article{background:white;border-radius:18px;padding:20px;margin:16px 0}a{color:#286647}h1{font-size:28px}</style><a href="index.html">← 한글 놀이터</a><h1>소리 자료 출처</h1><p>버튼을 누르면 최대 6초 재생됩니다. 탈것은 한국 현장 녹음과 국내 제공기관 음원으로 구성했습니다. 녹음 지역 미표시 및 다른 탈것의 소리 예시는 항목별로 표시합니다. 사진과 녹음은 서로 다른 개체·기종일 수 있습니다. 벨이나 다른 소리 예시는 각 항목에 표시했습니다. 원본의 이용 조건은 해당 소리 파일에 적용됩니다.</p>'+all.map(r=>'<article><h2>'+esc(r.word)+'</h2><p>'+esc(r.label)+'</p><p>저작자: '+esc(r.author)+' · <a href="'+esc(r.source)+'" target="_blank" rel="noopener">원본 출처</a> · <a href="'+esc(r.licenseUrl)+'" target="_blank" rel="noopener">'+esc(r.license)+'</a></p><p>편집: '+esc(r.changes)+'</p><audio controls preload="none" src="'+esc(r.audio)+'"></audio></article>').join('')+'</html>');
console.log('TOTAL '+all.length);
