#!/usr/bin/env node

// adapted from https://github.com/substack/tape/blob/master/bin/tape

var createSyncServer = require('../lib/sync-server')

createSyncServer()

let exited = [false, false]
const stdQueue = []
for (let i = 0; i < 2; i++) {
	const child = require('child_process').spawn('node', ['./bin/node-child', i].concat(process.argv.slice(2)))

	child.stdout.on('data', (data) => {
		console.log(`${data}`) // TODO: is interleaved output an issue for tap?
	})
	child.stderr.on('data', (data) => {
		console.error(`${data}`)
	})
	child.on('close', (code) => {
		exited[i] = true
		if (code !== 0) process.exit(code)
		if (exited[0] && exited[1]) process.exit(0)
	})
}
