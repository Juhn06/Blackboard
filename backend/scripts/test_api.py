import json
import urllib.request

BASE = 'http://localhost:8000'
login_data = {'email':'admin@gmail.com','password':'123456'}
req = urllib.request.Request(BASE + '/auth/login', data=json.dumps(login_data).encode('utf-8'), headers={'Content-Type':'application/json'})
try:
    with urllib.request.urlopen(req) as resp:
        body = resp.read().decode('utf-8')
        print('Login response:', body)
        data = json.loads(body)
        token = data.get('token') or data.get('access_token')
        print('Token:', token)
except Exception as e:
    print('Login error:', e)
    import traceback; traceback.print_exc()
    raise

# Try to get boards for workspace 1
if token:
    req2 = urllib.request.Request(BASE + '/boards/workspace/1', headers={'Authorization': f'Bearer {token}'})
    with urllib.request.urlopen(req2) as resp:
        body = resp.read().decode('utf-8')
        print('Boards response:', body)

