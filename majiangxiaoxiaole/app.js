const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const SYMBOLS=['一筒','二筒','三筒','四筒','五筒','六筒','七筒','八筒','九筒','一索','二索','三索','四索','五索','六索','七索','八索','九索','一萬','二萬','三萬','四萬','五萬','六萬','七萬','八萬','九萬','熊猫','狐狸','猫咪','小狗','狮子','老虎','兔子','猴子','苹果','橙子','柠檬','西瓜','葡萄','草莓','樱桃','桃子'];
const PICTURE_TILES={熊猫:'panda',狐狸:'fox',猫咪:'cat',小狗:'dog',狮子:'lion',老虎:'tiger',兔子:'rabbit',猴子:'monkey',苹果:'apple',橙子:'orange',柠檬:'lemon',西瓜:'watermelon',葡萄:'grapes',草莓:'strawberry',樱桃:'cherry',桃子:'peach'};
const PICTURE_SVG={
  panda:'<g stroke="#183f38" stroke-linejoin="round"><path d="M18 67c3-19 15-31 32-32 18-2 32 9 35 27-5 12-17 19-34 19-16 0-27-5-33-14Z" fill="#eee7d8"/><path d="M30 39c-9-7-18-2-18 8 0 8 6 13 14 12m47-20c9-7 18-2 18 8 0 8-6 13-14 12M25 68l-5 17m23-6-2 9m33-18 6 15M37 39c-8 6-11 14-8 25 7 7 14 7 21 1-5-10-4-19 2-28m10 2c8 6 11 14 8 25-7 7-14 7-21 1" fill="#183f38"/><path d="M28 70c15 6 31 6 47-1" fill="none" stroke="#a07c4c"/></g>',
  fox:'<g stroke="#56382d" stroke-linejoin="round"><path d="M17 71c12-4 18-14 21-29 3-14 14-23 28-22 11 1 18 7 21 17-10-2-17 1-20 9 7 7 7 16 0 24-9 10-23 12-36 6-6-3-11-2-14 3Z" fill="#b95734"/><path d="m61 21 18-10-4 24M67 46c-7 3-11 8-12 15 8 4 16 3 23-3" fill="#e6b678"/><path d="M24 71c15 5 29 3 42-5" fill="none" stroke="#7d7157"/></g>',
  cat:'<g stroke="#284a45" stroke-linejoin="round"><path d="M19 79c13-7 18-19 17-36-1-13 6-22 17-25l10-10 2 15c12 5 18 17 14 30-5 16-20 24-37 20-9-2-16 1-23 9Z" fill="#ad8055"/><path d="m53 19 8-8 1 14M42 72c13 1 24-5 32-16M44 37c7-4 14-4 21-1M45 48c7 2 14 1 20-3" fill="none"/><path d="M55 43c3 8 2 15-3 22" fill="none" stroke="#e3c78e"/></g>',
  dog:'<g stroke="#49382f" stroke-linejoin="round"><path d="M15 76c12-8 18-20 19-36 1-15 12-25 27-24 13 1 22 9 24 21-9-3-16 0-20 7 6 8 6 16 0 24-8 10-21 13-34 8-6-2-11-1-16 4Z" fill="#9c704d"/><path d="M39 21c-12-6-21 1-20 14 1 10 7 17 16 20M65 44c-8 3-12 9-12 17 8 4 16 2 23-4M29 71c13 5 26 3 37-5" fill="#72503d"/></g>',
  lion:'<g stroke="#69482e" stroke-linejoin="round"><path d="M16 79c9-10 13-22 10-36-3-15 5-27 19-32 18-6 35 4 39 21 3 13-2 23-13 30-5 12-16 18-30 17-9-1-17 1-25 7Z" fill="#966033"/><path d="M39 22c12-7 26-3 33 8-9 1-14 6-15 14 7 4 9 11 6 18-9 5-19 5-28 0-7-15-5-28 4-40Z" fill="#cea05e"/><path d="M28 31c-5 13-4 26 3 38M31 68c12 5 25 4 36-2" fill="none" stroke="#74482d"/></g>',
  tiger:'<g stroke="#55382d" stroke-linejoin="round"><path d="M13 79c13-8 19-20 21-36 2-16 14-26 30-24 13 2 21 12 20 25-2 18-17 30-36 30-13 0-24 4-35 12Z" fill="#b96131"/><path d="m47 23 9-12 5 12m3 1 13-8-2 16M45 34l13 5m-17 6 14 4m17-14-10 7m10 4-11 5M27 68c13 5 26 4 38-3" fill="none" stroke="#4d342b"/><path d="M52 57c9 5 18 4 26-2" fill="none" stroke="#ddc091" stroke-width="3"/></g>',
  rabbit:'<g stroke="#465950" stroke-linejoin="round"><path d="M16 79c11-7 17-18 18-32 1-12 7-20 17-24C45 5 53 2 58 22 71 8 79 12 71 31c10 7 14 19 9 31-6 14-22 19-39 14-9-2-17 1-25 9Z" fill="#ddd8cc"/><path d="M52 22c-1-8 0-13 3-17m4 22c6-7 11-11 15-11M47 52c8 4 16 3 23-2M34 69c13 4 26 2 37-5" fill="none" stroke="#8f776f"/></g>',
  monkey:'<g stroke="#503b30" stroke-linejoin="round"><path d="M16 80c11-8 16-20 14-35-1-15 8-26 23-30 16-4 30 6 33 21 3 16-7 30-23 35-10 4-18 2-26 3-8 1-14 5-21 12Z" fill="#76513b"/><path d="M43 27c11-7 24-3 30 8-8 2-12 7-11 14 6 4 8 10 5 17-9 5-19 5-28-1-8-14-7-27 4-38Z" fill="#b88c62"/><path d="M42 50c8 4 16 3 23-2M34 68c12 4 24 3 34-3" fill="none"/></g>',
  apple:'<g stroke="#31543d" stroke-width="3" stroke-linejoin="round"><path d="M50 31c-3-12 2-19 12-23" fill="none"/><path d="M53 23c9-12 21-8 24 2-10 5-18 4-24-2Z" fill="#3c8b54"/><path d="M50 30c22-12 36 5 31 29-5 23-18 29-31 20-13 9-26 3-31-20-5-24 9-41 31-29Z" fill="#b83238"/><path d="M36 42c-6 9-6 19-2 28" stroke="#e66e62"/></g>',
  orange:'<g stroke="#7b4b22" stroke-width="3" stroke-linejoin="round"><path d="M49 25c3-11 11-16 20-15-2 11-9 17-20 15Z" fill="#438b4f"/><path d="M50 24c-1-8-4-12-9-15" fill="none"/><circle cx="50" cy="56" r="30" fill="#df7c27"/><path d="M31 45c-4 8-4 17 0 25" stroke="#f2ac49"/><path d="M41 42h.1m18 6h.1m-8 18h.1m-13 7h.1" stroke-width="5" stroke-linecap="round"/></g>',
  lemon:'<g stroke="#7d6a24" stroke-width="3" stroke-linejoin="round"><path d="M21 55c8-6 8-18 15-25 12-13 34-7 42 8 8 16-1 36-17 41-10 3-20-3-31 2 1-10-4-18-9-26Z" fill="#e4c93e"/><path d="M35 43c8-12 21-15 32-6" stroke="#fff09a"/></g>',
  durian:'<g stroke="#4d5a2f" stroke-width="2.2" stroke-linejoin="round"><path d="M49 28c3-12 11-18 21-17-3 10-10 16-21 17Z" fill="#4f7c43"/><path d="M51 29c-2-9-6-15-12-19" fill="none"/><path d="m50 25 7 8 10-4 2 10 11 1-4 10 9 7-8 7 4 10-11 1-3 10-10-4-7 8-7-8-10 4-3-10-11-1 4-10-9-7 9-7-4-10 11-1 3-10 10 4Z" fill="#9e9a3e"/><path d="M34 43c10-7 22-8 33-2M29 56c14-6 29-6 43 0M32 70c12 4 24 4 36-1" fill="none" stroke="#d5c85b" stroke-width="2"/><path d="M50 34v43" fill="none" stroke="#65702f" stroke-width="1.5"/></g>',
  grapes:'<g stroke="#493a61" stroke-width="2.5"><path d="M51 30c2-13 9-20 18-23" fill="none" stroke="#35764d" stroke-width="4"/><path d="M57 22c9-12 21-8 24 2-10 5-18 4-24-2Z" fill="#3f8b53"/><g fill="#6d4b93"><circle cx="38" cy="38" r="11"/><circle cx="55" cy="37" r="11"/><circle cx="70" cy="44" r="11"/><circle cx="45" cy="54" r="11"/><circle cx="62" cy="57" r="11"/><circle cx="50" cy="72" r="11"/></g></g>',
  strawberry:'<g stroke="#31543d" stroke-width="3" stroke-linejoin="round"><path d="M28 31c5-12 14-18 22-6 8-12 17-6 22 6-7 2-14 1-22-2-8 3-15 4-22 2Z" fill="#3e8c52"/><path d="M24 35c2 31 12 48 26 54 14-6 24-23 26-54-18-8-34-8-52 0Z" fill="#c83f45"/><path d="M36 46h.1m15-4h.1m14 7h.1M42 61h.1m18 4h.1m-11 11h.1" stroke="#f3d26e" stroke-width="5" stroke-linecap="round"/></g>',
  cherry:'<g stroke="#31543d" stroke-width="3" stroke-linejoin="round"><path d="M34 61c5-27 13-39 29-48M67 62c-1-22-5-35-13-45" fill="none"/><path d="M56 18c9-12 21-8 24 2-10 5-18 4-24-2Z" fill="#438b50"/><circle cx="30" cy="67" r="17" fill="#b72e3a"/><circle cx="68" cy="68" r="17" fill="#c73b45"/></g>',
  peach:'<g stroke="#6f4736" stroke-width="3" stroke-linejoin="round"><path d="M52 25c4-12 13-18 23-17-3 12-11 18-23 17Z" fill="#448f52"/><path d="M50 26c-25-17-38 7-30 30 6 18 19 29 30 34 11-5 24-16 30-34 8-23-5-47-30-30Z" fill="#e77b6d"/><path d="M50 31c-7 17-6 36 0 54" fill="none" stroke="#bd4d52"/></g>'
};
const state={level:1,unlockedLevel:1,tiles:[],seconds:0,hints:0,shuffles:0,lives:5,lifeDate:'',shareDate:'',shareCount:0,checkinHistory:[],checkinPrompted:false,language:'自动检测',playerName:'玩家',avatarIndex:0,pendingLevel:null,pendingTool:null,cloudLinked:false,timer:null,sound:true,haptic:true,motion:true,started:false,initial:0,records:{},animating:false,effectId:0,dealing:false,dealTimer:null,initialTypeCount:0,slots:[],settleTimer:null,score:0,combo:1,comboUntil:0,tick:0,remain:600,over:false,tools:{clear:1,shuffle:1,undo:1,magnet:1}};

