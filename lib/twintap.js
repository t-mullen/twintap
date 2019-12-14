var debug = require('debug')('twintap')
var omit = require('lodash').omit
var Batch = require('batch')
var EventEmitter = require('events').EventEmitter
var inherits = require('util').inherits
var createControlServer = require('./control-app')
var createTestServer = require('./setup')
var SauceBrowser = require('./sauce-browser')

module.exports = Twintap

function Twintap (config) {
  if (!(this instanceof Twintap)) {
    return new Twintap(config)
  }

  EventEmitter.call(this)

  if (config.browser_output_timeout === undefined) {
    config.browser_output_timeout = -1
  }

  if (config.browser_open_timeout === undefined) {
    config.browser_open_timeout = 120 * 1000
  }

  this._config = config

  debug('config: %j', omit(config, ['sauce_username', 'sauce_key', 'username', 'key']))

  // list of browsers to test
  this._browserPairs = []
  this._concurrency = config.concurrency || 2
}

inherits(Twintap, EventEmitter)

Twintap.prototype.browserPair = function (infoPair) {
  var config = this._config
  this._browserPairs.push(infoPair.map(info => SauceBrowser({
    name: config.name,
    build: process.env.TRAVIS_BUILD_NUMBER,
    firefox_profile: info.firefox_profile,
    username: config.username,
    key: config.key,
    browser: info.browser,
    version: info.version,
    platform: info.platform,
    capabilities: config.capabilities
  }, config)))
}

Twintap.prototype.run = function (cb) {
  var self = this
  var config = self._config

  createControlServer(config, function (err, server) {
    if (err) return cb(err)

    debug('control server active on port %d', server.port)
    config.control_port = server.port

    function exit (err, result) {
      server.close(function (err2) {
        cb(err || err2, result)
      })
    }

    if (config.local) {
      var testServer = createTestServer(config, function (err, url) {
        if (err) return cb(err)

        cb(null, url, function close (cb) {
          server.close(function (err) {
            testServer.shutdown(function (err2) {
              cb(err || err2)
            })
          })
        })
      })
      return
    }

    if (config.electron) {
      console.error('Twintap does not support Electron')
      process.exit(1)
    }

    var batch = new Batch()
    batch.concurrency(self._concurrency)

    var passed = true

    debug(`begin testing ${self._browserPairs.length} different combinations of browsers`)

    self._browserPairs.forEach((browserPair, pi) => {
      self.emit('browserPair', browserPair)

      browserPair.forEach(browser => {
        browser.on('error', (err) => { self.emit('error', err) })
      })

      batch.push((done) => {
        const isDone = [false, false]

        browserPair.forEach((browser, i) => {
          browser.once('done', (stats) => {
            // if no tests passed, then this is also a problem
            // indicates potential error to even run tests
            if (stats.failed || stats.passed === 0) {
              passed = false
            }
            isDone[i] = true
            if (isDone[0] && isDone[1]) done()
          })
          browser.start(pi, i)
        })
      })
    })

    batch.end((err) => {
      debug('batch done')
      exit(err, passed)
    })
  })
}
