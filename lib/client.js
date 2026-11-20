window.__ModuleLoader__.load({
  id: 'dsh-mobile-newline-local',
  factory: () => {
    const COMPOSER = '[data-composer-input][contenteditable="true"]'
    const HIGHLIGHT = '[data-trigger-menu] [role="listbox"][aria-activedescendant]'
    // Lexical 0.49: prepend to the same critical queue DSH's send handler uses.
    const BEFORE_CRITICAL = -4

    function isMobile(nav) {
      return /Android|iPhone|iPad|iPod|Mobile/i.test(nav.userAgent) ||
        (/Macintosh/i.test(nav.userAgent) && nav.maxTouchPoints > 1)
    }

    function bind(root, editor) {
      // Commands are object identities. Importing a second copy of Lexical
      // would register unrelated commands. Resolve the live editor's keys.
      if (editor?.getRootElement?.() !== root || !(editor._commands instanceof Map)) return null
      const commands = Array.from(editor._commands.keys())
      const enter = commands.find(command => command.type === 'KEY_ENTER_COMMAND')
      const newline = commands.find(command => command.type === 'INSERT_LINE_BREAK_COMMAND')
      if (!enter || !newline) return null

      return editor.registerCommand(enter, event => {
        if (!root.isConnected || editor.getRootElement() !== root || !root.matches(COMPOSER)) return false
        if (event !== null) {
          if (event.shiftKey || event.ctrlKey || event.metaKey || event.altKey ||
              event.getModifierState?.('AltGraph') || event.isComposing || event.keyCode === 229 ||
              editor.isComposing() || root.hasAttribute('data-composer-composing')) return false
          // Let DSH pick an actual highlighted candidate. An open but empty
          // trigger menu would fall through to send, so don't delegate that.
          const list = root.closest('[data-composer-card]')?.querySelector(HIGHLIGHT)
          const selected = list && root.ownerDocument.getElementById(list.getAttribute('aria-activedescendant'))
          if (selected && list.contains(selected)) return false
          event.preventDefault()
        }
        // Lexical passes null when a composition ends in a newline. Never
        // delegate it to DSH's Enter handler, which treats null as send.
        editor.dispatchCommand(newline, false)
        return true
      }, BEFORE_CRITICAL)
    }

    function attach(doc) {
      let currentRoot
      let currentEditor
      let unregister
      const events = ['focusin', 'keydown', 'beforeinput', 'input', 'compositionstart', 'compositionend']
      function ensureBound(event) {
        const root = event.target?.closest?.(COMPOSER)
        if (!root) return
        const editor = root.__lexicalEditor
        if (root === currentRoot && editor === currentEditor && unregister) return
        unregister?.()
        currentRoot = root
        currentEditor = editor
        unregister = bind(root, editor)
      }
      // Capture only discovers the editor before Lexical handles the event.
      // It neither cancels DOM events nor dispatches synthetic keystrokes.
      for (const name of events) doc.addEventListener(name, ensureBound, true)
      ensureBound({ target: doc.activeElement })
      return () => {
        for (const name of events) doc.removeEventListener(name, ensureBound, true)
        unregister?.()
      }
    }

    return Object.assign(Object.create(null), {
      [Symbol.toStringTag]: 'Module',
      name: 'dsh-mobile-newline-local-client',
      apply(ctx) {
        ctx.effect(() => isMobile(window.navigator) ? attach(document) : undefined)
      },
    })
  },
})
