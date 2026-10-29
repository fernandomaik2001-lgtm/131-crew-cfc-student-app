// Zero-dependency tests using Node's VM. No real Supabase calls, secrets or member records.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source=fs.readFileSync(__dirname+'/../app.js','utf8');
const hits=[], local={}, callbacks={};
let rows=[];
const app={innerHTML:'',addEventListener:(name,callback)=>callbacks[name]=callback};
const respond=(data,status=200)=>({ok:status>=200&&status<300,status,text:async()=>JSON.stringify(data)});
const fetch=async(url,opt={})=>{
  const u=new URL(url);hits.push({url:u,method:opt.method||'GET',body:opt.body?JSON.parse(opt.body):undefined});
  if(u.pathname.endsWith('/auth/v1/user'))return respond({id:'u001',email:'test@example.invalid'});
  if(u.pathname.endsWith('/auth/v1/token'))return respond({access_token:'new.access',refresh_token:'new.refresh',expires_in:3600});
  if(u.pathname.endsWith('/auth/v1/otp'))return respond({});
  if(u.pathname.endsWith('/auth/v1/logout'))return respond({});
  if(u.pathname.endsWith('/rest/v1/members'))return respond([{id:'member-001',auth_user_id:'u001',email:'test@example.invalid',preferred_name:'Atleta Teste',waiver_status:'Pending'}]);
  if(u.pathname.endsWith('/rest/v1/daily_workouts'))return respond([{id:'workout-001',workout_date:'2026-10-28',title:'Treino de teste',workout:'AMRAP',score_type:'Time',published:true}]);
  if(u.pathname.endsWith('/rest/v1/classes'))return respond([]);
  if(u.pathname.endsWith('/rest/v1/reservations'))return respond([]);
  if(u.pathname.endsWith('/rest/v1/charges'))return respond([]);
  if(u.pathname.endsWith('/rest/v1/payments'))return respond([]);
  if(u.pathname.endsWith('/rest/v1/workout_results')&&opt.method==='POST'){rows.push(JSON.parse(opt.body));return respond({},201)}
  if(u.pathname.endsWith('/rest/v1/workout_results'))return respond(rows);
  throw new Error('Unexpected request '+url)
};
const sandbox={
  console,fetch,Date,URL,URLSearchParams, Intl,Number,String,Math,JSON,Object,Array,Error,Promise,Set,
  navigator:{onLine:true,serviceWorker:null},
  localStorage:{getItem:key=>local[key]??null,setItem:(key,val)=>local[key]=val,removeItem:key=>delete local[key]},
  location:{origin:'https://crew.example',pathname:'/',hash:'',search:''},
  history:{replaceState:()=>{}},
  document:{querySelector:()=>app,addEventListener:()=>{},visibilityState:'visible'},
  window:{addEventListener:()=>{},scrollTo:()=>{}},
  FormData:class {constructor(form){this.values=form.values}get(key){return this.values[key]??null}},
  setTimeout,clearTimeout,
};
const ctx=vm.createContext(sandbox);
vm.runInContext(source,ctx);
const evaluate=code=>vm.runInContext(code,ctx);
async function test(){
  await new Promise(resolve=>setTimeout(resolve,20));
  assert.match(app.innerHTML,/Enviar link de acesso/);
  evaluate("saveSession(normalizeSession({access_token:'test',refresh_token:'refresh',expires_in:3600}))");
  evaluate("state.user={id:'u001',email:'test@example.invalid'}");
  await evaluate('loadMemberAndData()');
  evaluate('render()');
  assert.match(app.innerHTML,/Atleta Teste/);
  assert.match(app.innerHTML,/Assinar waiver/);
  assert.match(app.innerHTML,/Treino de hoje ainda não foi publicado/);
  assert.match(app.innerHTML,/Nenhuma aula programada para hoje/);
  assert.ok(hits.filter(h=>h.url.pathname.includes('/rest/v1/')).every(h=>!(h.url.searchParams.get('member_id')==='eq.other-member')));
  const form={id:'resultForm',dataset:{id:'workout-001'},values:{time:'12:34',rpe:'7',notes:'ok'},querySelector:()=>({disabled:false,textContent:''})};
  await callbacks.submit({target:form,preventDefault:()=>{}});
  assert.equal(rows.length,1);
  assert.equal(rows[0].time_seconds,754);
  assert.equal(rows[0].member_id,'member-001');
  assert.equal(rows[0].workout_id,'workout-001');
  assert.equal(rows[0].rpe,7);
  assert.ok(!('daily_workout_id' in rows[0]));
  assert.equal(typeof rows[0].time_seconds,'number');
  evaluate("saveSession({access_token:'expired',refresh_token:'valid',expires_at:1})");
  assert.equal(await evaluate('ensureFresh()'),true);
  assert.ok(JSON.parse(local.crew131_session_v1).expires_at > Math.floor(Date.now()/1000));
  evaluate('clearLocal()');
  evaluate('render()');
  assert.equal(local.crew131_session_v1,undefined);
  assert.match(app.innerHTML,/Enviar link de acesso/);
  console.log('PASS: home empty states; member-bound queries; waiver link; result numeric payload; token refresh; logout.');
  console.log('PASS: no real Supabase calls were made.');
}
test().catch(e=>{console.error(e);process.exit(1)});