function todayKey(){const d=new Date();return`${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`}
const VIDEO_ICON='<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="14" height="14" rx="4"/><path d="m17 10 4-2v8l-4-2Z"/></svg>';
function updateLivesUI(){$$('.lifeCount').forEach(el=>el.textContent=state.lives);$$('.life-badge').forEach(el=>el.classList.toggle('empty',state.lives<=0));$$('.energy-add').forEach(btn=>{btn.disabled=false;btn.classList.remove('disabled','video-ready');btn.textContent='+';btn.setAttribute('aria-label','观看视频增加体力')});const status=$('#energyAdStatus');if(status)status.textContent=`当前体力 ${state.lives}点，观看一段模拟广告即可补充。`}
function saveLives(){localStorage.setItem('mahjong-daily-lives',JSON.stringify({date:state.lifeDate||todayKey(),lives:state.lives}));updateLivesUI()}
function loadLives(){const today=todayKey();try{const saved=JSON.parse(localStorage.getItem('mahjong-daily-lives')||'null');if(saved?.date===today){state.lives=Math.max(0,saved.lives??5)}else{state.lives=Math.max(5,saved?.lives||0)}state.lifeDate=today;saveLives()}catch(e){state.lives=5;state.lifeDate=today}updateLivesUI()}
function updateCloudUI(){const el=$('#cloudSaveStatus'),btn=$('#cloudSaveBtn'),logout=$('#googleLogoutBtn');if(!el||!btn)return;el.textContent=state.cloudLinked?`已同步 · 最高第${state.unlockedLevel}关`:'仅保存在此设备';btn.classList.toggle('linked',state.cloudLinked);btn.querySelector('b').textContent=state.cloudLinked?'✓':'›';logout?.classList.toggle('hidden',!state.cloudLinked)}
function cloudProgress(){const stars={};Object.entries(state.records).forEach(([level,record])=>stars[level]=Math.max(0,Math.min(3,record?.stars||0)));return{highest:state.unlockedLevel,stars,updatedAt:Date.now(),version:1}}
function syncCloudProgress(){if(!state.cloudLinked)return;localStorage.setItem('mahjong-cloud-progress-demo',JSON.stringify(cloudProgress()));updateCloudUI()}
function mergeCloudProgress(){let cloud={};try{cloud=JSON.parse(localStorage.getItem('mahjong-cloud-progress-demo')||'{}')}catch(e){}state.unlockedLevel=Math.max(state.unlockedLevel,cloud.highest||1);Object.entries(cloud.stars||{}).forEach(([level,stars])=>{const old=state.records[level]||{};state.records[level]={...old,played:old.played||0,best:old.best||0,stars:Math.max(old.stars||0,stars||0)}});localStorage.setItem('sparrow-records-v36',JSON.stringify(state.records));saveProgress();syncCloudProgress();renderJourney()}
function dateKey(d=new Date()){return`${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`}
function loadSocialRewards(){const today=todayKey(),share=JSON.parse(localStorage.getItem('mahjong-daily-shares')||'null');state.shareDate=today;state.shareCount=share?.date===today?Math.min(3,share.count||0):0;state.checkinHistory=JSON.parse(localStorage.getItem('mahjong-checkins')||'[]');updateShareUI();renderCheckin();const signed=state.checkinHistory.includes(today);$('#checkinStatus').textContent=signed?'今日已签到':'今日未签到';if(!signed&&!state.checkinPrompted){state.checkinPrompted=true;setTimeout(()=>openCheckin(),500)}}
function updateShareUI(){$('#shareStatus').textContent=state.shareCount<1?'今日首次分享可领取2点体力':'今日分享奖励已领取'}
function updateLanguageUI(){const status=$('#languageStatus');if(status)status.textContent=state.language;$$('#languageList button').forEach(btn=>btn.classList.toggle('selected',btn.dataset.language===state.language))}
function renderCheckin(){const box=$('#checkinWeek');if(!box)return;const now=new Date(),day=now.getDay()||7,monday=new Date(now);monday.setHours(0,0,0,0);monday.setDate(now.getDate()-day+1);box.innerHTML='';['一','二','三','四','五','六','日'].forEach((label,i)=>{const d=new Date(monday);d.setDate(monday.getDate()+i);const key=dateKey(d),reward=i>=5?2:1,el=document.createElement('div');el.className=`checkin-day${key===todayKey()?' today':''}${state.checkinHistory.includes(key)?' claimed':''}`;el.innerHTML=`<small>周${label}</small><b>${state.checkinHistory.includes(key)?'✓':'⚡'}</b><span>+${reward}</span>`;box.appendChild(el)});const signed=state.checkinHistory.includes(todayKey());$('#claimCheckinBtn').disabled=signed;$('#claimCheckinBtn').textContent=signed?'今日已签到':'签到领取体力';$('#checkinStatus').textContent=signed?'今日已签到':'今日未签到'}
function openCheckin(){renderCheckin();openSheet('checkinSheet')}
function loadPrefs(){try{const p=JSON.parse(localStorage.getItem('sparrow-prefs')||'{}');state.sound=p.sound!==false;state.haptic=p.haptic!==false;state.motion=p.motion!==false;state.language=localStorage.getItem('mahjong-language')||'自动检测';state.cloudLinked=localStorage.getItem('mahjong-google-linked')==='true';syncSettingToggles();updateCloudUI();updateLanguageUI();loadLives();state.records=JSON.parse(localStorage.getItem('sparrow-records-v36')||'{}');const save=JSON.parse(localStorage.getItem('sparrow-progress-v36')||'null');state.unlockedLevel=Math.max(1,save?.level||1);state.level=state.unlockedLevel;const completed=Object.keys(state.records).length;$('#startLabel').textContent=`挑战第 ${state.unlockedLevel} 关`;$('#recordSummary').textContent=completed?`已完成 ${completed} 关 · 继续向上`:'从第1关开始体验';renderJourney();loadSocialRewards()}catch(e){}}
function syncSettingToggles(){['soundToggle','gameSoundToggle'].forEach(id=>{const el=$('#'+id);if(el)el.checked=state.sound});['hapticToggle','gameHapticToggle'].forEach(id=>{const el=$('#'+id);if(el)el.checked=state.haptic});['motionToggle','gameMotionToggle'].forEach(id=>{const el=$('#'+id);if(el)el.checked=state.motion});const icon=$('#soundIcon');if(icon)icon.textContent=state.sound?'◉':'○'}
function savePrefs(){localStorage.setItem('sparrow-prefs',JSON.stringify({sound:state.sound,haptic:state.haptic,motion:state.motion}))}
function saveProgress(){localStorage.setItem('sparrow-progress-v36',JSON.stringify({level:state.unlockedLevel}));if(state.cloudLinked)localStorage.setItem('mahjong-cloud-progress-demo',JSON.stringify(cloudProgress()))}
function showScreen(id){$$('.screen').forEach(x=>x.classList.toggle('is-active',x.id===id));}
function openSheet(id){$('#overlay').classList.add('show');$('#overlay').classList.toggle('share-overlay',id==='shareSheet');$('#overlay').setAttribute('aria-hidden','false');$('#'+id).classList.add('show');if(['pauseSheet','lifeInfoSheet','lifeSheet','energyAdSheet','toolAdSheet'].includes(id)){stopTimer();syncSettingToggles()}}
function closeSheets(resume=true){$$('.sheet').forEach(x=>x.classList.remove('show'));$('#overlay').classList.remove('show','share-overlay');$('#overlay').setAttribute('aria-hidden','true');if(resume&&$('#game').classList.contains('is-active'))startTimer()}
function haptic(pattern=12){if(state.haptic&&navigator.vibrate)navigator.vibrate(pattern)}
let audioCtx;function tone(freq=450,duration=.06){if(!state.sound)return;try{audioCtx??=new(window.AudioContext||window.webkitAudioContext)();const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.frequency.value=freq;o.type='sine';g.gain.setValueAtTime(.045,audioCtx.currentTime);g.gain.exponentialRampToValueAtTime(.001,audioCtx.currentTime+duration);o.connect(g).connect(audioCtx.destination);o.start();o.stop(audioCtx.currentTime+duration)}catch(e){}}
function toast(msg){const el=$('#toast');el.textContent=msg;el.classList.add('show');clearTimeout(el._t);el._t=setTimeout(()=>el.classList.remove('show'),1500)}

