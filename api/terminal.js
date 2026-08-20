const commands = ['help', 'echo', 'date', 'pwd', 'whoami', 'ls', 'clear'];

const responseJson = (response, status, body) => {
    response.status(status).setHeader('Content-Type', 'application/json');
    response.json(body);
};

module.exports = (request, response) => {
    if (request.method !== 'POST') {
        response.setHeader('Allow', 'POST');
        return responseJson(response, 405, {error: 'Only POST is supported.'});
    }

    const command = request.body && request.body.command;
    if (typeof command !== 'string' || !command.trim()) {
        return responseJson(response, 400, {error: 'A command is required.'});
    }

    const parts = command.trim().split(/\s+/);
    const name = parts[0].toLowerCase();
    const args = parts.slice(1);

    if (!commands.includes(name)) {
        return responseJson(response, 200, {
            output: `${name}: command not available on the hosted terminal`,
            exitCode: 127
        });
    }

    let output;
    switch (name) {
    case 'help':
        output = [
            'Project commands are available in the Scratch GUI:',
            '  run, greenflag  Start the Scratch project',
            '  stop             Stop all running scripts',
            '  project          Show project targets',
            '  sprites          List project sprites',
            '',
            'Hosted terminal commands:',
            '  clear            Clear terminal output',
            '  echo <text>      Print text',
            '  date             Show date and time',
            '  pwd              Show hosted project path',
            '  whoami           Show terminal user',
            '  ls               List hosted files',
            '  help             Show this command list'
        ].join('\n');
        break;
    case 'echo':
        output = args.join(' ');
        break;
    case 'date':
        output = new Date().toString();
        break;
    case 'pwd':
        output = 'nothing';
        break;
    case 'whoami':
        output = 'nothing';
        break;
    case 'ls':
        output = 'nothing';
        break;
    case 'clear':
        output = 'blank';
        break;
    default:
        output = 'blank';
    }

    return responseJson(response, 200, {
        output,
        exitCode: 0
    });
};
