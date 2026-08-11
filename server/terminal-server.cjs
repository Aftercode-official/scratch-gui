const http = require('http');
const {execFile} = require('child_process');

const HOST = '127.0.0.1';
const PORT = 8787;
const MAX_COMMAND_LENGTH = 2000;

const sendJson = (response, statusCode, payload) => {
    response.writeHead(statusCode, {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': 'http://localhost:8601',
        'Access-Control-Allow-Headers': 'Content-Type'
    });
    response.end(JSON.stringify(payload));
};

const readBody = request => new Promise((resolve, reject) => {
    let body = '';
    request.on('data', chunk => {
        body += chunk;
        if (body.length > MAX_COMMAND_LENGTH + 100) {
            reject(new Error('Command is too long.'));
            request.destroy();
        }
    });
    request.on('end', () => resolve(body));
    request.on('error', reject);
});

const server = http.createServer(async (request, response) => {
    if (request.method === 'OPTIONS') {
        response.writeHead(204, {
            'Access-Control-Allow-Origin': 'http://localhost:8601',
            'Access-Control-Allow-Headers': 'Content-Type'
        });
        response.end();
        return;
    }

    if (request.method !== 'POST' || request.url !== '/api/terminal') {
        sendJson(response, 404, {error: 'Not found'});
        return;
    }

    try {
        const {command} = JSON.parse(await readBody(request));
        if (typeof command !== 'string' || !command.trim()) {
            sendJson(response, 400, {error: 'A command is required.'});
            return;
        }
        if (command.length > MAX_COMMAND_LENGTH) {
            sendJson(response, 400, {error: 'Command is too long.'});
            return;
        }

        execFile('powershell.exe', [
            '-NoProfile',
            '-NonInteractive',
            '-Command',
            command
        ], {
            cwd: process.cwd(),
            windowsHide: true,
            maxBuffer: 1024 * 1024
        }, (error, stdout, stderr) => {
            sendJson(response, 200, {
                output: `${stdout}${stderr}`.trimEnd(),
                exitCode: error ? error.code || 1 : 0
            });
        });
    } catch (error) {
        sendJson(response, 400, {error: error.message});
    }
});

server.listen(PORT, HOST, () => {
    console.log(`Local terminal server listening at http://${HOST}:${PORT}`);
});
