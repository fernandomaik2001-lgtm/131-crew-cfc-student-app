"""Offline browser smoke tests. All Supabase requests intercepted; no personal data touched."""
import json
from datetime import datetime
from zoneinfo import ZoneInfo
from urllib.parse import urlparse, parse_qs
from pathlib import Path
ROOT=Path(__file__).parent.parent
from playwright.sync_api import sync_playwright

BASE = 'https://crew131.test/'
TODAY = datetime.now(ZoneInfo('America/New_York')).strftime('%Y-%m-%d')
MOCK_USER={'id':'test-auth-001','email':'test@example.invalid'}
MOCK_MEMBER={'id':'test-member-001','auth_user_id':'test-auth-001','preferred_name':'Atleta Teste','first_name':'Teste','last_name':'Exemplo','email':'test@example.invalid','preferred_language':'Português','waiver_status':'Pending','status':'Active'}
WORKOUT={'id':'workout-001','workout_date':TODAY,'title':'WOD de teste','goal':'Movimentar com técnica','general_warmup':'Mobilidade','specific_warmup':'Técnica','strength_or_skill':'Agachamento','workout':'AMRAP 10 minutos','cool_down':'Caminhar','time_cap_minutes':10,'timer_type':'AMRAP','score_type':'Time','timer_notes':None,'scaling_notes':'Reduzir carga','video_url':None,'published':True}
CLASS={'id':'class-001','class_name':'Treino teste','delivery':'Presencial','day_of_week':'Quarta','start_time':'07:00','duration_minutes':60,'capacity':20,'coach_name':'Coach Teste','meeting_or_location':'131 CFC','active':True}

def harness(context, linked=True):
    calls=[]; results=[]
    def handler(route):
        req=route.request
        url=urlparse(req.url)
        path=url.path
        params=parse_qs(url.query)
        body=json.loads(req.post_data or '{}') if req.method in ('POST','PATCH') else {}
        calls.append((req.method,path,params,body))
        def response(data,status=200):
            route.fulfill(status=status, content_type='application/json',body=json.dumps(data))
        if path.endswith('/auth/v1/otp'): return response({})
        if path.endswith('/auth/v1/user'): return response(MOCK_USER)
        if path.endswith('/auth/v1/logout'): return response({})
        if path.endswith('/auth/v1/token'): return response({'access_token':'refreshed-token','refresh_token':'refreshed-refresh','expires_in':3600,'token_type':'bearer'})
        if path.endswith('/rest/v1/workout_results') and req.method=='POST':
            results.append(body)
            return response({},status=201)
        if path.endswith('/rest/v1/members'): return response([MOCK_MEMBER] if linked else [])
        if path.endswith('/rest/v1/daily_workouts'): return response([WORKOUT])
        if path.endswith('/rest/v1/classes'): return response([CLASS])
        if path.endswith('/rest/v1/reservations'): return response([])
        if path.endswith('/rest/v1/workout_results'): return response(results)
        if path.endswith('/rest/v1/charges'): return response([])
        if path.endswith('/rest/v1/payments'): return response([])
        raise AssertionError(f'Unexpected network request: {req.method} {req.url}')
    def static_handler(route):
        name=urlparse(route.request.url).path.lstrip('/') or 'index.html'
        path=ROOT/name
        types={'html':'text/html','js':'application/javascript','css':'text/css','svg':'image/svg+xml','webmanifest':'application/manifest+json'}
        if path.exists() and path.is_file() and path.parent==ROOT:
            route.fulfill(body=path.read_bytes(),content_type=types.get(path.suffix[1:],'application/octet-stream'))
        else:route.fulfill(status=404,body='Not found')
    context.route('https://crew131.test/**',static_handler)
    context.route('https://aohfzxgchbuqqgeshopf.supabase.co/**',handler)
    return calls,results

def run():
  with sync_playwright() as p:
    browser=p.chromium.launch(headless=True, executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    context=browser.new_context(viewport={'width':390,'height':844},timezone_id='America/New_York')
    calls,results=harness(context)
    page=context.new_page()
    errors=[]
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(BASE)
    page.locator('input[name=email]').fill('test@example.invalid')
    page.locator('#loginForm button').click()
    page.get_by_text('Se este e-mail está habilitado').wait_for()
    assert any(path.endswith('/auth/v1/otp') and body.get('create_user') is False for _,path,_,body in calls), 'Magic Link must not auto-create accounts'
    page.goto(BASE+'#access_token=test-token&refresh_token=test-refresh&expires_in=3600&token_type=bearer')
    page.get_by_text('Olá, Atleta Teste!').wait_for()
    assert page.get_by_text('WOD de teste').count()>=1
    assert page.get_by_text('Assinar waiver').count()==1
    assert page.get_by_text('Nenhuma aula programada para hoje.').count()==1
    page.get_by_role('button',name='Ver treino completo').click()
    assert page.get_by_text('AMRAP 10 minutos').count()>=1
    page.locator('input[name=time]').fill('12:34')
    page.locator('input[name=rpe]').fill('7')
    page.locator('textarea[name=notes]').fill('Treino concluído')
    page.get_by_role('button',name='Salvar resultado').click()
    page.get_by_text('Resultado salvo com sucesso.').wait_for()
    assert len(results)==1
    assert results[0]['time_seconds']==754
    assert results[0]['rpe']==7
    assert results[0]['member_id']=='test-member-001'
    assert results[0]['workout_id']=='workout-001'
    assert 'daily_workout_id' not in results[0]
    page.locator('[data-tab=classes]').click()
    assert page.get_by_text('Treino teste').count()>0
    page.locator('[data-tab=profile]').click()
    assert page.get_by_text('12:34').count()>0
    page.locator('#logout').click()
    page.locator('#loginForm').wait_for()
    assert page.evaluate("localStorage.getItem('crew131_session_v1')") is None
    assert not errors,errors
    print('PASS: login, magic link, linked member, home, waiver, workout, score insert, classes, profile, logout, mobile')
    context.close()

    unlinked=browser.new_context(viewport={'width':1280,'height':900})
    harness(unlinked,linked=False)
    q=unlinked.new_page()
    q.goto(BASE+'#access_token=test-token&refresh_token=test-refresh&expires_in=3600&token_type=bearer')
    q.get_by_text('Cadastro ainda não vinculado').wait_for()
    assert q.locator('[data-tab]').count()==0
    q.locator('#logout').click()
    q.locator('#loginForm').wait_for()
    unlinked.close()
    print('PASS: unlinked account safely denied member functionality')

    expired=browser.new_context(viewport={'width':390,'height':844})
    ex_calls,_=harness(expired)
    ex=expired.new_page()
    ex.goto(BASE)
    ex.evaluate("localStorage.setItem('crew131_session_v1',JSON.stringify({access_token:'expired',refresh_token:'refresh-valid',expires_at:123}))")
    ex.reload()
    ex.get_by_text('Olá, Atleta Teste!').wait_for()
    assert any(path.endswith('/auth/v1/token') for _,path,_,_ in ex_calls)
    saved=ex.evaluate("JSON.parse(localStorage.getItem('crew131_session_v1'))")
    assert saved['expires_at'] > 123
    expired.close()
    print('PASS: expired session refresh and persisted expiry')
    browser.close()

if __name__=='__main__': run()