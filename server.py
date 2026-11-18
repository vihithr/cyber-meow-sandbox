#!/usr/bin/env python3
"""
CyberMeow 本地极速开发与局域网服务
提供一键启动本地 HTTP 服务，支持手机/平板通过局域网扫码或访问
"""
import http.server
import socketserver
import webbrowser
import os
import sys

PORT = 8088

class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # 增加缓存控制避免调试缓存问题
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        super().end_headers()

def main():
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        url = f"http://localhost:{PORT}"
        print(f"🐾 CyberMeow 赛博猫咪游乐场服务已就绪！")
        print(f"👉 本地访问地址: {url}")
        print(f"💡 按 Ctrl+C 可停止服务。\n")
        try:
            webbrowser.open(url)
        except Exception:
            pass
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n服务已平稳停止。喵~ 🐾")

if __name__ == '__main__':
    main()
