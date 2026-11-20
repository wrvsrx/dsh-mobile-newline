import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { runInNewContext } from 'node:vm'

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8')
const COMPOSER = '[data-composer-input][contenteditable="true"]'

function fixture(userAgent = 'Android Chrome') {
  let plugin, dispose, selected, composing = false
  const listeners = new Map()
  const events = new EventTarget()
  const enter = { type: 'KEY_ENTER_COMMAND' }
  const newline = { type: 'INSERT_LINE_BREAK_COMMAND' }
  const calls = []
  const list = { contains: node => node === selected, getAttribute: () => 'candidate' }
  const root = {
    isConnected: true,
    matches: selector => selector === COMPOSER,
    closest: selector => selector === COMPOSER ? root : { querySelector: () => selected ? list : null },
    ownerDocument: { getElementById: () => selected },
    hasAttribute: () => false,
  }
  const doc = {
    activeElement: root,
    addEventListener(name, fn, capture) {
      assert.equal(capture, true)
      listeners.set(name, fn)
      events.addEventListener(name, fn)
    },
    removeEventListener(name, fn, capture) {
      assert.equal(capture, true)
      assert.equal(listeners.get(name), fn)
      listeners.delete(name)
      events.removeEventListener(name, fn)
    },
  }
  function makeEditor() {
    let handler
    return {
      _commands: new Map([[enter, []], [newline, []]]),
      getRootElement: () => root,
      isComposing: () => composing,
      registerCommand(command, fn, priority) {
        assert.equal(command, enter)
        assert.equal(priority, -4)
        handler = fn
        return () => { handler = undefined }
      },
      dispatchCommand(command, ...args) {
        calls.push([command, ...args])
        if (command === enter) return handler?.(...args) ?? false
        return command === newline
      },
    }
  }
  root.__lexicalEditor = makeEditor()
  runInNewContext(source, {
    Map,
    window: { navigator: { userAgent }, __ModuleLoader__: { load: ({ factory }) => { plugin = factory() } } },
    document: doc,
  })
  plugin.apply({ effect: fn => { dispose = fn() } })
  return {
    calls, enter, newline, listeners, root, makeEditor, dispose,
    selectCandidate: () => { selected = {} },
    setComposing: () => { composing = true },
    press(event) { return root.__lexicalEditor.dispatchCommand(enter, event) },
    discover(name) { listeners.get(name)?.({ target: root }) },
  }
}

test('mobile bare Enter dispatches the live editor newline and cancels native editing', () => {
  const f = fixture()
  let prevented = 0
  const event = { preventDefault: () => prevented++ }
  assert.equal(f.press(event), true)
  assert.equal(prevented, 1)
  assert.deepEqual(f.calls, [[f.enter, event], [f.newline, false]])
})

test('IME null Enter is consumed even during composition or with a highlighted menu', () => {
  const f = fixture()
  f.setComposing()
  f.selectCandidate()
  assert.equal(f.press(null), true)
  assert.deepEqual(f.calls, [[f.enter, null], [f.newline, false]])
})

test('modified Enter, composition keydown, and menu selection are delegated unchanged', () => {
  const f = fixture()
  const preventDefault = () => assert.fail('must not cancel delegated Enter')
  for (const flags of [{ shiftKey: true }, { ctrlKey: true }, { metaKey: true }, { altKey: true },
    { getModifierState: k => k === 'AltGraph' }, { isComposing: true }, { keyCode: 229 }]) {
    assert.equal(f.press({ preventDefault, ...flags }), false)
  }
  f.selectCandidate()
  assert.equal(f.press({ preventDefault }), false)
  assert.ok(f.calls.every(([command]) => command === f.enter))
})

test('desktop does not install listeners or change Enter', () => {
  const f = fixture('Linux Chrome')
  assert.equal(f.listeners.size, 0)
  assert.equal(f.press(null), false)
})

test('rebinds a replacement editor and unregisters on unload', () => {
  const f = fixture()
  const oldEditor = f.root.__lexicalEditor
  f.root.__lexicalEditor = f.makeEditor()
  f.discover('compositionend')
  assert.equal(oldEditor.dispatchCommand(f.enter, null), false)
  assert.equal(f.press(null), true)
  f.dispose()
  assert.equal(f.listeners.size, 0)
  assert.equal(f.press(null), false)
})