function seeded(seed){let s=(seed*9301+49297)%233280;return()=>{s=(s*9301+49297)%233280;return s/233280}}
function tileCountForLevel(level){const n=Math.min(120,30+15*(level-1));return n-n%3}
function boardAspect(){const b=$('#board').getBoundingClientRect();return b.width>8&&b.height>8?b.width/b.height:.76}
function makeLayout(level,rnd){
  const count=tileCountForLevel(level),aspect=boardAspect();
  const counts=[Math.round(count*.42),Math.round(count*.34)];
  counts.push(count-counts[0]-counts[1]);
  const n0=counts[0];
  // 选一个让牌堆外形最贴近牌桌比例的底层网格，牌堆才会铺满整张桌子而不是缩成一团
  let best=null;
  for(let cols=3;cols<=14;cols++){
    const rows=Math.ceil(n0/cols);
    const fx=(cols-1)*.84+1.12,fy=((rows-1)*.82+1.02)*1.368;
    const err=Math.abs(fx/fy-aspect);
    if(!best||err<best.err)best={cols,rows,err};
  }
  const fullX=(best.cols-1)*.84,fullY=(best.rows-1)*.82,positions=[];
  counts.forEach((n,z)=>{
    if(n<=0)return;
    // 每层都铺满同一片区域，上层只是牌更少更稀，堆出来是一整片乱牌而不是金字塔
    const cols=Math.min(n,Math.max(2,Math.round(best.cols*Math.sqrt(n/n0)))),rows=Math.ceil(n/cols);
    for(let i=0;i<n;i++){
      const row=Math.floor(i/cols),col=i-row*cols,inRow=Math.min(cols,n-row*cols);
      positions.push({
        x:(inRow>1?col/(inRow-1):.5)*fullX+(rnd()-.5)*.36,
        y:(rows>1?row/(rows-1):.5)*fullY+(rnd()-.5)*.34,
        z,
        rot:(rnd()-.5)*74
      });
    }
  });
  // 同层里几乎完全重合的推开一点，其余保持互相压着
  for(let pass=0;pass<2;pass++)for(let a=0;a<positions.length;a++)for(let b=a+1;b<positions.length;b++){
    const p=positions[a],q=positions[b];
    if(p.z!==q.z)continue;
    const dx=q.x-p.x,dy=q.y-p.y,d2=dx*dx+dy*dy,min=.34;
    if(d2>=min*min)continue;
    const d=Math.sqrt(d2)||.02,push=(min-d)/2;
    q.x+=dx/d*push;q.y+=dy/d*push;p.x-=dx/d*push;p.y-=dy/d*push;
  }
  return positions;
}
function starLabel(stars){const n=Math.max(0,Math.min(3,stars));return`${'★'.repeat(n)}${'☆'.repeat(3-n)}`}
const AVATAR_PALETTES=[['#6b5cff','#9d8cff','#ffe66d'],['#1d9a82','#55d6a9','#fff3a6'],['#e05d77','#ff9a82','#ffe5a0'],['#3979d8','#6ebcff','#c7f2ff'],['#bd5be5','#ee8be8','#ffe3ff'],['#d37b2f','#f2bd52','#fff0a5'],['#317c68','#74b994','#e1f3bb'],['#bd4545','#ed7771','#ffd6a0'],['#4758b8','#7788ec','#d9dcff'],['#178ba0','#5ed0ce','#d7fff2'],['#8d55c9','#c387e8','#f4dcff'],['#b66f32','#e3aa64','#fff0c6'],['#2e8960','#64c98b','#dbffd7'],['#d45491','#f18bc0','#ffe2f2'],['#3e72b8','#77a7ea','#dcedff'],['#7e6b34','#c6ad58','#fff1aa'],['#8f4fa5','#cc82d7','#f9dcff'],['#258088','#61bec0','#dcffff'],['#ba5b39','#e89467','#ffe0bf'],['#4b69a8','#85a3dc','#e1eaff'],['#4c8a4a','#82c979','#eaffcc'],['#aa4b72','#dd7e9f','#ffe1ea'],['#6654a9','#a18ae0','#eee5ff']];
function unlockedAvatarCount(){return Math.min(23,3+Math.floor(state.unlockedLevel/50))}
function avatarMarkup(index,extra=''){const file=String(index+1).padStart(2,'0');return`<span class="avatar-art ${extra}"><img src="assets/avatars/avatar-${file}.png" alt=""></span>`}
function loadPlayerProfile(){try{const p=JSON.parse(localStorage.getItem('mahjong-player-profile')||'{}');state.playerName=(p.name||'玩家').slice(0,15);state.avatarIndex=Math.min(Math.max(0,p.avatarIndex||0),unlockedAvatarCount()-1)}catch(e){state.playerName='玩家';state.avatarIndex=0}}
function renderAvatarGrid(){const grid=$('#avatarGrid'),count=unlockedAvatarCount();grid.innerHTML='';AVATAR_PALETTES.forEach((_,i)=>{const unlocked=i<count,at=i<3?1:(i-2)*50,btn=document.createElement('button');btn.className=`avatar-choice${i===state.avatarIndex?' selected':''}${unlocked?'':' locked'}`;btn.disabled=!unlocked;btn.innerHTML=`${avatarMarkup(i)}${unlocked?'':`<span class="avatar-lock">第${at}关</span>`}`;if(unlocked)btn.onclick=()=>{state.avatarIndex=i;renderAvatarGrid();$('#profileAvatarPreview').innerHTML=avatarMarkup(i,'large')};grid.appendChild(btn)})}
function openProfile(){const input=$('#playerNameInput');input.value=state.playerName;$('#nameCount').textContent=[...state.playerName].length;$('#profileLevel').textContent=`最高第 ${state.unlockedLevel} 关`;$('#profileAvatarPreview').innerHTML=avatarMarkup(state.avatarIndex,'large');renderAvatarGrid();openSheet('profileSheet')}
function renderJourney(){
  const map=$('#journeyMap');if(!map)return;map.innerHTML='';
  const highest=Math.max(1,state.unlockedLevel),top=highest+2;
  for(let level=top;level>=1;level--){
    const record=state.records[level],current=level===highest,locked=level>highest;
    const row=document.createElement('div');row.className=`journey-step ${level%2?'step-left':'step-right'}${current?' current':''}${locked?' locked':''}${record?' completed':''}`;
    row.innerHTML=`<span class="journey-vine"></span><button ${locked?'disabled':''} aria-label="${locked?`第 ${level} 关未解锁`:`进入第 ${level} 关`}"><span class="level-medal">${record?'✓':locked?'◇':level}</span><span class="level-copy"><b>第 ${level} 关</b><small class="level-stars">${current?'当前挑战':record?starLabel(record.stars??3):'点击开始'}</small></span></button>`;
    if(!locked)row.querySelector('button').onclick=()=>launchLevel(level);if(current){const profile=document.createElement('button');profile.className='journey-profile';profile.setAttribute('aria-label',`${state.playerName}的个人信息`);profile.innerHTML=avatarMarkup(state.avatarIndex);profile.onclick=e=>{e.stopPropagation();openProfile()};row.appendChild(profile)}map.appendChild(row);
  }
  requestAnimationFrame(()=>{const current=map.querySelector('.current');if(current)map.scrollTop=Math.max(0,current.offsetTop-map.clientHeight*.28)});
}
const TILT=28,TILT_COS=Math.cos(TILT*Math.PI/180);
function removalOrder(list){return[...list].sort((a,b)=>b.z-a.z||a.y-b.y||a.x-b.x)}
function shuffleWith(rnd,list){const c=[...list];for(let i=c.length-1;i>0;i--){const j=Math.floor(rnd()*(i+1));[c[i],c[j]]=[c[j],c[i]]}return c}
function dealTriples(rnd){
  const total=state.tiles.length,groupCount=Math.floor(total/3);
  const pool=shuffleWith(rnd,SYMBOLS),cap=Math.max(5,Math.min(pool.length,Math.ceil(groupCount*.63))),types=pool.slice(0,cap);
  const bag=[];
  for(let i=0;i<groupCount;i++){const t=types[i%types.length];bag.push(t,t,t)}
  // 任何一张牌都能点，只要每种牌是 3 的倍数就一定能通关，所以类型完全打散，
  // 相同的牌不会挤在一起（按取牌顺序分组会让三张同款紧挨着）
  const mixed=shuffleWith(rnd,bag);
  shuffleWith(rnd,state.tiles).forEach((tile,i)=>tile.type=mixed[i]);
}
function reassignTypes(rnd){
  const board=state.tiles.filter(t=>!t.removed&&!t.inTray);
  const bag=shuffleWith(rnd,board.map(t=>t.type));
  board.forEach((tile,i)=>tile.type=bag[i]);
}
function launchLevel(level){loadLives();if(state.lives<=0){stopTimer();state.pendingLevel=level;openSheet('lifeSheet');return}state.lives--;saveLives();buildLevel(level)}
const TOOL_LABEL={clear:'消除',shuffle:'洗牌',undo:'翻牌',magnet:'磁铁'};
function updateToolUses(){$$('.g-prop').forEach(el=>{const n=state.tools[el.dataset.tool]||0;el.querySelector('.g-prop-count').textContent=n;el.classList.toggle('empty',n<=0)})}
function buildLevel(level){
  stopTimer();clearTimeout(state.dealTimer);const effectId=++state.effectId;
  const hands=$('#boardWrap .shuffle-hands');
  if(hands)hands.replaceWith(hands.cloneNode(true));
  state.animating=true;state.dealing=true;state.over=false;
  $$('.match-clone,.match-burst').forEach(el=>el.remove());closeSheets(false);
  state.level=level;state.seconds=0;state.tick=0;state.remain=600;state.hints=0;state.shuffles=0;
  state.slots=[];state.score=0;state.combo=1;state.comboUntil=0;
  state.tools={clear:1,shuffle:1,undo:1,magnet:1};
  showScreen('game');
  const rnd=seeded(level),positions=makeLayout(level,rnd),rnd2=seeded(level*7+3);
  state.tiles=positions.map((p,i)=>({id:i,type:'',...p,layoutX:p.x,layoutY:p.y,layoutZ:p.z,rot:p.rot??0,rot2:(rnd2()-.5)*14,removed:false,inTray:false,stand:0,leanOn:null}));
  dealTriples(rnd);assignLeaners(seeded(level*13+5));
  state.initial=state.tiles.length;state.initialTypeCount=new Set(state.tiles.map(t=>t.type)).size;
  $('#timer').textContent=formatTime(state.remain);$('#scoreCount').textContent='0';$('#levelName').textContent=level;
  updateToolUses();updateCombo();render(true);renderTray();
  const reduced=!state.motion,dealDuration=reduced?120:3400;
  if(!reduced)[400,950,1550,2150,2820].forEach((delay,i)=>setTimeout(()=>{if(effectId===state.effectId)tone(260+i*35,.045)},delay));
  state.dealTimer=setTimeout(()=>{
    if(effectId!==state.effectId)return;
    state.dealing=false;state.animating=false;$('#boardWrap').classList.remove('is-dealing');
    $$('.deal-in').forEach(el=>el.classList.remove('deal-in'));render();
    if(!$('#overlay').classList.contains('show'))startTimer();
    if(level===1){$('#coach').classList.remove('hidden');$('#coachText').textContent='点击麻将放进卡槽，凑满三张相同即可消除';setTimeout(()=>$('#coach').classList.add('hidden'),4200)}
  },dealDuration);
  saveProgress();if(level!==1)$('#coach').classList.add('hidden');
}
function tileStatus(t){
  if(t.removed||t.inTray)return{free:false,blockers:[]};
  const above=state.tiles.filter(o=>!o.removed&&!o.inTray&&o.z>t.z&&Math.abs(o.x-t.x)<.88&&Math.abs(o.y-t.y)<.88);
  return{free:!above.length,blockers:above.map(o=>o.id)};
}
function isFree(t){return tileStatus(t).free}
function assignLeaners(rnd){
  TileMotion.assignLeaners(state.tiles,rnd);
}
function settleBoard(){
  let changed=false;
  const targets=TileMotion.targets(state.tiles);
  for(const t of state.tiles){
    const goal=targets.get(t.id);
    if(!goal||goal.z===t.z&&goal.lean===(t.stand||0)&&goal.x===t.x)continue;
    const from={...(t.motion?.current||{x:t.x,y:t.y,z:t.z,lean:t.stand||0})};
    t.motion={from,current:{...from},target:goal,velocity:t.motion?.velocity||0,angularVelocity:t.motion?.angularVelocity||0};
    t.x=goal.x;t.y=goal.y;t.z=goal.z;t.stand=goal.lean;t.leanOn=goal.leanOn;
    if(!state.motion)t.motion=null;
    changed=true;
  }
  if(changed)startTileMotion();
  return changed;
}
const FACE_NUM={'一':1,'二':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9};
const FACE_COLORS=['#146c59','#b52d2a','#21699a'];
const FACE_POS={
  1:[[50,50]],2:[[50,29],[50,71]],3:[[29,27],[50,50],[71,73]],
  4:[[31,30],[69,30],[31,70],[69,70]],5:[[29,27],[71,27],[50,50],[29,73],[71,73]],
  6:[[31,24],[69,24],[31,50],[69,50],[31,76],[69,76]],
  7:[[30,22],[70,22],[30,50],[50,50],[70,50],[30,78],[70,78]],
  8:[[31,18],[69,18],[31,39],[69,39],[31,61],[69,61],[31,82],[69,82]],
  9:[[26,22],[50,22],[74,22],[26,50],[50,50],[74,50],[26,78],[50,78],[74,78]]
};
function svgFace(body){return`<svg class="tile-art" viewBox="8 8 84 84" aria-hidden="true">${body}</svg>`}
function circleFace(n){
  const B='#2639a7',G='#075c45',R='#b40e40',patterns={
    2:[[50,26,B],[50,74,G]],3:[[27,27,B],[50,50,R],[73,73,G]],
    4:[[30,29,B],[70,29,G],[30,71,G],[70,71,B]],
    5:[[29,27,B],[71,27,G],[50,50,R],[29,73,G],[71,73,B]],
    6:[[34,22,G],[66,22,G],[34,49,R],[66,49,R],[34,77,R],[66,77,R]],
    7:[[24,18,G],[49,34,G],[74,50,G],[35,65,R],[65,65,R],[35,83,R],[65,83,R]],
    8:[[36,16,B],[64,16,B],[36,39,B],[64,39,B],[36,62,B],[64,62,B],[36,84,B],[64,84,B]],
    9:[[24,22,B],[50,22,B],[76,22,B],[24,50,R],[50,50,R],[76,50,R],[24,78,G],[50,78,G],[76,78,G]]
  };
  if(n===1)return svgFace(`<g transform="translate(50 50)"><circle r="31" fill="${B}"/><circle r="27" fill="#f9f7ea"/><circle r="23" fill="${G}"/><circle r="19" fill="#f9f7ea"/><circle r="15" fill="${G}"/><circle r="11" fill="#f9f7ea"/><circle r="8" fill="${R}"/><circle r="5" fill="#f9f7ea"/></g>`);
  const dots=patterns[n].map((p)=>{const [x,y,c]=p,r=n>=8?7.8:n===7?7.4:9.2;return`<g transform="translate(${x} ${y})"><circle r="${r}" fill="#183c35"/><circle r="${r*.8}" fill="${c}"/><circle r="${r*.55}" fill="#faf7e9"/><circle r="${r*.31}" fill="${c}"/><circle r="${r*.12}" fill="#faf7e9"/></g>`}).join('');
  return svgFace(dots);
}
function bambooFace(n){
  const B='#2639a7',G='#075c45',R='#b40e40';
  if(n===1)return svgFace(`<g stroke-linecap="round" stroke-linejoin="round"><path d="M54 18c13 3 19 13 15 25-3 9-12 14-22 11-8-2-13-9-12-17 1-9 8-15 19-15" fill="#f8f3df" stroke="${B}" stroke-width="3"/><path d="M49 25c9-2 15 3 16 11-8-4-16-2-21 5 0-8 1-13 5-16Z" fill="${B}"/><path d="M36 48c-11 4-19 13-23 25m24-19c-4 14-11 24-22 31m28-29c-2 15 1 25 8 32m-5-33c8 10 18 15 31 16M34 45 17 38m17 7-18 5" fill="none" stroke="${G}" stroke-width="3"/><path d="M42 53c7 3 12 9 14 18-8-2-14-6-18-13Z" fill="${R}"/><path d="M51 19c5-7 12-8 18-4l-10 7Z" fill="${R}"/><circle cx="57" cy="29" r="2.3" fill="#172b28"/><path d="m67 34 11 3-10 5Z" fill="#c28a2d"/></g>`);
  if(n===8)return svgFace(`<g fill="none" stroke="${G}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"><path d="M24 18v23m52-23v23M31 20l19 17 19-17M24 59v23m52-23v23M31 61l19 17 19-17"/><path d="M24 29h7m38 0h7M24 70h7m38 0h7" stroke="#d8efe4" stroke-width="1.5" opacity=".55"/></g>`);
  const patterns={
    2:[[50,27,G],[50,73,G]],3:[[50,24,G],[32,72,G],[68,72,G]],
    4:[[34,28,G],[66,28,G],[34,72,G],[66,72,G]],
    5:[[32,25,G],[68,25,G],[50,50,R],[32,75,G],[68,75,G]],
    6:[[28,28,G],[50,28,G],[72,28,G],[28,72,G],[50,72,G],[72,72,G]],
    7:[[30,45,G],[30,73,G],[50,19,R],[50,46,B],[50,73,B],[70,45,G],[70,73,G]],
    9:[[25,22,G],[50,22,R],[75,22,G],[25,50,G],[50,50,R],[75,50,G],[25,78,G],[50,78,R],[75,78,G]]
  };
  const pieces=patterns[n].map(([x,y,c])=>`<g transform="translate(${x} ${y})"><path d="M-6-11H6C3-7 3-3 6 0C3 3 3 7 6 11H-6C-3 7-3 3-6 0C-3-3-3-7-6-11Z" fill="#173d31"/><path d="M-4.2-9H4.2C2-5 2-2 4.2 0C2 2 2 5 4.2 9H-4.2C-2 5-2 2-4.2 0C-2-2-2-5-4.2-9Z" fill="${c}"/></g>`).join('');
  return svgFace(pieces);
}
const WAN_CHARS=['','一','二','三','四','伍','六','七','八','九'];
function embossText(cls,ch,y){return`<text class="${cls} wan-sh" x="50.5" y="${y+.6}">${ch}</text><text class="${cls} wan-hi" x="49.6" y="${y-.4}">${ch}</text><text class="${cls}" x="50" y="${y}">${ch}</text>`}
function wanFace(n){return`<svg class="tile-art" viewBox="0 0 100 137" aria-hidden="true">${embossText('wan-num',WAN_CHARS[n],58)}${embossText('wan-char','萬',122)}</svg>`}
function tileFace(type){const n=FACE_NUM[type[0]]||0;if(type.endsWith('萬'))return wanFace(n);const key=type.endsWith('筒')?`circle-${n}`:type.endsWith('索')?`bamboo-${n}`:PICTURE_TILES[type];return`<img class="tile-reference-art" src="assets/tiles-face/${key}.png" alt="" aria-hidden="true">`}
function boardMetrics(){const xs=state.tiles.map(t=>t.layoutX??t.x),ys=state.tiles.map(t=>t.layoutY??t.y),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys),spanX=maxX-minX+1.12,spanY=maxY-minY+1.02,b=$('#board').getBoundingClientRect(),count=state.tiles.length,gap=0,maxLayer=Math.max(0,...state.tiles.map(t=>t.layoutZ??t.z)),edge={left:10+maxLayer*5,top:10+maxLayer*9,right:16,bottom:18},availableW=Math.max(1,b.width-edge.left-edge.right),availableH=Math.max(1,b.height-edge.top-edge.bottom),ratio=1.3636,preferredMax=state.level===1?96:count<=16?112:count<=28?100:count<48?86:78,widthLimit=availableW/spanX,heightLimit=(availableH/spanY)/ratio,w=Math.max(20,Math.min(preferredMax,widthLimit,heightLimit)),h=w*ratio,totalW=w*spanX,totalH=h*spanY,freeX=Math.max(0,availableW-totalW),freeY=Math.max(0,availableH-totalH);return{w,h,gap,ox:edge.left+freeX/2-minX*(w+gap),oy:edge.top+freeY/2-minY*(h+gap)}}
const tileEls=new Map();
function tileMarkup(t){
  return`<span class="baked-body"><span class="baked-shell"></span><span class="baked-shell baked-shell-next"></span><span class="baked-art">${tileFace(t.type)}</span></span>`;
}
function poseTransform(t,lean,z,width=0){
  const spin=(t.rot||0)+(t.rot2||0);
  const lift=Math.abs(Math.sin(lean*Math.PI/180))*width*.27;
  return`translate(${-z*5}px,${-z*9-lift}px) rotate(${spin}deg)`;
}
function tileTransform(t){
  return poseTransform(t,t.stand||0,t.z);
}
function paintTilePose(el,t,p,m){
  const sample=Math.max(0,Math.min(TILE_POSES.length-1,(p.lean+70)/5));
  const index=Math.floor(sample),next=Math.min(TILE_POSES.length-1,index+1),blend=sample-index;
  const body=el.firstElementChild;
  if(body._sample!==sample||body._width!==m.w){
    body.dataset.pose=Math.round(sample);body._sample=sample;body._width=m.w;
    body.querySelector('.baked-shell').style.backgroundPosition=`${index%6*20}% ${Math.floor(index/6)*25}%`;
    const overlay=body.querySelector('.baked-shell-next');
    overlay.style.backgroundPosition=`${next%6*20}% ${Math.floor(next/6)*25}%`;overlay.style.opacity=blend;
    const [a,b,c,d,x,y]=TILE_POSES[index].matrix.map((v,i)=>v+(TILE_POSES[next].matrix[i]-v)*blend);
    body.querySelector('.baked-art').style.transform=`matrix(${a},${b},${c},${d},${x*m.w},${y*m.w})`;
  }
  el.style.left=`${m.ox+p.x*(m.w+m.gap)}px`;
  el.style.top=`${m.oy+p.y*(m.h+m.gap)}px`;
  el.style.transform=poseTransform(t,p.lean,p.z,m.w);
  el.style.zIndex=String(TileMotion.depth(p.z,p.lean,Math.max(0,...state.tiles.map(o=>o.layoutZ??o.z))));
  el.style.setProperty('--contact-shadow',`${1+p.z*2+Math.abs(p.lean)*.025}px`);
}
let tileMotionFrame=0,tileMotionTime=0;
function startTileMotion(){
  if(tileMotionFrame)return;
  tileMotionTime=performance.now();
  const tick=now=>{
    const dt=Math.min(.05,(now-tileMotionTime)/1000);tileMotionTime=now;
    let active=false;const m=boardMetrics();
    for(const t of state.tiles){
      if(!t.motion||t.removed||t.inTray)continue;
      let done=false;
      const steps=Math.max(1,Math.ceil(dt/.016));
      for(let i=0;i<steps&&!done;i++)done=TileMotion.step(t.motion,dt/steps);
      const el=tileEls.get(t.id);
      if(el)paintTilePose(el,t,t.motion.current,m);
      if(done){t.motion=null;el?.classList.remove('settling');}else active=true;
    }
    tileMotionFrame=active?requestAnimationFrame(tick):0;
  };
  tileMotionFrame=requestAnimationFrame(tick);
}
function render(rebuild=false){
  const board=$('#board'),m=boardMetrics();$('#game').dataset.motion=state.motion?'on':'off';
  if(rebuild){board.innerHTML='';tileEls.clear()}
  if(rebuild)state.tiles.forEach(t=>{t.animFrom=null;t.animStarted=false});
  const live=state.tiles.filter(t=>!t.removed&&!t.inTray),liveIds=new Set(live.map(t=>t.id));
  tileEls.forEach((el,id)=>{if(!liveIds.has(id)){el.remove();tileEls.delete(id)}});
  $('#boardWrap').classList.toggle('is-dealing',state.dealing);
  const dealOrder=state.dealing?[...live].sort((a,b)=>a.z-b.z||Math.abs(a.x-2.5)-Math.abs(b.x-2.5)||a.y-b.y).map(t=>t.id):[];
  live.forEach(t=>{
    let el=tileEls.get(t.id);
    if(!el){
      el=document.createElement('button');el.dataset.id=t.id;
      el.onclick=()=>pickTile(t.id);board.appendChild(el);tileEls.set(t.id,el);
    }
    if(el.dataset.type!==t.type){el.dataset.type=t.type;el.innerHTML=tileMarkup(t);el._key=null}
    const lean=t.stand||0;
    const wantCls=`tile layer-${t.z}${state.dealing?' deal-in':''}${lean?' standing':''}${t.motion?' settling':''}`;
    if(el.className!==wantCls)el.className=wantCls;
    el.setAttribute('aria-label',t.type);
    el.dataset.support=t.leanOn??'';
    const left=m.ox+t.x*(m.w+m.gap),top=m.oy+t.y*(m.h+m.gap),dealIndex=dealOrder.indexOf(t.id);
    const boxH=m.w*1.4,cls=wantCls,zi=TileMotion.depth(t.z,lean,Math.max(0,...state.tiles.map(o=>o.layoutZ??o.z)));
    // 每次点牌只有少数几张真的变了，跳过没变的牌，避免整盘 105 张全部重排重绘
    const key=`${m.w}|${boxH}|${left}|${top}|${zi}|${cls}|${t.stand}|${t.animStarted}|${state.dealing}`;
    if(el._key===key)return;
    el._key=key;
    el.style.width=`${m.w}px`;el.style.height=`${boxH.toFixed(2)}px`;
    if(!(t.animFrom&&!t.animStarted)){el.style.left=`${left}px`;el.style.top=`${top}px`}
    el.style.setProperty('--tw',`${m.w}px`);el.style.setProperty('--th',`${boxH.toFixed(2)}px`);el.style.setProperty('--td',`${(m.w*.22).toFixed(1)}px`);
    el.style.zIndex=zi;   // 立起来的牌比整堆都高，不该被上层平牌盖住
    el.style.transformOrigin='50% 50%';
    paintTilePose(el,t,t.motion?.current||{x:t.x,y:t.y,z:t.z,lean},m);
    el.style.setProperty('--rest-x',`${-t.z*5}px`);
    el.style.setProperty('--rest-y',`${-t.z*9-Math.abs(Math.sin(lean*Math.PI/180))*m.w*.27}px`);
    el.style.setProperty('--rest-rot',`${(t.rot||0)+(t.rot2||0)}deg`);
    el.style.setProperty('--deal-lift','30px');
    if(state.dealing){
      el.style.setProperty('--deal-x',`${board.clientWidth/2-(left+m.w/2)}px`);
      el.style.setProperty('--deal-y',`${board.clientHeight*.46-(top+m.h/2)}px`);
      el.style.setProperty('--deal-delay',`${Math.max(0,dealIndex)*8+t.z*150}ms`);
      el.style.setProperty('--deal-rotate',dealIndex%2?'-10deg':'10deg');
      el.style.setProperty('--wash-x',`${Math.sin(t.id*2.4)*m.w*.7}px`);
      el.style.setProperty('--wash-y',`${Math.cos(t.id*1.7)*m.h*.45}px`);
      el.style.setProperty('--wash-spin',`${(t.id%2?1:-1)*(18+t.id%23)}deg`);
    }
  });
  $('#totalCount').textContent=state.initial;
  $('#remainingTypes').textContent=state.initialTypeCount;
  $('#remainingCount').textContent=state.tiles.filter(t=>!t.removed).length;
}
function renderTray(popIndex=-1){
  const tray=$('#slotTray');tray.innerHTML='';
  for(let i=0;i<7;i++){
    const t=state.slots[i],slot=document.createElement('div');
    slot.className=`g-slot${t?' filled':''}${i===popIndex?' pop':''}`;
    if(t)slot.innerHTML=tileFace(t.type);
    tray.appendChild(slot);
  }
  tray.classList.toggle('danger',state.slots.length>=6);
}
function updateCombo(){
  const fill=$('#comboFill');if(!fill)return;
  const left=Math.max(0,state.comboUntil-Date.now());
  $('#comboText').textContent=`x${state.combo}`;
  fill.style.width=`${state.combo>1?left/5000*100:100}%`;
}
function bumpCombo(){const now=Date.now();state.combo=now<state.comboUntil?Math.min(9,state.combo+1):1;state.comboUntil=now+5000;updateCombo()}
function pickTile(id){
  if(state.animating||state.over||state.dealing)return;
  const t=state.tiles.find(x=>x.id===id);if(!t||t.removed||t.inTray)return;
  if(state.slots.length>=7){toast('卡槽已满');return}
  moveToTray(t);tone(430);haptic();
}
function moveToTray(t){
  t.motion=null;
  t.inTray=true;
  const last=state.slots.map(s=>s.type).lastIndexOf(t.type),idx=last>=0?last+1:state.slots.length;
  state.slots.splice(idx,0,t);settleBoard();
  render();renderTray(idx);resolveTray();
}
function resolveTray(){
  const counts={};state.slots.forEach(s=>counts[s.type]=(counts[s.type]||0)+1);
  const hit=Object.keys(counts).find(k=>counts[k]>=3);
  if(!hit){checkFail();return}
  state.animating=true;
  const picks=state.slots.filter(s=>s.type===hit).slice(0,3),cells=$$('#slotTray .g-slot');
  picks.forEach(p=>cells[state.slots.indexOf(p)]?.classList.add('clearing'));
  tone(620,.1);setTimeout(()=>tone(880,.14),140);haptic([12,24,28]);
  setTimeout(()=>{
    picks.forEach(p=>{p.removed=true;p.inTray=false;state.slots.splice(state.slots.indexOf(p),1)});
    settleBoard();bumpCombo();state.score+=state.combo;$('#scoreCount').textContent=state.score;
    state.animating=false;render();renderTray();
    if(state.tiles.every(x=>x.removed))setTimeout(finishLevel,380);else checkFail();
  },300);
}
function checkFail(){
  $('#slotTray').classList.toggle('danger',state.slots.length>=6);
  if(state.slots.length>=7)failLevel('卡槽已满','卡槽放满 7 张，但没有凑齐三张相同的麻将。');
}
function clearTiles(picks,label){
  state.animating=true;
  picks.forEach(t=>$(`.tile[data-id="${t.id}"]`)?.classList.add('picked'));
  tone(620,.1);setTimeout(()=>tone(880,.14),140);
  setTimeout(()=>{
    picks.forEach(t=>{t.removed=true;t.inTray=false});
    state.slots=state.slots.filter(s=>!picks.includes(s));
    settleBoard();bumpCombo();state.score+=state.combo;$('#scoreCount').textContent=state.score;
    state.animating=false;render();renderTray();
    if(label)toast(label);
    if(state.tiles.every(x=>x.removed))setTimeout(finishLevel,380);else checkFail();
  },260);
}
function requestToolAd(tool){stopTimer();state.pendingTool=tool;$('#toolAdTitle').textContent=`补充1次${TOOL_LABEL[tool]||'道具'}`;openSheet('toolAdSheet')}
function useTool(name){
  if(state.animating||state.over||state.dealing)return;
  if((state.tools[name]||0)<=0){requestToolAd(name);return}
  const run={clear:toolClear,shuffle:toolShuffle,undo:toolUndo,magnet:toolMagnet}[name];
  if(!run||run()===false)return;
  state.tools[name]--;updateToolUses();haptic([8,20,8]);
}
function toolClear(){
  const board=state.tiles.filter(t=>!t.removed&&!t.inTray),counts={};
  board.forEach(t=>counts[t.type]=(counts[t.type]||0)+1);
  const type=Object.keys(counts).filter(k=>counts[k]>=3).sort((a,b)=>counts[b]-counts[a])[0];
  if(!type){toast('牌面上没有可直接消除的三张');return false}
  clearTiles(removalOrder(board.filter(t=>t.type===type)).slice(0,3),`消除了三张${type}`);
}
function toolShuffle(){
  reassignTypes(Math.random);state.shuffles++;render();renderTray();
  toast('牌面已重新洗过');
}
function toolUndo(){
  const t=state.slots.pop();
  if(!t){toast('卡槽是空的，无需回退');return false}
  t.inTray=false;render();renderTray();checkFail();
  toast('已把最后一张放回牌面');
}
function toolMagnet(){
  const counts={};state.slots.forEach(s=>counts[s.type]=(counts[s.type]||0)+1);
  const type=Object.keys(counts).sort((a,b)=>counts[b]-counts[a])[0];
  if(!type){toast('卡槽为空，磁铁没有目标');return false}
  const need=3-counts[type],board=state.tiles.filter(t=>!t.removed&&!t.inTray&&t.type===type);
  if(board.length<need){toast('牌面里没有足够的同款麻将');return false}
  clearTiles([...state.slots.filter(s=>s.type===type),...removalOrder(board).slice(0,need)],`磁铁吸出了${need}张${type}`);
}
function shuffleTiles(){useTool('shuffle')}
function startTimer(){
  if(state.timer||state.dealing||state.over)return;
  state.timer=setInterval(()=>{
    state.tick++;
    if(state.tick%10===0){
      state.remain--;state.seconds++;
      $('#timer').textContent=formatTime(Math.max(0,state.remain));
      $('.g-timer')?.classList.toggle('urgent',state.remain<=60);
      if(state.remain<=10&&state.remain>0)tone(700,.05);
      if(state.remain<=0){stopTimer();failLevel('时间到','本局 10 分钟已经用完。');return}
    }
    if(state.combo>1&&Date.now()>=state.comboUntil)state.combo=1;
    updateCombo();
  },100);
}
function stopTimer(){clearInterval(state.timer);state.timer=null}
function formatTime(s){return`${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`}
function failLevel(title,desc){
  if(state.over)return;
  state.over=true;stopTimer();state.animating=false;
  $('#failTitle').textContent=title;$('#failDesc').textContent=desc;
  openSheet('failSheet');haptic([30,60,30]);tone(220,.3);
}
function finishLevel(){stopTimer();const old=state.records[state.level],earnedStars=state.remain>420?3:state.remain>240?2:1;state.records[state.level]={best:old?Math.min(old.best,state.seconds):state.seconds,played:(old?.played||0)+1,stars:Math.max(old?.stars||0,earnedStars)};state.unlockedLevel=Math.max(state.unlockedLevel,state.level+1);localStorage.setItem('sparrow-records-v36',JSON.stringify(state.records));saveProgress();$('#stars').innerHTML=Array.from({length:3},(_,i)=>`<span class="${i<earnedStars?'earned':'empty'}">★</span>`).join(' ');$('#resultQuote').textContent=earnedStars===0?'借助工具也没关系，下一局试试刷新纪录。':state.level>20?'无尽之路，没有最后一关。':'很好，下一局会多一点变化。';$('#nextBtn .cta-copy b').textContent='下一关';$('#result').classList.add('is-active');haptic([20,40,20,40,40]);tone(760,.18)}

