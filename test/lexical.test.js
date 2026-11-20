import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { runInThisContext } from 'node:vm'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const base = process.env.DSH_CHECKOUT

test('DSH Lexical 0.49: bare and IME Enter insert line breaks before the send handler', { skip: !base }, async () => {
  const { globSync } = await import('node:fs')
  function load(pattern) {
    const paths = globSync(pattern, { cwd: resolve(base, 'node_modules/.pnpm') })
    assert.equal(paths.length, 1, pattern)
    return import(pathToFileURL(resolve(base, 'node_modules/.pnpm', paths[0])).href)
  }
  const { Window } = await load('happy-dom@*/node_modules/happy-dom/lib/index.js')
  const window = new Window()
  Object.defineProperty(window.navigator, 'userAgent', { value: 'Android Chrome' })
  const globals = { window, document: window.document, navigator: window.navigator, MutationObserver: window.MutationObserver, getComputedStyle: window.getComputedStyle.bind(window) }
  const oldGlobals = Object.fromEntries(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
  for (const [key, value] of Object.entries(globals)) {
    Object.defineProperty(globalThis, key, { configurable: true, value })
  }
  let unbind
  try {
    const lexical = await load('lexical@0.49.0_patch*/node_modules/lexical/dist/Lexical.node.mjs')
    const { registerPlainText } = await load('@lexical+plain-text@0.49.0*/node_modules/@lexical/plain-text/dist/LexicalPlainText.node.mjs')
    const root = document.createElement('div')
    root.setAttribute('contenteditable', 'true')
    root.setAttribute('data-composer-input', '')
    document.body.append(root)
    const editor = lexical.createEditor({ onError: error => { throw error } })
    registerPlainText(editor)
    let sends = 0
    editor.registerCommand(lexical.KEY_ENTER_COMMAND, () => { sends++; return true }, lexical.COMMAND_PRIORITY_CRITICAL)
    editor.setRootElement(root)
    let plugin
    window.__ModuleLoader__ = { load({ factory }) { plugin = factory() } }
    runInThisContext(await readFile(new URL('../lib/client.js', import.meta.url), 'utf8'))
    plugin.apply({ effect(fn) { unbind = fn() } })
    root.dispatchEvent(new window.Event('focusin', { bubbles: true }))
    editor.update(() => {
      const line = lexical.$createParagraphNode().append(lexical.$createTextNode('abc'))
      lexical.$getRoot().append(line)
      line.selectEnd()
      const event = new window.KeyboardEvent('keydown', { key: 'Enter', cancelable: true })
      assert.equal(editor.dispatchCommand(lexical.KEY_ENTER_COMMAND, event), true)
      assert.equal(event.defaultPrevented, true)
      assert.equal(editor.dispatchCommand(lexical.KEY_ENTER_COMMAND, null), true)
      assert.equal(lexical.$getRoot().getTextContent(), 'abc\n\n')
    }, { discrete: true })
    assert.equal(sends, 0)
    unbind()
    unbind = undefined
    editor.update(() => {
      editor.dispatchCommand(lexical.KEY_ENTER_COMMAND, null)
      assert.equal(sends, 1)
    }, { discrete: true })
    editor.setRootElement(null)
  } finally {
    unbind?.()
    await window.happyDOM.close()
    for (const [key, desc] of Object.entries(oldGlobals)) {
      if (desc) Object.defineProperty(globalThis, key, desc)
      else delete globalThis[key]
    }
  }
})
