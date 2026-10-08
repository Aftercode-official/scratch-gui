const fs = require('fs');
const path = require('path');
const {spawnSync} = require('child_process');

const localScratchBlocksEntry = path.resolve(__dirname, '..', 'Aftercode-blocks', 'dist', 'blocks.js');
if (fs.existsSync(localScratchBlocksEntry)) {
    console.log('Using locally built Aftercode Blocks bundles.');
    process.exit(0);
}

const scratchBlocksPath = path.resolve(__dirname, '..', 'node_modules', 'scratch-blocks');
const requiredFiles = [
    'build.js',
    'shim/index.js',
    'core/blockly.js',
    'blocks/assets.js'
];
const hasScratchBlocksSource = requiredFiles.every(file => (
    fs.existsSync(path.join(scratchBlocksPath, file))
));
const bundles = [
    'blockly_compressed.js',
    'blocks_compressed.js',
    path.join('dist', 'blocks.js')
];
const hasBundles = bundles.every(file => fs.existsSync(path.join(scratchBlocksPath, file)));

if (!hasScratchBlocksSource) {
    if (hasBundles) {
        console.log('Installed Scratch Blocks package already includes its distributable bundles.');
        process.exit(0);
    }
    throw new Error('Installed Scratch Blocks package is missing its source and required bundles.');
}

const packageNodeModules = path.join(scratchBlocksPath, 'node_modules');
const closureLibraryLink = path.join(packageNodeModules, 'google-closure-library');
const closureLibrarySource = path.resolve(__dirname, '..', 'node_modules', 'google-closure-library');
const webpackConfig = path.join(scratchBlocksPath, `.aftercode-webpack-${process.pid}.config.js`);

if (hasBundles) {
    process.exit(0);
}

if (!fs.existsSync(closureLibrarySource)) {
    throw new Error('google-closure-library is required to build the installed Scratch Blocks package.');
}

let createdClosureLibraryLink = false;

if (!fs.existsSync(closureLibraryLink)) {
    fs.mkdirSync(packageNodeModules, {recursive: true});
    if (process.platform === 'win32') {
        fs.cpSync(closureLibrarySource, closureLibraryLink, {recursive: true});
    } else {
        fs.symlinkSync(closureLibrarySource, closureLibraryLink, 'dir');
    }
    createdClosureLibraryLink = true;
}

try {
    const result = spawnSync(
        process.execPath,
        ['build.js'],
        {
            cwd: scratchBlocksPath,
            stdio: 'inherit'
        }
    );

    if (result.error) {
        throw result.error;
    }
    if (result.status !== 0) {
        throw new Error(`Scratch Blocks bundle generation failed with exit code ${result.status}.`);
    }

    fs.writeFileSync(webpackConfig, [
        "const path = require('path');",
        "const UglifyJsPlugin = require('uglifyjs-webpack-plugin');",
        'module.exports = {',
        "    mode: 'production',",
        "    entry: {blocks: './shim/index.js'},",
        '    output: {',
        "        library: 'ScratchBlocks',",
        "        libraryTarget: 'commonjs2',",
        "        path: path.resolve(__dirname, 'dist'),",
        "        filename: '[name].js'",
        '    },',
        '    optimization: {',
        '        minimizer: [new UglifyJsPlugin({uglifyOptions: {mangle: false}})]',
        '    },',
        '    performance: {hints: false}',
        '};',
        ''
    ].join('\n'));

    const webpack = require.resolve('webpack-cli/bin/cli.js');
    const webpackResult = spawnSync(
        process.execPath,
        [webpack, '--config', webpackConfig],
        {
            cwd: scratchBlocksPath,
            stdio: 'inherit'
        }
    );

    if (webpackResult.error) {
        throw webpackResult.error;
    }
    if (webpackResult.status !== 0) {
        throw new Error(`Scratch Blocks webpack build failed with exit code ${webpackResult.status}.`);
    }

    if (!bundles.every(file => fs.existsSync(path.join(scratchBlocksPath, file)))) {
        throw new Error('Scratch Blocks build completed without generating all required bundles.');
    }
} finally {
    if (fs.existsSync(webpackConfig)) {
        fs.unlinkSync(webpackConfig);
    }
    if (createdClosureLibraryLink) {
        if (process.platform === 'win32') {
            fs.rmSync(closureLibraryLink, {recursive: true, force: true});
        } else {
            fs.unlinkSync(closureLibraryLink);
        }
    }
}
