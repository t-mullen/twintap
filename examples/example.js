const test = require('../tape.js')

test('test name', [
	async (t) => {
		// test WebRTC, Websockets, etc
		await t.barrier('first barrier') // will not resolve until all peers have reached this point
		t.send('A', 'test data') // send events
		t.end()
	},
	async (t) => {
		// test WebRTC, Websockets, etc
		await t.barrier('first barrier') // will not resolve untill all peers have reached this point
		t.receive('A', (data) => {
					t.end()
		})
	}
])