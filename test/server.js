/*
 Copyright 2019 Google Inc. All Rights Reserved.
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

     https://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
*/

import http from 'node:http';
import fs from 'fs-extra';
import path from 'node:path';
import nunjucks from 'nunjucks';

const BEACON_FILE = 'test/beacons.log';

const MIME_TYPES = {
  '.js': 'text/javascript',
  '.cjs': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.map': 'application/json',
};

nunjucks.configure('./test/views/', {noCache: true});

function readBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString()));
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, Number(ms)));
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const query = Object.fromEntries(url.searchParams);

  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (query.delay) {
    await sleep(query.delay);
  }

  if (query.earlyHintsDelay) {
    res.writeEarlyHints({'link': '</styles.css>; rel=preload; as=style'});
    await sleep(query.earlyHintsDelay);
  }

  // POST /collect - analytics beacon endpoint
  if (req.method === 'POST' && url.pathname === '/collect') {
    const body = await readBody(req);
    // Uncomment to log the metric when manually testing.
    console.log(JSON.stringify(JSON.parse(body), null, 2));
    console.log('-'.repeat(80));
    fs.appendFileSync(BEACON_FILE, body + '\n');
    res.end();
    return;
  }

  // GET /test/:view - render nunjucks template
  const viewMatch = url.pathname.match(/^\/test\/([^/]+)$/);
  if (req.method === 'GET' && viewMatch) {
    const view = viewMatch[1];
    const modulePath = query.attribution
      ? '/dist/web-vitals.attribution.js'
      : '/dist/web-vitals.js';

    const data = {
      ...query,
      queryString: url.searchParams.toString(),
      modulePath,
    };

    const content = nunjucks.render(`${view}.njk`, data);
    res.setHeader('Content-Type', 'text/html');

    if (query.delayResponse) {
      res.write(content + '\n');
      setTimeout(() => {
        res.write('</body></html>');
        res.end();
      }, Number(query.delayResponse));
    } else {
      res.end(content);
    }
    return;
  }

  // Static file serving
  const filePath = '.' + url.pathname;
  const ext = path.extname(filePath);
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, {'Content-Type': contentType});
    res.end(data);
  });
});

const port = process.env.PORT || 9090;
server.listen(port, () => {
  fs.mkdirSync(path.dirname(BEACON_FILE), {recursive: true});
  fs.appendFileSync(BEACON_FILE, '');
  console.log(`Server running:\nhttp://localhost:${port}`);
});