function recordStats(){const levels=Object.keys(state.records).map(Number),completed=levels.length,total=levels.reduce((sum,l)=>sum+(state.records[l]?.best||0),0),highest=Math.max(0,...levels);return{levels,completed,total,highest}}
function showRecords(){const s=recordStats(),highestReached=Math.max(state.unlockedLevel,s.highest);$('#highestLevel').textContent=`第 ${highestReached} 关`;$('#recordMeta').textContent=`完成 ${s.completed} 关 · 最佳总时 ${formatLongTime(s.total)}`;const limit=Math.max(10,s.highest+3),list=$('#recordList');list.innerHTML='';for(let i=1;i<=limit;i++){const rec=state.records[i],row=document.createElement('div');row.className='record-row'+(rec?'':' locked');row.innerHTML=`<span class="record-number">${String(i).padStart(2,'0')}</span><span><b>第 ${i} 关</b><small>${rec?`挑战 ${rec.played||1} 次`:'尚未完成'}</small></span><strong class="record-time">${rec?formatTime(rec.best):'--:--'}</strong>`;list.appendChild(row)}showScreen('records')}
function formatLongTime(seconds){const h=Math.floor(seconds/3600),m=Math.floor(seconds%3600/60),s=seconds%60;return h?`${h}时${m}分`:`${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`}
const MOCK_PLAYERS=[['Minh Anh',126,8420],['Ngọc Linh',118,7310],['Quang Huy',118,7790],['Thảo Vy',97,6084],['Gia Bảo',83,4960],['Hà My',76,4280],['Tuấn Kiệt',64,3970],['Khánh An',51,3020],['Bảo Ngọc',42,2690],['Đức Anh',35,2175],['Mai Chi',28,1690],['Thanh Tâm',21,1370]];
function leaderboardData(){const s=recordStats(),players=MOCK_PLAYERS.map((p,i)=>({name:p[0],completed:p[1],time:p[2],avatar:p[0].split(' ').map(x=>x[0]).join('').slice(-2),me:false}));players.push({name:'我',completed:s.completed,time:s.total,avatar:'我',me:true});return players.sort((a,b)=>b.completed-a.completed||a.time-b.time)}
function showRanking(){const data=leaderboardData(),pod=$('#podium');pod.innerHTML='';data.slice(0,3).forEach((p,i)=>{const el=document.createElement('div');el.className=`podium-person ${['first','second','third'][i]}`;el.innerHTML=`<span class="avatar">${p.avatar}</span><b>${p.name}</b><small>${p.completed} 关</small><span class="podium-block">${i+1}</span>`;pod.appendChild(el)});const list=$('#rankList');list.innerHTML='';data.slice(3).forEach((p,index)=>{const pos=index+4,row=document.createElement('div');row.className='rank-row'+(p.me?' me':'');row.innerHTML=`<span class="rank-pos">${pos}</span><span class="mini-avatar">${p.avatar}</span><span class="rank-user"><b>${p.name}${p.me?'（本机）':''}</b><small>${p.me?'你的当前成绩':'越南 · 玩家'}</small></span><span class="rank-score"><b>${p.completed} 关</b><small>${formatLongTime(p.time)}</small></span>`;list.appendChild(row)});showScreen('ranking')}
function goHome(){state.effectId++;clearTimeout(state.dealTimer);state.dealing=false;state.animating=false;stopTimer();closeSheets(false);showScreen('welcome');loadPrefs()}
function showGoogleAuth(){$('#soundSheet').classList.remove('show');$('#googleSheet').classList.add('show')}
function hideGoogleAuth(){$('#googleSheet').classList.remove('show');$('#soundSheet').classList.add('show')}

