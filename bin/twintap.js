#!/usr/bin/env node

var messages = require('../lib/messages')

// Prevent external PRs of twintap users to fail browser tests
if (process.env.TRAVIS_SECURE_ENV_VARS === 'false') {
  console.log(messages.SKIPPING_AIRTAP)
  process.exit(0)
}

var path = require('path')
var fs = require('fs')

var chalk = require('chalk')
var program = require('commander')
var yaml = require('yamljs')
var os = require('os')
var findNearestFile = require('find-nearest-file')
var sauceBrowsers = require('sauce-browsers/callback')

var aggregate = require('../lib/aggregate-browsers')
var runSauceTests = require('./run-sauce-tests')
var runLocalTests = require('./run-local-tests')

program
  .version(require('../package.json').version)
  .usage('[options] <files | dir>')
  .option('--local', 'run tests in a local browser of choice')
  .option('--port <port>', 'port for bouncer server, defaults to a free port')
  .option('--tunnel-id <id>', 'Tunnel identifier for Sauce Connect, default TRAVIS_JOB_NUMBER or none')
  .option('--loopback <host name>', 'hostname to use instead of localhost, to accomodate Safari and Edge with Sauce Connect. Must resolve to 127.0.0.1')
  .option('--server <the server script>', 'specify a server script to be run')
  .option('-l, --list-browsers', 'list available browsers and versions')
  .option('--browser-name <browser name>', 'specficy the browser name to test an individual browser')
  .option('--browser-version <browser version>', 'specficy the browser version to test an individual browser')
  .option('--browser-platform <browser platform>', 'specficy the browser platform to test an individual browser')
  .option('--browser-output-timeout <timeout>', 'how much time to wait between two test results, default to -1 (no timeout)')
  .option('--concurrency <n>', 'specify the number of concurrent browser pairs to test')
  .option('--coverage', 'enable code coverage analysis with istanbul')
  .option('--open', 'open a browser automatically. only used when --local is specified')
  .parse(process.argv)

var config = {
  files: program.args,
  local: program.local,
  port: program.port,
  prj_dir: process.cwd(),
  tunnel_id: program.tunnelId,
  loopback: program.loopback,
  server: program.server,
  concurrency: program.concurrency,
  coverage: program.coverage,
  open: program.open,
  browser_output_timeout: program.browserOutputTimeout && parseInt(program.browserOutputTimeout, 10),
  browser_open_timeout: program.browserOpenTimeout && parseInt(program.browserOpenTimeout, 10)
}

// Remove unspecified flags
for (var key in config) {
  if (typeof config[key] === 'undefined') {
    delete config[key]
  }
}

if (program.listBrowsers) {
  sauceBrowsers(function (err, allBrowsers) {
    if (err) {
      console.error(chalk.bold.red('Unable to get available browsers for saucelabs'))
      console.error(chalk.red(err.stack))
      return process.exit(1)
    }
    aggregate(allBrowsers).forEach(function (i) {
      console.log(i.browser)
      console.log('   Versions: ' + i.versions.join(', '))
      console.log('   Platforms: ' + i.platforms.join(', '))
    })
  })
} else if (config.files.length === 0) {
  console.error(chalk.red(messages.NO_FILES))
  process.exit(1)
} else if ((program.browserVersion || program.browserPlatform) && !program.browserName) {
  console.error(chalk.red('the browser name needs to be specified (via --browser-name)'))
  process.exit(1)
} else if ((program.browserName || program.browserPlatform) && !program.browserVersion) {
  console.error(chalk.red('the browser version needs to be specified (via --browser-version)'))
  process.exit(1)
} else {
  config = readLocalConfig('airtap', config)
  config = readLocalConfig('twintap', config)

  // Overwrite browsers from command line arguments
  if (program.browserName) {
    Object.assign(config, { browsers: [{ name: program.browserName, version: program.browserVersion, platform: program.browserPlatform }] })
  }

  config = readGlobalConfig(config)
  config.username = process.env.SAUCE_USERNAME || config.sauce_username
  config.key = process.env.SAUCE_ACCESS_KEY || config.sauce_key

  var pkg = {}
  try {
    pkg = require(process.cwd() + '/package.json')
  } catch (err) {}

  config.name = config.name || pkg.name || 'twintap'
  config.watchify = !process.env.CI

  if (config.builder) {
    // relative path will needs to be under project dir
    if (config.builder[0] === '.') {
      config.builder = path.resolve(config.prj_dir, config.builder)
    }

    config.builder = require.resolve(config.builder)
  }

  if (config.local) {
    runLocalTests(config)
  } else if (config.electron) {
    console.error(chalk.red('Error:'))
    console.error(chalk.red('Twintap does not support Electron.'))
    process.exit(1)
  } else if (!config.username || !config.key) {
    console.error(chalk.red('Error:'))
    console.error(chalk.red('Twintap tried to run tests in Sauce Labs, however no credentials were provided.'))
    console.error(chalk.cyan('See doc/cloud-testing.md for info on how to setup cloud testing.'))
    process.exit(1)
  } else if (!config.browsers) {
    console.error(chalk.red('No cloud browsers specified in .twintap.yml'))
    process.exit(1)
  } else {
    runSauceTests(config)
  }
}

function readLocalConfig (rootName, config) {
  var yaml = path.join(process.cwd(), '.' + rootName + '.yml')
  var js = path.join(process.cwd(), rootName + '.config.js')
  var yamlExists = fs.existsSync(yaml)
  var jsExists = fs.existsSync(js)
  if (yamlExists && jsExists) {
    console.error(chalk.red('Both `.' + rootName + '.yaml` and `' + rootName + '.config.js` are found in the project directory, please choose one'))
    process.exit(1)
  } else if (yamlExists) {
    return mergeConfig(config, readYAMLConfig(yaml))
  } else if (jsExists) {
    return mergeConfig(config, require(js))
  }
  return config
}

function readGlobalConfig (config) {
  var filename = findNearestFile('.twintaprc') || findNearestFile('.airtaprc') || path.join(os.homedir(), '.airtaprc')
  if (fs.existsSync(filename)) {
    var globalConfig
    try {
      globalConfig = require(filename)
    } catch (_err) {
      globalConfig = readYAMLConfig(filename)
    }
    return mergeConfig(config, globalConfig)
  }
  return config
}

function readYAMLConfig (filename) {
  return yaml.parse(fs.readFileSync(filename, 'utf-8'))
}

function mergeConfig (config, update) {
  config = Object.assign({}, update, config)
  return config
}
