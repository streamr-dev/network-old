#!/usr/bin/env python3
# encoding: utf-8
from http.server import HTTPServer, SimpleHTTPRequestHandler

class CORSRequestHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        return super(CORSRequestHandler, self).end_headers()


httpd = HTTPServer(('localhost', 8003), CORSRequestHandler)
httpd.serve_forever()
