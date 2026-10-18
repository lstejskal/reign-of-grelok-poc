import { chopToLines } from '@grelok/engine';
import type { EngineEvent } from '@grelok/engine';
import type { GameSession } from './session';

/**
 * A developer console on top of the game: press / (slash) to open it (Escape or / closes it), type a command like "take pebble"
 * and press Enter. It is plain HTML - real text input is much easier in the DOM than in a 320x200 canvas.
 *
 * It prints every engine event it hears, whoever caused it. Lines starting with ":" are console commands:
 *   :events   toggle printing of non-text events (location_changed, thing_changed, ...)
 *
 * While it is open, keyboard shortcuts of the game itself must be ignored (see `isOpen`).
 */
export function installDebugConsole(session: GameSession): { readonly isOpen: boolean } {
  const panel = el('div', {
    id: 'debug-console',
    style: 'position:fixed;left:0;right:0;bottom:0;height:40vh;display:none;flex-direction:column;z-index:10;' +
      'background:rgba(8,8,16,.93);border-top:2px solid #7a1f2b;color:#c8e8c8;font:14px/1.4 ui-monospace,Menlo,Consolas,monospace',
  });
  const log = el('div', { id: 'debug-console-log', style: 'flex:1;overflow-y:auto;padding:8px 12px;white-space:pre-wrap' });
  const input = el('input', {
    id: 'debug-console-input',
    type: 'text',
    autocomplete: 'off',
    spellcheck: 'false',
    placeholder: 'type a command, e.g. "look", "north", "take pebble"   (/ or Esc closes)',
    style: 'border:0;border-top:1px solid #333;outline:0;background:#000;color:#fff;font:inherit;padding:8px 12px',
  }) as HTMLInputElement;
  panel.append(log, input);
  document.body.append(panel);

  let showEvents = false;
  let open = false;

  const print = (text: string, color = '') => {
    const line = el('div', { style: color ? `color:${color}` : '' });
    line.textContent = text;
    log.append(line);
    log.scrollTop = log.scrollHeight;
  };

  const describeEvent = (event: EngineEvent): void => {
    if (event.type === 'say') {
      print(chopToLines(event.text));
    } else if (showEvents) {
      const { type, ...rest } = event;
      print(`· ${type} ${JSON.stringify(rest)}`, '#7a8a9a');
    }
    if (event.type === 'game_over') print(event.won ? '*** YOU WON ***' : '*** GAME OVER ***', '#e8c040');
  };
  session.onEvents((events) => events.forEach(describeEvent));

  const setOpen = (value: boolean) => {
    open = value;
    panel.style.display = open ? 'flex' : 'none';
    if (open) input.focus();
    else input.blur();
  };

  // Show the starting room once, the first time the console is opened.
  let introShown = false;
  const showIntro = () => {
    if (introShown) return;
    introShown = true;
    print(session.bundle.config.title.toUpperCase(), '#e8c040');
    session.engine.describeLocation().forEach((line) => print(chopToLines(line)));
  };

  window.addEventListener('keydown', (e) => {
    // Match on e.key (the character typed), not e.code (the physical key): "/" sits on a different key
    // on different keyboard layouts (on a Czech one it is Shift+7).
    if (e.key === '/') {
      e.preventDefault();
      setOpen(!open);
      if (open) showIntro();
    } else if (e.key === 'Escape' && open) {
      setOpen(false);
    }
  });

  input.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const line = input.value.trim();
    input.value = '';
    if (line === '') return;

    print(`> ${line}`, '#ffffff');
    if (line === ':events') {
      showEvents = !showEvents;
      print(`(event printing ${showEvents ? 'on' : 'off'})`, '#7a8a9a');
    } else {
      session.performText(line);
    }
  });

  return {
    get isOpen() {
      return open;
    },
  };
}

function el(tag: string, attributes: Record<string, string>): HTMLElement {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
  return node;
}
