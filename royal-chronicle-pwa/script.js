
const state = {
  xp: 0, crowns: 0,
  artifacts: new Set(),
  mastery: {}, // era -> 0..100
  seenCards: new Set(),
  streak: 0,
  currentEra: null,
  questions: [],
  quests: [], bosses: [], artifactsData: [], monarchCards: []
};

function loadJSON(path){ return fetch(path).then(r=>r.json()); }

async function init(){
  const [quests, bosses, artifacts, cards, bank] = await Promise.all([
    loadJSON('data/quests.json'),
    loadJSON('data/bosses.json'),
    loadJSON('data/artifacts.json'),
    loadJSON('data/monarch_cards.json'),
    loadJSON('data/question_bank.json'),
  ]);
  state.quests = quests; state.bosses = bosses; state.artifactsData = artifacts; state.monarchCards = cards; state.questions = bank;
  restore();
  renderSidebar();
  renderMap();
}

function restore(){
  try{
    const saved = JSON.parse(localStorage.getItem('rc_save')||'{}');
    Object.assign(state, saved, {artifacts: new Set(saved.artifacts||[]), seenCards: new Set(saved.seenCards||[])});
  }catch(e){}
}
function persist(){
  const sav = {...state, artifacts: Array.from(state.artifacts), seenCards: Array.from(state.seenCards)};
  localStorage.setItem('rc_save', JSON.stringify(sav));
}

function renderSidebar(){
  const sb = document.getElementById('sidebar');
  sb.innerHTML = `
    <div class="section">
      <div class="row"><span class="badge">XP ${state.xp}</span><span class="badge">Crowns ${state.crowns}</span><span class="badge">Streak ${state.streak}</span></div>
      <div class="progress"><span style="width:${overallMastery()}%"></span></div>
      <div class="small">Overall Chronicle restored: ${overallMastery().toFixed(0)}%</div>
    </div>
    <div class="section">
      <h3>Quests</h3>
      ${state.quests.map(q=>`<div class="card">
        <b>${q.title}</b><div class="small">${q.era}</div>
        <div class="small">Objectives: ${q.objectives.join(', ')}</div>
        <button class="button" onclick="startEra('${q.era}')">Go to ${q.era}</button>
      </div>`).join('')}
    </div>
    <div class="section">
      <h3>Artifacts</h3>
      ${state.artifactsData.map(a=>`<div class="small">`+(state.artifacts.has(a.id)?`🗝️ `:`🔒 `)+`${a.title}</div>`).join('')}
    </div>
  `;
}

function overallMastery(){
  const eras = ['Norman Conquest','Wars of Independence','Tudor'];
  let sum=0,count=0; eras.forEach(e=>{ sum+= (state.mastery[e]||0); count++; });
  return count? sum/count : 0;
}

function renderMap(){
  const main = document.getElementById('main');
  main.innerHTML = `
    <div class="card tall center">
      <img src="images/map.svg" alt="Map" style="max-width:100%;height:auto"/>
      <div class="row center" style="justify-content:center;margin-top:12px;">
        <button class="button" onclick="startEra('Norman Conquest')">Enter Norman Conquest</button>
        <button class="button" onclick="startEra('Wars of Independence')">Enter Wars of Independence</button>
        <button class="button" onclick="startEra('Tudor')">Enter Tudor</button>
      </div>
    </div>
    <div class="grid">
      ${state.monarchCards.map(c=>`<div class="card"><b>${c.name}</b><div class="small">${c.era} • House ${c.house} • Reign ${c.reign}</div><hr/><div class="small">Claim: ${c.claim}</div><div class="small">Events: ${c.events.join('; ')}</div><button class="button" onclick="markSeen('${c.id}')">Study</button></div>`).join('')}
    </div>
  `;
}

function markSeen(id){
  state.seenCards.add(id);
  state.xp += 5;
  state.streak += 1;
  persist(); renderSidebar();
}

function startEra(era){
  state.currentEra = era;
  const pool = state.questions.filter(q=>q.era===era);
  const sample = shuffle(pool).slice(0,5);
  renderEncounter(era, sample);
}

function renderEncounter(era, questions){
  const main = document.getElementById('main');
  main.innerHTML = `
    <div class="card"><b>${era} – Encounter</b><div class="small">Answer the questions to earn XP and Crowns.</div></div>
    <div id="quizArea"></div>
    <div class="row"><button class="button" onclick="submitQuiz()">Submit</button><button class="button" onclick="renderMap()">Back</button></div>
  `;
  const qa = document.getElementById('quizArea');
  qa.innerHTML = questions.map((q,i)=>renderQuestion(q,i)).join('');
  state.__currentQuiz = questions;
}

function renderQuestion(q,i){
  if(q.type==='mcq'){
    return `<div class="card">
      <div><b>Q${i+1}.</b> ${q.stem}</div>
      ${q.options.map(opt=>`<label class="row"><input type="radio" name="q${i}" value="${escapeHtml(opt)}"> ${opt}</label>`).join('')}
    </div>`;
  } else if(q.type==='ordering'){
    return `<div class="card">
      <div><b>Q${i+1}.</b> ${q.stem}</div>
      <div class="small">Enter a comma-separated order:</div>
      <div class="small">${q.options.join(' • ')}</div>
      <input type="text" name="q${i}" placeholder="e.g. ${q.options.join(', ')}">
    </div>`;
  } else if(q.type==='short'){
    return `<div class="card">
      <div><b>Q${i+1}.</b> ${q.stem}</div>
      <input type="text" name="q${i}" placeholder="Your answer">
    </div>`;
  }
  return '';
}

function submitQuiz(){
  const qs = state.__currentQuiz||[];
  let correct=0;
  qs.forEach((q,i)=>{
    const val = getAnswer(`q${i}`);
    if(q.type==='mcq'){
      if(val===q.answer) correct++;
    } else if(q.type==='ordering'){
      const norm = (val||'').split(',').map(s=>s.trim()).filter(Boolean);
      const ans = q.answer;
      if(JSON.stringify(norm)===JSON.stringify(ans)) correct++;
    } else if(q.type==='short'){
      const a = (val||'').trim().toLowerCase();
      const b = (q.answer||'').trim().toLowerCase();
      if(a && b && a===b) correct++;
    }
  });
  const score = Math.round((correct/qs.length)*100);
  const era = state.currentEra;
  // rewards
  const xpGain = Math.max(10, score);
  const crownsGain = Math.floor(score/10);
  state.xp += xpGain;
  state.crowns += crownsGain;
  state.mastery[era] = Math.max(state.mastery[era]||0, score);
  // chance to unlock an artifact from the era's quest
  const q = state.quests.find(x=>x.era===era);
  if(q && score>=70){ state.artifacts.add(q.rewards.artifact_id); }
  persist();
  renderResults(score, correct, qs.length);
  renderSidebar();
}

function renderResults(score, correct, total){
  const main = document.getElementById('main');
  main.insertAdjacentHTML('afterbegin', `<div class="card"><b>Results:</b> ${correct}/${total} correct — Score ${score}. You gained XP and Crowns.</div>`);
}

function getAnswer(name){
  const radios = document.querySelectorAll(`input[name="${name}"]`);
  for(const r of radios){ if(r.checked) return r.value; }
  const input = document.querySelector(`input[name="${name}"]`);
  return input ? input.value : '';
}

function shuffle(a){
  return a.map(x=>[Math.random(),x]).sort((a,b)=>a[0]-b[0]).map(x=>x[1]);
}

function escapeHtml(s){ return (s||'').replace(/[&<>"']/g, m=>({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;" }[m])); }

window.addEventListener('load', init);
