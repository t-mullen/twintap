# twintap

[`airtap`](https://github.com/airtap/airtap) for pairwise interoperability testing. Designed for WebRTC compatibility testing.

## Install
```
npm install -g twintap
```

## Usage

Write tests like [`tape`](https://github.com/substack/tape), except use `twintap/tape` and pass an array of two test functions.
```javascript
const test = require('twintap/tape')
test('test name', [
  (t) => {
    // test A-side of connection
    t.pass()
    t.end()
  },
  (t) => {
    // test B-side of connection
    t.pass()
    t.end()
}])
```

Setup a `.twintap.yml` or `.airtap.yml`.

Run your tests:
In Saucelabs: `twintap test/*.js`
With local browsers: `twintap --local test/*.js`

## Synchronization
The sync server allows synchronizing peers with simple barriers. 

```javascript
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
```

A barrier is automatically inserted before each test to ensure tests do not overlap.

## Symmetrical Tests
If both sides of the test are identical, just pass one function instead of duplicating code.
```javascript
test('test name', 
  async (t) => {
    // test WebRTC, Websockets, etc
    await t.barrier('first barrier') // will not resolve until all peers have reached this point
    t.send('A', 'test data') // send events
    t.end()
 })
```

## API
`twintap/tape` exposes all the features of `tape`, plus...

### `await t.barrier(name, [timeout])`
Wait until the other peer has also reached this barrier.

- `name` is a string unique to the test case.
- Optional `timeout` is the time to wait in milliseconds. Defaults to `30000`.

### `t.send(eventName, [data])`
Send an event with serializable data to the other peer.

- `eventName` is the name of the event for the other peer to listen to.
- Optional `data` is any serializable data to send.

### `t.receive(eventName, (data) => {})`
Wait for an event from the other peer. Callback is passed any deserialized data sent.

- `eventName` is the name of the even to wait for.

### `t.instance`
`0` or `1` depending on which side the test is running on. Useful for tests that are nearly symmetrical.

## Saucelabs
`twintap` suports [SauceLabs](https://saucelabs.com/), just like `airtap`. It requires [Sauce Connect](https://wiki.saucelabs.com/display/DOCS/Basic+Sauce+Connect+Proxy+Setup).

```
./sc -u <SAUCE_USERNAME> -k <SAUCE_KEY> --no-ssl-bump-domains airtap.local
```
