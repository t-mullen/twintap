var chalk = require('chalk')
var Twintap = require('../lib/twintap')
var sauceBrowsers = require('sauce-browsers/callback')

function runTests (config) {
  var twintap = Twintap(config)

  sauceBrowsers(config.browsers, function (err, browserInfo) {
    if (err) {
      console.error(chalk.bold.red('Unable to get available browsers for Sauce Labs'))
      console.error(chalk.red(err.stack))
      return process.exit(1)
    }

    var browserPairs = []
    var byOs = {}

    browserInfo.forEach(function (infoA) {
      browserInfo.forEach(function (infoB) {
        var key = infoA.api_name + ' @ ' + infoA.os + ' -> ' + infoB.api_name + ' @ ' + infoB.os;
        (byOs[key] = byOs[key] || []).push(infoA.short_version + '->' + infoB.short_version)

        twintap.browserPair([{
          browser: infoA.api_name,
          version: infoA.short_version,
          platform: infoA.os
        },
        {
          browser: infoB.api_name,
          version: infoB.short_version,
          platform: infoB.os
        }])
      })
    })

    // pretty prints which browsers we will test on what platforms
    for (var item in byOs) {
      console.log(chalk`{gray - testing: ${item}: ${byOs[item].join(' ')}}`)
    }

    var passedTestsCount = 0
    var failedBrowsersCount = 0
    var lastOutputName

    twintap.on('browserPair', function (browserPair) {
      browserPairs.push(browserPair)

      browserPair.forEach((browser, i) => {
        var name = browser.toString()
        var otherName = browserPair[(i + 1) % 2].toString()
        var waitInterval

        browser.once('init', function () {
          console.log(chalk`{gray - queuing: ${name} (remote: ${otherName})}`)
        })

        browser.on('start', function (reporter) {
          console.log(chalk`{white - starting: ${name} (remote: ${otherName})}`)

          clearInterval(waitInterval)
          waitInterval = setInterval(function () {
            console.log(chalk`{yellow - waiting:} ${name} (remote: ${otherName})`)
          }, 1000 * 30)

          var currentTest
          reporter.on('test', function (test) {
            currentTest = test
          })

          reporter.on('console', function (msg) {
            if (lastOutputName !== name) {
              lastOutputName = name
              console.log(chalk`{white ${name} (remote: ${otherName}) console}`)
            }

            // When testing with microsoft edge:
            // Adds length property to array-like object if not defined to execute console.log properly
            if (msg.args.length === undefined) {
              msg.args.length = Object.keys(msg.args).length
            }
            console.log.apply(console, msg.args)
          })

          reporter.on('assertion', function (assertion) {
            console.log()
            console.log(chalk`{red ${name} (remote: ${otherName}) ${currentTest ? currentTest.name : 'undefined test'}}`)
            console.log(chalk`{red Error: ${assertion.message}}`)

            // When testing with microsoft edge:
            // Adds length property to array-like object if not defined to execute forEach properly
            if (assertion.frames.length === undefined) {
              assertion.frames.length = Object.keys(assertion.frames).length
            }
            Array.prototype.forEach.call(assertion.frames, function (frame) {
              console.log()
              console.log(chalk`{gray ${frame.func} ${frame.filename}:${frame.line}}`)
            })
            console.log()
          })

          reporter.once('done', function () {
            clearInterval(waitInterval)
          })
        })

        browser.once('done', function (results) {
          passedTestsCount += results.passed

          if (results.failed > 0 || results.passed === 0) {
            console.log(chalk`{red - failed: ${name} (remote: ${otherName}), (${results.failed}, ${results.passed})}`)
            failedBrowsersCount++
            return
          }
          console.log(chalk`{green - passed: ${name} (remote: ${otherName})}`)
        })
      })
    })

    process.on('SIGINT', function () {
      shutdownAllBrowsers(browserPairs, function () {
        process.exit(2)
      })
    })

    twintap.on('error', function (err) {
      shutdownAllBrowsers(browserPairs, function () {
        throw err
      })
    })

    twintap.run(function (err, passed) {
      if (err) throw err

      if (failedBrowsersCount > 0) {
        console.log(chalk`{red ${failedBrowsersCount} browser(s) failed}`)
      } else if (passedTestsCount === 0) {
        console.log(chalk.yellow('No tests ran'))
      } else {
        console.log(chalk.green('All browsers passed'))
      }

      process.exit((passedTestsCount > 0 && failedBrowsersCount === 0) ? 0 : 1)
    })
  })
}

function shutdownAllBrowsers (browserPairs, done) {
  var Batch = require('batch')
  var batch = new Batch()

  browserPairs.forEach(function (browsers) {
    browsers.forEach(browser => {
      batch.push(function (done) {
        browser.shutdown()
        browser.once('done', done)
      })
    })
  })

  batch.end(done)
}

module.exports = runTests
