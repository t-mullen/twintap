const WSServer = require('simple-websocket/server')

function createSyncServer () {
	const ws = new WSServer({
		port: 3000
	})
  const pairs = {}
  ws.on('connection', (socket) => {
		socket.on('data', (data) => {
			const msg = JSON.parse(data)
			socket.emit(msg.eventName, msg.data)
		})
		socket.sendEvent = (eventName, data) => {
			socket.write(JSON.stringify({ eventName, data }))
		}
    socket.on('__pairID__', (pairID) => {
      const p = pairs[pairID] = pairs[pairID] || { sockets: [], queue: [] }
      if (p.sockets.length === 2) {
        console.error('too many clients connected with same pairID')
        return socket.destroy()
			}
			p.sockets.push(socket)
			socket.on('close', () => {
				p.sockets.forEach(s => s.destroy())
			})
      if (p.sockets.length === 2) {
        // replay missed events for late socket
        p.queue.forEach(msg => {
          p.sockets[1].sendEvent(msg[0], msg[1])
        })
        p.queue = []
      }
      // queue events until other socket connects
      const i = p.sockets.length - 1
      socket.on('__barrier__', (data) => {
        if (p.sockets.length === 2) {
          const other = p.sockets[(i + 1) % 2]
          other.sendEvent('__barrier__', data)
        } else {
          p.queue.push(['__barrier__', data])
        }
      })
      socket.on('__send__', (data) => {
        if (p.sockets.length === 2) {
          const other = p.sockets[(i + 1) % 2]
          other.sendEvent('__send__', data)
        } else {
          p.queue.push(['__send__', data])
        }
      })
    })
  })
}
module.exports = createSyncServer