$('#startBtn').onclick=()=>launchLevel(state.unlockedLevel);$('#newJourneyBtn').onclick=()=>launchLevel(1);$('#recordsBtn')?.addEventListener('click',showRecords);$('#rankingBtn')?.addEventListener('click',showRanking);$$('.sub-back').forEach(b=>b.onclick=()=>{loadPrefs();showScreen('welcome')});$('#rankInfoBtn').onclick=()=>toast('同关卡数时，最佳总用时更少者优先');$('.ranking-tabs').onclick=e=>{if(e.target.tagName!=='BUTTON')return;$$('.ranking-tabs button').forEach(b=>b.classList.toggle('active',b===e.target));showRanking()};$$('.g-prop').forEach(el=>{const tool=el.dataset.tool;el.querySelector('.g-prop-main').onclick=()=>useTool(tool);el.querySelector('.g-prop-add').onclick=e=>{e.stopPropagation();requestToolAd(tool)}});$('#pauseBtn').onclick=()=>openSheet('pauseSheet');$('#gMoreBtn').onclick=()=>openSheet('pauseSheet');$('#gRulesBtn').onclick=()=>openSheet('rulesSheet');$('#gQuitBtn').onclick=goHome;$('#failRetryBtn').onclick=()=>{closeSheets(false);launchLevel(state.level)};$('#failHomeBtn').onclick=goHome;$('#nextBtn').onclick=()=>launchLevel(Math.max(state.level+1,state.unlockedLevel));$('#replayBtn').onclick=()=>launchLevel(state.level);
$('#resultHomeBtn').onclick=goHome;$$('[data-open]').forEach(b=>b.onclick=()=>openSheet(b.dataset.open));$$('[data-close]').forEach(b=>b.onclick=()=>closeSheets());$('#overlay').onclick=()=>closeSheets();$('#restartBtn').onclick=()=>{closeSheets(false);launchLevel(state.level)};$('#cloudSaveBtn').onclick=()=>state.cloudLinked?toast('进度已安全同步'):showGoogleAuth();$$('.google-cancel').forEach(b=>b.onclick=hideGoogleAuth);$('#googleSignInBtn').onclick=()=>{const btn=$('#googleSignInBtn');btn.disabled=true;btn.innerHTML='<span class="google-spinner"></span><span>正在连接Google…</span>';setTimeout(()=>{state.cloudLinked=true;localStorage.setItem('mahjong-google-linked','true');updateCloudUI();btn.disabled=false;btn.innerHTML='<span class="google-g">G</span><span>使用Google账号继续</span>';hideGoogleAuth();toast('进度已同步')},1100)};$('#watchAdBtn').onclick=()=>{const btn=$('#watchAdBtn');if(btn.disabled)return;btn.disabled=true;let n=3;btn.textContent=`广告播放中 · ${n}`;const timer=setInterval(()=>{n--;btn.textContent=n?`广告播放中 · ${n}`:'领取成功 · +1命';if(n)return;clearInterval(timer);state.lives=Math.min(5,state.lives+1);saveLives();btn.disabled=false;setTimeout(()=>{btn.innerHTML='<span>▶</span> 观看广告 · +1命';closeSheets(false);const level=state.pendingLevel;state.pendingLevel=null;if(level)launchLevel(level)},500)},650)};$('#pauseHomeBtn').onclick=goHome;function updateSound(value){state.sound=value;syncSettingToggles();savePrefs()}function updateHaptic(value){state.haptic=value;syncSettingToggles();savePrefs()}$('#soundToggle').onchange=e=>updateSound(e.target.checked);$('#gameSoundToggle').onchange=e=>updateSound(e.target.checked);$('#hapticToggle').onchange=e=>updateHaptic(e.target.checked);$('#gameHapticToggle').onchange=e=>updateHaptic(e.target.checked);window.addEventListener('resize',()=>{if($('#game').classList.contains('is-active'))render()});document.addEventListener('visibilitychange',()=>document.hidden?stopTimer():($('#game').classList.contains('is-active')&&startTimer()));
$('#googleLogoutBtn').onclick=()=>{state.cloudLinked=false;localStorage.removeItem('mahjong-google-linked');updateCloudUI()};
$$('.energy-add').forEach(btn=>btn.onclick=()=>{if(state.lives>=5)return;updateLivesUI();openSheet('energyAdSheet')});
$('#watchEnergyAdBtn').onclick=()=>{const btn=$('#watchEnergyAdBtn');if(btn.disabled||state.lives>=5)return;btn.disabled=true;let n=3;btn.textContent=`广告播放中 · ${n}`;const timer=setInterval(()=>{n--;btn.textContent=n?`广告播放中 · ${n}`:'领取成功 · +1体力';if(n)return;clearInterval(timer);state.lives=Math.min(5,state.lives+1);saveLives();btn.disabled=false;setTimeout(()=>{btn.textContent='观看广告 · +1体力';closeSheets()},450)},650)};
$('#watchAdBtn').onclick=()=>{const btn=$('#watchAdBtn');if(btn.disabled)return;btn.disabled=true;let n=3;btn.textContent=`广告播放中 · ${n}`;const timer=setInterval(()=>{n--;btn.textContent=n?`广告播放中 · ${n}`:'领取成功 · +1体力';if(n)return;clearInterval(timer);state.lives=Math.min(5,state.lives+1);saveLives();btn.disabled=false;setTimeout(()=>{btn.innerHTML='<span>▶</span> 观看广告 · +1体力';closeSheets(false);const level=state.pendingLevel;state.pendingLevel=null;if(level)launchLevel(level)},500)},650)};
$('#watchToolAdBtn').onclick=()=>{const btn=$('#watchToolAdBtn');if(btn.disabled)return;btn.disabled=true;let n=3;btn.textContent=`广告播放中 · ${n}`;const timer=setInterval(()=>{n--;btn.textContent=n?`广告播放中 · ${n}`:'领取成功 · +1次';if(n)return;clearInterval(timer);if(state.pendingTool)state.tools[state.pendingTool]=(state.tools[state.pendingTool]||0)+1;state.pendingTool=null;updateToolUses();btn.disabled=false;setTimeout(()=>{btn.textContent='观看广告 · +1次';closeSheets()},450)},650)};
$$('.energy-add').forEach(btn=>btn.onclick=()=>{updateLivesUI();openSheet('energyAdSheet')});
$('#watchEnergyAdBtn').onclick=()=>{const btn=$('#watchEnergyAdBtn');if(btn.disabled)return;btn.disabled=true;let n=3;btn.textContent=`广告播放中 · ${n}`;const timer=setInterval(()=>{n--;btn.textContent=n?`广告播放中 · ${n}`:'领取成功 · +1体力';if(n)return;clearInterval(timer);state.lives++;saveLives();btn.disabled=false;setTimeout(()=>{btn.textContent='观看广告 · +1体力';closeSheets()},450)},650)};
$('#checkinBtn').onclick=openCheckin;$('#claimCheckinBtn').onclick=()=>{const today=todayKey();if(state.checkinHistory.includes(today))return;const day=new Date().getDay(),reward=day===0||day===6?2:1;state.checkinHistory.push(today);localStorage.setItem('mahjong-checkins',JSON.stringify(state.checkinHistory));state.lives+=reward;saveLives();renderCheckin();$('#claimCheckinBtn').textContent=`签到成功 · +${reward}体力`;setTimeout(()=>closeSheets(),700)};
function completeShare(channel){const rewarded=state.shareCount<1;if(rewarded){state.shareCount=1;state.lives+=2;localStorage.setItem('mahjong-daily-shares',JSON.stringify({date:todayKey(),count:1}));saveLives()}updateShareUI();$('#shareStatus').textContent=rewarded?`${channel} 分享成功 · +2体力`:`已通过${channel}分享`;haptic([8,20,8])}
$$('.share-channel').forEach(btn=>btn.onclick=()=>{const channel=btn.dataset.channel||'应用';btn.classList.add('sharing');setTimeout(()=>{btn.classList.remove('sharing');completeShare(channel)},500)});
$('#languageBtn').onclick=()=>{updateLanguageUI();openSheet('languageSheet')};$$('#languageList button').forEach(btn=>btn.onclick=()=>{state.language=btn.dataset.language;localStorage.setItem('mahjong-language',state.language);updateLanguageUI();setTimeout(()=>closeSheets(),250)});
$('#aboutBtn').onclick=()=>{$('#soundSheet').classList.remove('show');openSheet('aboutSheet')};$$('.legal-row').forEach(btn=>btn.onclick=()=>{btn.classList.toggle('expanded');btn.querySelector('b').textContent=btn.classList.contains('expanded')?'内容由开发团队填写':'›'});
$('#playerNameInput').oninput=e=>{const chars=[...e.target.value];if(chars.length>15)e.target.value=chars.slice(0,15).join('');$('#nameCount').textContent=[...e.target.value].length};$('#saveProfileBtn').onclick=()=>{const name=[...$('#playerNameInput').value.trim()].slice(0,15).join('');state.playerName=name||'玩家';localStorage.setItem('mahjong-player-profile',JSON.stringify({name:state.playerName,avatarIndex:state.avatarIndex}));renderJourney();closeSheets(false)};
$('#googleSignInBtn').onclick=()=>{const btn=$('#googleSignInBtn');btn.disabled=true;btn.innerHTML='<span class="google-spinner"></span><span>正在合并进度…</span>';setTimeout(()=>{state.cloudLinked=true;localStorage.setItem('mahjong-google-linked','true');mergeCloudProgress();btn.disabled=false;btn.innerHTML='<span class="google-g">G</span><span>使用Google账号继续</span>';hideGoogleAuth();$('#cloudSaveStatus').textContent=`同步完成 · 最高第${state.unlockedLevel}关`},1100)};
$('#googleLogoutBtn').onclick=()=>{$('#soundSheet').classList.remove('show');openSheet('logoutConfirmSheet')};$('#confirmGoogleLogoutBtn').onclick=()=>{state.cloudLinked=false;localStorage.removeItem('mahjong-google-linked');updateCloudUI();closeSheets(false)};
function syncCheckinShortcut(){const btn=$('#checkinBtn'),status=$('#checkinStatus'),signed=state.checkinHistory.includes(todayKey());btn.classList.toggle('signed',signed);const label=signed?'已签到':'未签到';if(status.textContent!==label)status.textContent=label;btn.setAttribute('aria-label',signed?'今日已签到':'每日签到')}
new MutationObserver(syncCheckinShortcut).observe($('#checkinStatus'),{childList:true,subtree:true});
loadPrefs();loadPlayerProfile();renderJourney();updateCloudUI();syncCheckinShortcut();if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));

function updateMotion(value){state.motion=value;if(!value)state.tiles.forEach(t=>t.motion=null);syncSettingToggles();savePrefs();if(state.started||state.tiles.length)render();}
['motionToggle','gameMotionToggle'].forEach(id=>$('#'+id).onchange=e=>updateMotion(e.target.checked));
