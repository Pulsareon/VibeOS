import http.server
import json
import os
import threading
import time
import queue

PORT = 8080
BASE = os.path.dirname(os.path.abspath(__file__))
CHAT_DIR = os.path.join(BASE, 'chat')
os.makedirs(CHAT_DIR, exist_ok=True)

def get_messages():
    path = os.path.join(CHAT_DIR, 'messages.jsonl')
    msgs = []
    if os.path.exists(path):
        with open(path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line:
                    msgs.append(json.loads(line))
    return msgs

def append_message(msg):
    path = os.path.join(CHAT_DIR, 'messages.jsonl')
    with open(path, 'a', encoding='utf-8') as f:
        f.write(json.dumps(msg, ensure_ascii=False) + '\n')

def get_last_reply_index():
    path = os.path.join(CHAT_DIR, 'reply_index.txt')
    if os.path.exists(path):
        return int(open(path, 'r').read().strip())
    return 0

def set_last_reply_index(i):
    path = os.path.join(CHAT_DIR, 'reply_index.txt')
    with open(path, 'w') as f:
        f.write(str(i))

class VibeHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path.startswith('/api/messages'):
            msgs = get_messages()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps(msgs, ensure_ascii=False).encode())
            return

        if self.path.startswith('/api/replies'):
            msgs = get_messages()
            replies = [m for m in msgs if m.get('from') == 'mimo']
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps(replies, ensure_ascii=False).encode())
            return

        super().do_GET()

    def do_POST(self):
        length = int(self.headers.get('Content-Length', 0))
        body = json.loads(self.rfile.read(length)) if length else {}

        if self.path == '/api/send':
            msg = {
                'from': body.get('from', 'user'),
                'text': body.get('text', ''),
                'time': time.strftime('%H:%M:%S')
            }
            append_message(msg)
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(b'{"ok":true}')
            print(f"\n[{msg['from']}]: {msg['text']}")
            return

        self.send_response(404)
        self.end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def log_message(self, format, *args):
        pass

if __name__ == '__main__':
    os.chdir(BASE)
    print(f'VibeOS Server: http://localhost:{PORT}')
    print(f'Chat logs: {CHAT_DIR}/messages.jsonl')
    print('MiMo can read/write messages via chat/messages.jsonl\n')
    http.server.HTTPServer(('0.0.0.0', PORT), VibeHandler).serve_forever()
