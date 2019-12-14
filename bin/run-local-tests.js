var Twintap = require('../lib/twintap')
var open = require('opener')

function runLocalTests (config) {
  var twintap = Twintap(config)
  twintap.run(function (err, url) {
    if (err) throw err

    if (config.open) {
      open(url + '?instanceID=0&pairID=0')
      open(url + '?instanceID=1&pairID=0')
    } else {
      console.log('open the following urls in two browsers:')
      console.log(url + '?instanceID=0&pairID=0')
      console.log(url + '?instanceID=1&pairID=0')
      console.log('change pairID for each pair of browsers!')
    }
  })
}
module.exports = runLocalTests
