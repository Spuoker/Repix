# THE ARGUMENTS CHECK: Repix's whole configuration gone through for arguments the engine does not take, or that
# cannot act where they are written (see "AN ARGUMENT THE ENGINE DOES NOT KNOW IS REFUSED" in src/ui/engine.js).
# The built page is opened in a headless Edge with ?check: the engine then stops at no refusal, gathers them all
# and leaves them in the page; they are printed here, one a line.
# Usage:  python dev/tools/check_args.py [path to repix.html]        exit 0: none; 1: refusals; 2: could not check
import json, os, subprocess, sys, tempfile, time, urllib.request, pathlib
try:
    import websocket                                       # pip install websocket-client
except ImportError:
    print('needs websocket-client (pip install websocket-client)'); sys.exit(2)

page = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else pathlib.Path(__file__).resolve().parents[2] / 'repix.html').resolve()
if not page.exists():
    print(f'no page at {page}'); sys.exit(2)
EDGE = next((p for p in (r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe',
                         r'C:\Program Files\Microsoft\Edge\Application\msedge.exe') if os.path.exists(p)), None)
if not EDGE:
    print('no Microsoft Edge found'); sys.exit(2)
PORT = 9334
prof = tempfile.mkdtemp(prefix='repix_check_')
edge = subprocess.Popen([EDGE, '--headless=new', f'--remote-debugging-port={PORT}', f'--user-data-dir={prof}',
                         '--window-size=1280,900', '--no-first-run', '--disable-extensions', 'about:blank'],
                        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
try:
    for _ in range(100):
        try: tabs = json.load(urllib.request.urlopen(f'http://127.0.0.1:{PORT}/json')); break
        except Exception: time.sleep(0.1)
    else:
        print('Edge did not answer'); sys.exit(2)
    ws = websocket.create_connection([t for t in tabs if t['type'] == 'page'][0]['webSocketDebuggerUrl'], timeout=30)
    n = [0]; errors = []
    def call(m, **pr):
        n[0] += 1; ws.send(json.dumps({'id': n[0], 'method': m, 'params': pr}))
        while True:
            r = json.loads(ws.recv())
            if r.get('id') == n[0]: return r
            if r.get('method') == 'Runtime.exceptionThrown':
                errors.append(r['params']['exceptionDetails'].get('exception', {}).get('description', '').split('\n')[0])
    call('Runtime.enable')
    call('Page.navigate', url=page.as_uri() + '?check')
    for _ in range(100):                                    # loaded, and a moment for what is built after the load
        if call('Runtime.evaluate', expression='document.readyState', returnByValue=True)['result']['result'].get('value') == 'complete': break
        time.sleep(0.1)
    time.sleep(1.5)
    got = call('Runtime.evaluate', expression='document.documentElement.dataset.refusals || "[]"', returnByValue=True)
    refusals = json.loads(got['result']['result'].get('value') or '[]')
    print(f'{page.name}: {len(refusals)} refusal{"s" if len(refusals) != 1 else ""}')
    for r in refusals: print('  - ' + r)
    other = [e for e in errors if 'engine refuses' not in e]
    if other:
        print('other errors while building (the check may be partial):')
        for e in other[:10]: print('  ! ' + e)
    sys.exit(1 if refusals else (2 if other else 0))
finally:
    edge.kill()
