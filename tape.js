/* global ZUUL */

const tape = require('tape')
const Socket = require('simple-websocket')
let hostname = 'localhost'
if (typeof window !== 'undefined') {
	hostname = window.location.hostname
}
const socket = new Socket('ws://' + hostname + ':3000')

const instanceID = ZUUL.instanceID
const pairID = ZUUL.pairID

socket.sendEvent = (eventName, data) => {
	socket.write(JSON.stringify({ eventName, data }))
}
socket.on('data', (data) => {
	const msg = JSON.parse(data)
	socket.emit(msg.eventName, msg.data)
})
socket.sendEvent('__pairID__', pairID)

const cachedBarriers = {}
socket.on('__barrier__', ({ barrierName }) => {
  cachedBarriers[barrierName] = true
})
function awaitBarrier (_barrierName, timeout=30000) {
  return new Promise((resolve, reject) => {
    socket.sendEvent('__barrier__', { barrierName: _barrierName })
    if (cachedBarriers[_barrierName]) {
      delete cachedBarriers[_barrierName]
      resolve()
    }
    let t = setTimeout(() => {
      reject(new Error('barrier timed out'))
    }, timeout)
    function onBarrier ({ barrierName }) {
      if (barrierName !== _barrierName) return
      clearTimeout(t)
      socket.removeListener('__barrier__', onBarrier)
      resolve()
    }
    socket.on('__barrier__', onBarrier)
  })
}

function sendEvent (eventName, data) {
  socket.sendEvent('__send__', { eventName, data })
}

let cachedEvents = {}
const eventListeners = {}
socket.on('__send__', ({ eventName, data }) => {
  if (eventListeners[eventName]) {
    eventListeners[eventName].forEach(listener => {
      listener(data)
    })
  }
  cachedEvents[eventName] = cachedEvents[eventName] || []
  cachedEvents[eventName].push(data)
})
function onEvent (eventName, callback) {
  eventListeners[eventName] = eventListeners[eventName] || []
	eventListeners[eventName].push(callback)
	if (cachedEvents[eventName]) {
		cachedEvents[eventName].forEach(data => {
			callback(data)
		})
	}
}

function addExtraFns (t, testIndex) {
  t.barrier = (barrierName, timeout=30000) => {
    return awaitBarrier('__testBarrier__' + testIndex + '__' + barrierName, timeout).catch((err) => {
      t.fail(err)
      t.end()
    })
  }
  t.send = (eventName, data) => {
    sendEvent(testIndex + '__' + eventName, data)
  }
  t.receive = (eventName, callback) => {
    onEvent(testIndex + '__' + eventName, callback)
  }
  t.instance = instanceID
  function onClose () {
    socket.removeListener('close', onClose)
		if (allDone) return
		socketFailed = true
		t.fail('socket close')
		t.end()
  }
	socket.on('close', onClose)
}

let testCount = 0
function twinTape (name, tests) {
  tape(name, async (t) => {
		if (socketFailed) {
			t.fail('socket failed')
			t.end()
			return
		}
    addExtraFns(t, testCount++)
    cachedEvents = {}
    await awaitBarrier('__testStart__' + testCount)
    if (typeof tests === 'function' || tests.length === 1) {
      tests(t)
    } else {
      tests[instanceID](t)
    }
  })
}

let allDone = false
let socketFailed = false
tape.onFinish(async () => {
	allDone = true
	await awaitBarrier('__testFinish__')	
	socket.destroy()
})

module.exports = twinTape
