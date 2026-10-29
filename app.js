/** 131 Crew CFC — independent, framework-free student client. No privileged keys. */
const CONFIG = Object.freeze({
  api: 'https://aohfzxgchbuqqgeshopf.supabase.co',
  key: 'sb_publishable_ZQFvTdbgOkIFoFVh2Tp-ng_wti1s2J5',
  waiver: 'https://form.jotform.com/262244759522057',
  storage: 'crew131_session_v1',
});
const app = document.querySelector('#app');
let requestEpoch = 0;
const state = { session: null, user: null, member: null, tab: 'home', detail: null, pending: false, message: '', errors: {}, data: { workouts: [], classes: [], reservations: [], results: [], charges: [], payments: [] }};
const icon = {
  home:'<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z"/>',
  workout:'<path d="M3 9v6m3-9v12m3-9v6m6-6v6m3-9v12m3-9v6M6 12h12"/>',
  classes:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18"/>',
  profile:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
};
const svg = (name) => `<svg viewBox="0 0 24 24" aria-hidden="true">${icon[name]}</svg>`;
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const str = value => value == null || value === '' ? '—' : esc(value);
const trim = value => String(value || '').trim();
const dateLocal = () => { const d = new Date(); return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-'); };
const localISO = d => [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
function currentWeekWorkouts(workouts){
  const today = new Date(); today.setHours(12,0,0,0);
  const monday = new Date(today); monday.setDate(today.getDate() - ((today.getDay()+6)%7));
  const sunday = new Date(monday); sunday.setDate(monday.getDate()+6);
  const start=localISO(monday),end=localISO(sunday);
  return workouts.filter(w=>w.workout_date>=start && w.workout_date<=end);
}
const dateFmt = value => {if(!value) return '—'; const d=new Date(String(value).slice(0,10)+'T12:00:00'); return Number.isNaN(d.getTime())?'—':new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'short',year:'numeric'}).format(d)};
const timeFmt = value => value ? esc(String(value).slice(0,5)) : '—';
const weekdayFmt = value => ({Monday:'Segunda-feira',Tuesday:'Terça-feira',Wednesday:'Quarta-feira',Thursday:'Quinta-feira',Friday:'Sexta-feira',Saturday:'Sábado',Sunday:'Domingo'})[String(value)] || str(value);
const scoreFmt = r => {if(!r)return '—';if(r.time_seconds!=null){const s=Number(r.time_seconds);return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`}if(r.rounds!=null)return `${esc(r.rounds)} rounds${r.reps!=null?` + ${esc(r.reps)} reps`:''}`;for(const key of ['reps','load','distance','calories'])if(r[key]!=null)return `${esc(r[key])} ${key==='load'?'kg':key==='distance'?'m':key==='calories'?'cal':'reps'}`;return 'Registrado'};
function getSaved(){try{return JSON.parse(localStorage.getItem(CONFIG.storage)||'null')}catch{return null}}
function saveSession(session){state.session=session;if(session)localStorage.setItem(CONFIG.storage,JSON.stringify(session));else localStorage.removeItem(CONFIG.storage)}
function clearLocal(){requestEpoch++;saveSession(null);state.user=null;state.member=null;state.detail=null;state.tab='home';state.errors={};state.data={workouts:[],classes:[],reservations:[],results:[],charges:[],payments:[]}}
function errorMsg(e){if(!navigator.onLine)return 'Sem conexão com a internet. Verifique sua rede e tente novamente.'; if(e?.status===401)return 'Sua sessão expirou. Entre novamente.';if(e?.status===403)return 'Sem permissão para essa operação. Fale com a equipe 131 Crew.';return 'Não foi possível completar esta operação agora. Tente novamente.'}
async function api(path,{method='GET',body,auth=true,prefer}={}){
  const headers={'apikey':CONFIG.key,'Accept':'application/json'};
  if(body!==undefined)headers['Content-Type']='application/json';
  if(prefer)headers.Prefer=prefer;
  if(auth && state.session?.access_token)headers.Authorization=`Bearer ${state.session.access_token}`;
  const res=await fetch(`${CONFIG.api}${path}`,{method,headers,body:body===undefined?undefined:JSON.stringify(body),cache:'no-store'});
  const data=await res.text(); let parsed; try{parsed=data?JSON.parse(data):null}catch{parsed=null}
  if(!res.ok){const error=new Error(parsed?.msg||parsed?.message||`HTTP ${res.status}`);error.status=res.status;error.details=parsed;throw error}
  return parsed;
}
async function refresh(){
  if(!state.session?.refresh_token)throw new Error('Missing refresh token');
  const s=await api('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:state.session.refresh_token},auth:false});
  if(!s.access_token)throw new Error('Invalid refresh');saveSession(normalizeSession(s));
}
async function ensureFresh(){
  if(!state.session)return false;
  const exp=Number(state.session.expires_at || 0);
  if(exp && exp*1000 > Date.now()+60000)return true;
  if(!exp && Number(state.session.expires_in)>0 && Number(state.session.saved_at||0)+Number(state.session.expires_in)*1000>Date.now()+60000)return true;
  try{await refresh();return true}catch(error){if([400,401,403].includes(error?.status))clearLocal();else console.warn('131 Crew session refresh unavailable:',error);return false}
}
function normalizeSession(s){return {...s,expires_at:s.expires_at??Math.floor(Date.now()/1000)+Number(s.expires_in||3600),saved_at:Date.now()}}
async function processAuthCallback(){
  const hash=new URLSearchParams(location.hash.replace(/^#/,''));const query=new URLSearchParams(location.search);
  const access=hash.get('access_token');
  if(hash.has('error')||query.has('error')){state.message='O link de acesso não pôde ser validado. Solicite um novo link.';history.replaceState({},'',location.pathname);return}
  if(access){saveSession(normalizeSession({access_token:access,refresh_token:hash.get('refresh_token'),expires_in:Number(hash.get('expires_in')||3600),token_type:hash.get('token_type')||'bearer'}));history.replaceState({},'',location.pathname);return}
  const tokenHash=query.get('token_hash');
  if(tokenHash){
    try{const result=await api('/auth/v1/verify',{method:'POST',body:{token_hash:tokenHash,type:query.get('type')||'email'},auth:false});if(result.access_token)saveSession(normalizeSession(result));else throw new Error('Not authenticated')}
    catch{state.message='Link inválido ou expirado. Solicite um novo.'}finally{history.replaceState({},'',location.pathname)}
  }
  if(query.get('code') && !state.session){state.message='O login usou PKCE, que requer configuração adicional de autenticação. Não foi possível iniciar a sessão.';history.replaceState({},'',location.pathname)}
}
async function boot(){
  await processAuthCallback();if(!state.session)saveSession(getSaved());
  if(state.session && await ensureFresh()){
    try{state.user=await api('/auth/v1/user');await loadMemberAndData()}catch(e){if(e.status===401){clearLocal()}else{state.errors.boot=true;console.error('131 Crew auth initialization:',e)}}
  }
  render();
  if('serviceWorker' in navigator && location.protocol==='https:')navigator.serviceWorker.register('./sw.js').catch(()=>{});
}
function db(table,params){return api(`/rest/v1/${table}?${new URLSearchParams(params)}`)}
async function loadMemberAndData(){
  const epoch=requestEpoch;
  if(!await ensureFresh())throw Object.assign(new Error('Session expired'),{status:401});
  const user=state.user;if(!user)return;
  let members=await db('members',{select:'id,auth_user_id,preferred_name,first_name,last_name,email,preferred_language,waiver_status,status',auth_user_id:`eq.${user.id}`,limit:'1'});
  if(!members?.length && user.email)members=await db('members',{select:'id,auth_user_id,preferred_name,first_name,last_name,email,preferred_language,waiver_status,status',email:`eq.${user.email}`,limit:'1'});
  if(epoch!==requestEpoch)return;
  state.member=members?.[0]||null;
  if(!state.member)return;
  const m=state.member.id;
  const requests={
    workouts:db('daily_workouts',{select:'id,workout_date,title,goal,general_warmup,specific_warmup,strength_or_skill,workout,cool_down,time_cap_minutes,timer_type,score_type,timer_notes,scaling_notes,video_url,published',published:'eq.true',order:'workout_date.desc',limit:'50'}),
    classes:db('classes',{select:'id,class_name,delivery,day_of_week,start_time,duration_minutes,capacity,coach_name,meeting_or_location,active',active:'eq.true',order:'start_time.asc',limit:'100'}),
    reservations:db('reservations',{select:'id,member_id,class_id,class_date,booked_at,status,waitlist_position,checked_in_at,notes',member_id:`eq.${m}`,order:'class_date.desc',limit:'100'}),
    results:db('workout_results',{select:'id,workout_id,member_id,completed_at,score_type,time_seconds,rounds,reps,load,distance,calories,rpe,pain_during,notes',member_id:`eq.${m}`,order:'completed_at.desc',limit:'100'}),
    charges:db('charges',{select:'id,member_id,charge_type,description,due_date,currency,amount,status',member_id:`eq.${m}`,order:'due_date.desc',limit:'100'}),
    payments:db('payments',{select:'id,member_id,charge_id,paid_at,currency,amount,method,status',member_id:`eq.${m}`,order:'paid_at.desc',limit:'100'}),
  };
  await Promise.all(Object.entries(requests).map(async([name,promise])=>{try{const rows=await promise;if(epoch!==requestEpoch)return;state.data[name]=rows||[];delete state.errors[name]}catch(e){if(epoch!==requestEpoch)return;state.data[name]=[];state.errors[name]=true;console.error(`131 Crew ${name} fetch:`,e)}}));
}
const name=()=>state.member?.preferred_name||state.member?.first_name||state.user?.email?.split('@')[0]||'Atleta';
const safeLink=(value)=>{try{const url=new URL(value);return url.protocol==='https:'?esc(url.href):null}catch{return null}};
function renderLogin(){
  app.innerHTML=`<main class="loginpage"><div class="mark">131</div><div class="eyebrow">Community Fitness Crew</div><h1>Seu treino.<br>Sua comunidade.</h1><p class="muted">Treinar é só um detalhe. Entre com seu e-mail para acessar sua área de aluno.</p><div class="card"><form id="loginForm" class="stack"><label class="field">E-mail<input type="email" name="email" autocomplete="email" placeholder="seuemail@exemplo.com" required maxlength="254"/></label><button class="action block" type="submit" ${state.pending?'disabled':''}>${state.pending?'Enviando...':'Enviar link de acesso'}</button></form>${state.message?`<div class="notice" role="status">${esc(state.message)}</div>`:''}</div><div class="footer">131 CREW CFC · Community Fitness Crew</div></main>`;
}
function nav(){const labels={home:'Início',workout:'Treino',classes:'Aulas',profile:'Perfil'};return `<nav class="tabs" aria-label="Navegação principal">${Object.entries(labels).map(([key,label])=>`<button data-tab="${key}" aria-current="${state.tab===key?'page':'false'}" aria-label="${label}">${svg(key)}${label}</button>`).join('')}</nav>`}
function card(title,body,chip=''){return `<section class="card"><div class="cardhead"><h2>${title}</h2>${chip?`<span class="chip">${chip}</span>`:''}</div>${body}</section>`}
function renderHome(){
  const today=dateLocal();const wod=state.data.workouts.find(w=>w.workout_date===today);
  const todayRes=state.data.reservations.filter(r=>r.class_date===today && !['Cancelled','Canceled','Cancelado'].includes(r.status));
  const upcoming=todayRes.map(r=>{const c=state.data.classes.find(c=>c.id===r.class_id);return `<div class="kv"><span>${esc(c?.class_name||'Aula reservada')}</span><strong>${timeFmt(c?.start_time)} · ${str(r.status)}</strong></div>`}).join('');
  const waiverDone=String(state.member.waiver_status||'').toLowerCase()==='complete';
  const pending=state.data.charges.filter(c=>['open','overdue'].includes(String(c.status||'').toLowerCase()));
  return `<div class="eyebrow">${esc(new Intl.DateTimeFormat('pt-BR',{weekday:'long',day:'numeric',month:'long'}).format(new Date()))}</div><h1>Olá, ${esc(name())}!</h1><section class="card hero"><div class="eyebrow" style="color:#f3d9ff">131 CREW CFC</div><h2 style="font-size:1.65rem">Treinar é só um detalhe.</h2><p class="muted">Sua evolução é construída um dia de cada vez.</p></section>
   ${card('Treino de hoje',state.errors.workouts?`<div class="empty">Treinos indisponíveis agora. Tente atualizar.</div>`:wod?`<h3>${esc(wod.title||'Treino do dia')}</h3><p class="muted">${str(wod.goal)}</p><button class="action" data-workout="${esc(wod.id)}">Ver treino completo</button>`:`<div class="empty">Treino de hoje ainda não foi publicado. Assim que o coach publicar, ele aparecerá aqui.</div>`,'WOD')}
   ${card('Aula de hoje',state.errors.reservations||state.errors.classes?'<div class="empty">Não foi possível consultar suas aulas agora.</div>':upcoming||'<div class="empty">Nenhuma aula programada para hoje.</div>')}
   ${card('Waiver',waiverDone?'<div class="inline"><span class="chip green">✓ Concluído</span><span class="muted small">Seu waiver consta como completo.</span></div>':`<p class="muted">Sua assinatura ainda não consta como concluída.</p><a class="action" target="_blank" rel="noopener noreferrer" href="${CONFIG.waiver}">Assinar waiver</a><p class="small muted">O status só muda quando a assinatura for confirmada pelo sistema.</p>`)}
   ${pending.length?card('Financeiro',pending.map(c=>`<div class="kv"><span>${str(c.description||c.charge_type||'Cobrança')}</span><strong>${esc(c.currency||'BRL')} ${Number(c.amount||0).toLocaleString('pt-BR',{minimumFractionDigits:2})} · ${str(c.status)}</strong></div>`).join('')):''}`;
}
function renderWorkouts(){
  const weekWorkouts=currentWeekWorkouts(state.data.workouts);
  if(state.detail){const w=weekWorkouts.find(x=>String(x.id)===String(state.detail));if(w)return renderWorkout(w);state.detail=null}
  return `<div class="eyebrow">Sua evolução</div><h1>Treinos</h1><p class="muted">Treinos publicados para esta semana.</p>${state.errors.workouts?'<div class="alert">Não foi possível consultar os treinos agora.</div>':weekWorkouts.length?weekWorkouts.map(w=>`<button class="listcard" data-workout="${esc(w.id)}"><div class="inline"><span class="chip">${dateFmt(w.workout_date)}</span>${w.score_type?`<span class="tag">Resultado: ${esc(w.score_type)}</span>`:''}</div><h3>${esc(w.title||'Treino')}</h3><div class="muted small">${str(w.goal)}</div></button>`).join(''):'<div class="empty">Nenhum treino publicado para esta semana.</div>'}`;
}
function renderWorkout(w){
  const blocks=[['Objetivo','goal'],['Aquecimento geral','general_warmup'],['Aquecimento específico','specific_warmup'],['Força / Técnica','strength_or_skill'],['Workout','workout'],['Cool down','cool_down'],['Escalas','scaling_notes'],['Orientações do timer','timer_notes']].filter(([,key])=>w[key]);
  const video=safeLink(w.video_url);
  const result=state.data.results.find(r=>r.workout_id===w.id);
  return `<button class="ghost" data-back="1">← Voltar aos treinos</button><div class="eyebrow">${dateFmt(w.workout_date)}</div><h1>${esc(w.title||'Treino')}</h1><div class="inline">${w.time_cap_minutes?`<span class="chip">Time cap: ${esc(w.time_cap_minutes)} min</span>`:''}${w.timer_type?`<span class="chip">${esc(w.timer_type)}</span>`:''}</div><section class="card">${blocks.map(([title,key])=>`<div class="section">${title}</div><pre>${esc(w[key])}</pre>`).join('<div class="divider"></div>')}${video?`<div class="divider"></div><a class="outline" target="_blank" rel="noopener noreferrer" href="${video}">Ver vídeo do movimento</a>`:''}</section>${result?`<div class="notice">Resultado registrado: <strong>${scoreFmt(result)}</strong></div>`:''}${w.score_type?renderResultForm(w):''}`;
}
function renderResultForm(w){
  const t=String(w.score_type||'').toLowerCase();let fields='';
  if(/time|tempo/.test(t))fields=`<label class="field wide">Tempo (mm:ss)<input name="time" inputmode="numeric" pattern="[0-9]{1,3}:[0-5][0-9]" placeholder="12:34" required></label>`;
  else if(/round/.test(t))fields=`<label class="field">Rounds<input type="number" name="rounds" min="0" step="1" required></label><label class="field">Reps extras<input type="number" name="reps" min="0" step="1" value="0" required></label>`;
  else if(/rep/.test(t))fields=`<label class="field wide">Repetições<input type="number" name="reps" min="0" step="1" required></label>`;
  else if(/load|weight|carga/.test(t))fields=`<label class="field wide">Carga (kg)<input type="number" name="load" min="0" step="0.01" required></label>`;
  else if(/distance|distância/.test(t))fields=`<label class="field wide">Distância (m)<input type="number" name="distance" min="0" step="0.01" required></label>`;
  else if(/calori/.test(t))fields=`<label class="field wide">Calorias<input type="number" name="calories" min="0" step="1" required></label>`;
  else fields=`<div class="notice wide">Tipo de resultado: ${esc(w.score_type)}. Registre observações e esforço percebido.</div>`;
  return `<section class="card"><h2>Registrar resultado</h2><form id="resultForm" data-id="${esc(w.id)}"><div class="scoregrid">${fields}<label class="field">Esforço percebido (RPE)<input name="rpe" type="number" min="0" max="10" step="1" placeholder="0–10"></label><label class="field wide">Observações<textarea name="notes" rows="3" maxlength="2000" placeholder="Como foi o treino?"></textarea></label></div><div class="spacer"></div><button class="action block" type="submit" ${state.pending?'disabled':''}>${state.pending?'Salvando...':'Salvar resultado'}</button></form>${state.message?`<div class="notice" role="status">${esc(state.message)}</div>`:''}</section>`;
}
function renderClasses(){
  const reservations=state.data.reservations.filter(r=>r.status==='Checked In');
  return `<div class="eyebrow">Comunidade</div><h1>Aulas</h1><p class="muted">Horários e modalidades disponíveis.</p>${state.errors.classes?'<div class="alert">Não foi possível carregar a agenda agora.</div>':state.data.classes.length?state.data.classes.map(c=>`<div class="card"><div class="cardhead"><h2>${str(c.class_name)}</h2><span class="chip">${timeFmt(c.start_time)}</span></div><div class="kv"><span>Dia</span><strong>${weekdayFmt(c.day_of_week)}</strong></div>${c.duration_minutes!=null?`<div class="kv"><span>Duração</span><strong>${esc(c.duration_minutes)} min</strong></div>`:''}${c.coach_name?`<div class="kv"><span>Coach</span><strong>${str(c.coach_name)}</strong></div>`:''}${c.meeting_or_location?`<div class="kv"><span>Local</span><strong>${str(c.meeting_or_location)}</strong></div>`:''}<p class="small muted">Reservas serão habilitadas após validar as regras de capacidade e disponibilidade.</p></div>`).join(''):'<div class="empty">Nenhuma aula disponível. Quando a agenda for publicada, ela aparecerá aqui.</div>'}<div class="section">Histórico de presença</div>${state.errors.reservations?'<div class="alert">Não foi possível consultar o histórico.</div>':reservations.length?reservations.map(r=>`<div class="listcard"><strong>${dateFmt(r.class_date)}</strong><p class="muted small">Check-in: ${r.checked_in_at?esc(new Date(r.checked_in_at).toLocaleString('pt-BR')):'Confirmado'}</p></div>`).join(''):'<div class="empty">Nenhum check-in registrado ainda.</div>'}`;
}
function renderProfile(){
  const member=state.member;const r=state.data.results;
  return `<div class="eyebrow">Minha conta</div><h1>Perfil</h1><div class="card"><div class="cardhead"><h2>${esc(name())}</h2><span class="chip">131 Crew</span></div><div class="kv"><span>E-mail</span><strong>${str(member?.email||state.user?.email)}</strong></div><div class="kv"><span>Idioma</span><strong>${str(member?.preferred_language)}</strong></div><div class="kv"><span>Waiver</span><strong>${String(member?.waiver_status||'').toLowerCase()==='complete'?'Concluído':'Pendente'}</strong></div></div><div class="section">Seus resultados</div>${state.errors.results?'<div class="alert">Não foi possível carregar seus resultados.</div>':r.length?r.slice(0,30).map(entry=>{const w=state.data.workouts.find(w=>w.id===entry.workout_id);return `<div class="listcard"><div class="inline"><span class="chip">${dateFmt(entry.completed_at)}</span><strong>${scoreFmt(entry)}</strong></div><h3>${esc(w?.title||'Treino realizado')}</h3></div>`}).join(''):'<div class="empty">Você ainda não registrou resultados.</div>'}<div class="spacer"></div><button id="logout" class="outline block">Sair da minha conta</button>`;
}
function renderUnavailable(){return `<div class="eyebrow">131 Crew CFC</div><h1>Conexão indisponível</h1><section class="card"><h2>Não conseguimos carregar sua conta</h2><p class="muted">O serviço pode estar temporariamente indisponível. Seus dados não foram alterados.</p><button id="retry" class="action block">Tentar novamente</button><div class="spacer"></div><button id="logout" class="outline block">Sair da minha conta</button></section>`}
function renderUnlinked(){return `<div class="eyebrow">131 Crew CFC</div><h1>Bem-vindo!</h1><section class="card"><h2>Cadastro ainda não vinculado</h2><p class="muted">Ainda não encontramos seu cadastro de aluno. Fale com o coach para vincular seu e-mail à sua matrícula.</p><p class="small muted">Conectado como ${str(state.user?.email)}.</p><button id="logout" class="outline block">Sair da minha conta</button></section>`}
function render(){
  if(!state.session||!state.user){renderLogin();return}
  app.innerHTML=`<div class="app"><header class="topbar"><div class="wrap"><div class="brand"><span class="mark">131</span><div><div>131 CREW CFC</div><div class="tag">COMMUNITY FITNESS CREW</div></div></div><span class="tag">TREINAR É SÓ UM DETALHE.</span></div></header><main class="wrap content">${state.errors.boot?renderUnavailable():!state.member?renderUnlinked():state.tab==='home'?renderHome():state.tab==='workout'?renderWorkouts():state.tab==='classes'?renderClasses():renderProfile()}</main>${state.member?nav():''}</div>`;
}
app.addEventListener('click',async ev=>{
  const tab=ev.target.closest('[data-tab]');if(tab){state.tab=tab.dataset.tab;state.detail=null;state.message='';render();window.scrollTo(0,0);return}
  const workout=ev.target.closest('[data-workout]');if(workout){state.tab='workout';state.detail=workout.dataset.workout;state.message='';render();window.scrollTo(0,0);return}
  if(ev.target.closest('[data-back]')){state.detail=null;state.message='';render();return}
  if(ev.target.closest('#retry')){
    state.errors.boot=false;
    try{if(!await ensureFresh())throw new Error('Session not available');state.user=await api('/auth/v1/user');await loadMemberAndData()}catch(e){state.errors.boot=true;console.error('131 Crew retry:',e)}
    render();return;
  }
  if(ev.target.closest('#logout')){
    const token=state.session?.access_token;clearLocal();render(); // local logout must not wait for network
    if(token)fetch(`${CONFIG.api}/auth/v1/logout`,{method:'POST',headers:{apikey:CONFIG.key,Authorization:`Bearer ${token}`}}).catch(()=>{});
  }
});
app.addEventListener('submit',async ev=>{
  if(ev.target.id==='loginForm'){
    ev.preventDefault();if(state.pending)return;
    const email=trim(new FormData(ev.target).get('email'));
    state.pending=true;state.message='';render();
    try{
      if(!email)throw new Error('Missing email');
      await api(`/auth/v1/otp?redirect_to=${encodeURIComponent(location.origin+location.pathname)}`,{method:'POST',auth:false,body:{email,create_user:false}});
      state.message='Se este e-mail está habilitado, enviaremos um link de acesso. Confira sua caixa de entrada.';
    }catch(e){console.error('131 Crew login:',e);state.message=errorMsg(e)}finally{state.pending=false;render()}
    return;
  }
  if(ev.target.id==='resultForm'){
    ev.preventDefault();if(state.pending||!state.member)return;
    const form=ev.target;const w=state.data.workouts.find(w=>String(w.id)===String(form.dataset.id));if(!w)return;
    const f=new FormData(form);const payload={member_id:state.member.id,workout_id:w.id,score_type:w.score_type,completed_at:new Date().toISOString()};
    if(f.get('notes'))payload.notes=trim(f.get('notes'));
    if(f.get('rpe')!=='')payload.rpe=Number(f.get('rpe'));
    const type=String(w.score_type||'').toLowerCase();
    const int=(key)=>{const x=Number(f.get(key));if(!Number.isInteger(x)||x<0)throw Error('Invalid numeric input');return x};
    try{
      if(/time|tempo/.test(type)){const v=trim(f.get('time'));if(!/^\d{1,3}:[0-5]\d$/.test(v))throw Error('Invalid time');const [m,s]=v.split(':').map(Number);payload.time_seconds=m*60+s}
      else if(/round/.test(type)){payload.rounds=int('rounds');payload.reps=int('reps')}
      else if(/rep/.test(type)){payload.reps=int('reps')}
      else if(/load|weight|carga/.test(type)){payload.load=Number(f.get('load'))}
      else if(/distance|distância/.test(type)){payload.distance=Number(f.get('distance'))}
      else if(/calori/.test(type)){payload.calories=int('calories')}
      for(const key of ['load','distance'])if(payload[key]!=null && (!Number.isFinite(payload[key])||payload[key]<0))throw Error('Invalid numeric input');
    }catch{state.message='Confira o formato dos dados antes de salvar.';render();return}
    state.pending=true;state.message='';const submit=form.querySelector('button[type=submit]');submit.disabled=true;submit.textContent='Salvando...';
    try{if(!await ensureFresh())throw Object.assign(Error('Expired'),{status:401});await api('/rest/v1/workout_results',{method:'POST',body:payload,prefer:'return=minimal'});await loadMemberAndData();state.message='Resultado salvo com sucesso.'}
    catch(e){console.error('131 Crew workout_result insert:',e);state.message=errorMsg(e)}finally{state.pending=false;render()}
  }
});
boot().catch(e=>{console.error('131 Crew boot error',e);clearLocal();state.message='Não foi possível iniciar sua sessão.';render()});

// Refresh stale views when the athlete returns to the app; do not poll in the background.
let lastSyncAt=Date.now();
async function resumeSync(){
  if(document.visibilityState==='hidden'||!state.session||state.pending||Date.now()-lastSyncAt<60000)return;
  lastSyncAt=Date.now();
  try{
    if(!await ensureFresh()){render();return}
    state.user=await api('/auth/v1/user');
    await loadMemberAndData();
    state.errors.boot=false;
  }catch(error){console.error('131 Crew background refresh:',error);if(error.status===401)clearLocal()}
  render();
}
document.addEventListener('visibilitychange',resumeSync);
window.addEventListener('focus',resumeSync);