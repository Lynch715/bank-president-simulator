"""Local HTTP streaming fixture; deliberately delay HTML, not device APIs."""
import argparse
import time
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--port', type=int, default=8873)
parser.add_argument('--delay', type=float, default=18)
parser.add_argument('--baseline', type=Path)
args = parser.parse_args()
PROFILE = '''<script id="stream-fixture-storage">(function(){var data={};Object.defineProperty(window,'localStorage',{get:function(){return {getItem:function(k){return Object.prototype.hasOwnProperty.call(data,k)?data[k]:null;},setItem:function(k,v){data[k]=String(v);},removeItem:function(k){delete data[k];}};}});})();</script>\n'''


class Handler(SimpleHTTPRequestHandler):
    def do_GET(self):
        route = urlsplit(self.path).path
        if route not in ['/slow-main', '/slow-art', '/old-main']:
            return super().do_GET()
        if route == '/old-main':
            if not args.baseline:
                return self.send_error(404)
            html = args.baseline.read_text()
            boundary = html.index('<script>')
        else:
            html = (ROOT / 'index.html').read_text()
            boundary = html.index('<script id="bankGameCode">') if route == '/slow-main' else html.index('<script type="application/json" id="bankPortraitData">')
        prefix = html[:boundary].replace('<script id="bankBootGuard">', PROFILE + '<script id="bankBootGuard">').encode()
        suffix = html[boundary:].encode()
        self.send_response(200)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Length', str(len(prefix) + len(suffix)))
        self.end_headers()
        try:
            self.wfile.write(prefix)
            self.wfile.flush()
            print(f'{route}: critical prefix sent; holding remaining HTML for {args.delay}s', flush=True)
            time.sleep(args.delay)
            self.wfile.write(suffix)
            self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError):
            pass


print(f'Local streaming fixture at http://127.0.0.1:{args.port}; delay={args.delay}s', flush=True)
ThreadingHTTPServer(('127.0.0.1', args.port), partial(Handler, directory=str(ROOT))).serve_forever()
