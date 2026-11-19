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


class ReusableThreadingHTTPServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    # 允许端口被 TIME_WAIT 状态快速复用；多线程处理请求避免单个慢请求阻塞其他设备
    daemon_threads = True
    allow_reuse_address = True


def main():
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    try:
        httpd = ReusableThreadingHTTPServer(("", PORT), Handler)
    except OSError as exc:
        print(f"❌ 无法启动服务：端口 {PORT} 不可用（可能被其他程序占用）。")
        print(f"   原始错误：{exc}")
        sys.exit(1)

    url = f"http://localhost:{PORT}"
    print("🐾 CyberMeow 赛博猫咪游乐场服务已就绪！")
    print(f"👉 本地访问地址: {url}")
    print("💡 同一局域网下的设备可访问本机 IP 的该端口。")
    print("💡 按 Ctrl+C 可停止服务。\n")

    with httpd:
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
