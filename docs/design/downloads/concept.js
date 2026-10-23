const element = (id) => document.getElementById(id);
const initial = new URLSearchParams(window.location.search);
const platforms = ['browser', 'mac', 'ios', 'android'];
const state = {
  surface: initial.get('surface') === 'drive' ? 'drive' : 'channel',
  version: initial.get('version') === 'current' ? 'current' : 'proposed',
  platform: platforms.includes(initial.get('platform'))
    ? initial.get('platform')
    : window.matchMedia('(max-width: 740px)').matches ? 'ios' : 'browser',
  intent: 'save',
  busy: false,
};
let originatingAction;
const isMobile = () => state.platform === 'ios' || state.platform === 'android';
const fileName = 'launch-demo.mp4';

function icon(name) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.classList.add('icon');
  svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  use.setAttribute('href', `#i-${name}`);
  svg.append(use);
  return svg;
}

function setBusy(busy) {
  state.busy = busy;
  element('share-macro').disabled = busy;
  element('old-menu').disabled = busy;
  if (busy) element('current-menu').hidden = true;
  document.querySelectorAll('.download-action').forEach((button) => {
    button.disabled = busy;
    button.querySelector('span').textContent = busy ? 'Preparing…' : isMobile() ? 'Save or share…' : 'Download';
  });
  element('next-state').hidden = !busy;
}

function dismissStatus() {
  element('status').hidden = true;
}

function showStatus(title, description, options = {}) {
  const toast = element('status');
  toast.replaceChildren();
  toast.hidden = false;
  toast.className = `toast${options.error ? ' error' : ''}`;
  const head = document.createElement('div');
  head.className = 'toast-head';
  const glyph = icon(options.error ? 'warning-circle' : options.progress ? 'download-simple' : 'check');
  glyph.classList.add('toast-icon');
  const copy = document.createElement('div');
  copy.className = 'toast-copy';
  const heading = document.createElement('h3');
  heading.textContent = title;
  const body = document.createElement('p');
  body.textContent = description;
  copy.append(heading, body);
  if (options.progress) {
    const unknown = element('outcome').value === 'unknown';
    const progress = document.createElement('div');
    progress.className = `progress${unknown ? ' indeterminate' : ''}`;
    progress.setAttribute('aria-hidden', 'true');
    progress.append(document.createElement('div'));
    const label = document.createElement('div');
    label.className = 'progress-label';
    label.textContent = unknown ? '18 MB received' : '43% · 18 MB of 42 MB';
    copy.append(progress, label);
  }
  head.append(glyph, copy);
  if (!state.busy) {
    const close = document.createElement('button');
    close.className = 'icon-btn close-toast';
    close.setAttribute('aria-label', 'Dismiss notification');
    close.append(icon('x'));
    close.onclick = dismissStatus;
    head.append(close);
  }
  toast.append(head);
  if (options.actions?.length) {
    const actions = document.createElement('div');
    actions.className = 'toast-actions';
    options.actions.forEach(([label, action]) => {
      const button = document.createElement('button');
      button.className = 'button';
      button.textContent = label;
      button.onclick = action;
      actions.append(button);
    });
    toast.append(actions);
  }
}

function render() {
  for (const id of ['sheet', 'viewer', 'system-sheet']) element(id).close();
  setBusy(false);
  dismissStatus();
  const drive = state.surface === 'drive';
  const current = state.version === 'current';
  document.body.classList.toggle('mobile-preview', isMobile());
  for (const id of ['doc-header', 'proposal-document', 'channel-header', 'channel-body', 'channel-composer']) element(id).hidden = drive;
  for (const id of ['drive-list-header', 'drive-list', 'drive-header', 'drive-detail']) element(id).hidden = !drive;
  element('file-strip').hidden = current;
  element('header-download').hidden = current;
  element('viewer-action').hidden = current;
  element('current-menu').hidden = true;
  element('platform').value = state.platform;
  element('nav-channel').classList.toggle('active', !drive);
  element('nav-drive').classList.toggle('active', drive);
  const meta = element('outcome').value === 'unknown' ? 'MP4 video' : 'MP4 video · 42 MB';
  for (const id of ['file-meta', 'drive-file-meta', 'viewer-meta']) element(id).textContent = meta;
  document.querySelectorAll('[data-group]').forEach((group) => {
    group.querySelectorAll('button').forEach((button) => button.setAttribute('aria-pressed', String(state[group.dataset.group] === button.dataset.value)));
  });
  const url = new URL(window.location.href);
  for (const key of ['surface', 'version', 'platform']) url.searchParams.set(key, state[key]);
  window.history.replaceState(null, '', url);
}

function restoreFocus() {
  const fallback = element(state.surface === 'drive' ? 'header-download' : 'file-action');
  const target = originatingAction?.checkVisibility() ? originatingAction : fallback;
  if (target.checkVisibility() && !target.disabled) target.focus();
}

function cancel() {
  element('system-sheet').close();
  setBusy(false);
  showStatus(state.intent === 'share' ? 'Sharing canceled' : isMobile() ? 'Save canceled' : 'Download canceled', 'The original file is still in Macro.', { actions: [['Try again', () => begin(state.intent)]] });
  restoreFocus();
}

function begin(intent = 'save') {
  element('sheet').close();
  element('viewer').close();
  state.intent = intent;
  setBusy(true);
  showStatus(`Preparing ${fileName}`, state.intent === 'share' ? 'Getting your file ready to share.' : 'Getting your file ready to save.', { progress: true, actions: [['Cancel', cancel]] });
}

function finish() {
  const outcome = element('outcome').value;
  if (outcome === 'failure') {
    setBusy(false);
    showStatus(`Couldn't save ${fileName}`, 'Check your connection and try again.', { error: true, actions: [['Retry', () => begin(state.intent)]] });
    return;
  }
  if (outcome === 'unavailable') {
    setBusy(false);
    showStatus('File unavailable', 'This file is no longer available to you.', { error: true });
    return;
  }
  if (isMobile()) {
    dismissStatus();
    element('next-state').hidden = true;
    const sharing = state.intent === 'share';
    element('system-title').textContent = sharing ? 'Share file' : state.platform === 'ios' ? 'Save to Files' : 'Save to device';
    element('system-confirm').textContent = sharing ? 'Done' : 'Save';
    element('save-destinations').hidden = sharing;
    element('share-destination-help').hidden = !sharing;
    element('device-location').textContent = state.platform === 'ios' ? 'On My iPhone' : 'Downloads';
    element('cloud-location').textContent = state.platform === 'ios' ? 'iCloud Drive' : 'Choose another folder';
    element('system-sheet').showModal();
    return;
  }
  setBusy(false);
  if (state.platform === 'mac') {
    showStatus('Download requested', 'Check your app’s download destination.', { actions: [['About this state', () => showStatus('Mac destination needs verification', 'The final destination and save confirmation must be checked in the Mac app before implementation.')]] });
  } else {
    showStatus('Download started', 'Check your browser’s downloads. Your browser controls where files are saved.', { actions: [['Where is my file?', () => showStatus('Find your download', 'Open your browser’s downloads list and look for launch-demo.mp4. Your browser may ask you to choose a location.')]] });
  }
}

function start(event) {
  if (state.busy) return;
  originatingAction = event?.currentTarget;
  element('viewer').close();
  if (isMobile()) {
    element('save-label').textContent = state.platform === 'ios' ? 'Save to Files…' : 'Save to device…';
    element('sheet').showModal();
  } else begin();
}

const template = element('recording-template');
document.querySelectorAll('[data-recording]').forEach((preview) => {
  preview.append(template.content.cloneNode(true));
  preview.querySelectorAll('[data-open-viewer]').forEach((button) => {
    if (preview.closest('#viewer')) { button.hidden = true; return; }
    button.onclick = () => element('viewer').showModal();
  });
});
document.querySelectorAll('[data-group]').forEach((group) => group.querySelectorAll('button').forEach((button) => {
  button.onclick = () => { state[group.dataset.group] = button.dataset.value; render(); };
}));
for (const surface of ['channel', 'drive']) element(`nav-${surface}`).onclick = () => { state.surface = surface; render(); };
element('platform').onchange = () => { state.platform = element('platform').value; render(); };
element('outcome').onchange = render;
document.querySelectorAll('.download-action').forEach((button) => { button.onclick = start; });
element('next-state').onclick = finish;
element('save-option').onclick = () => begin('save');
element('share-option').onclick = () => begin('share');
element('sheet-close').onclick = () => element('sheet').close();
element('viewer-close').onclick = () => element('viewer').close();
element('system-cancel').onclick = cancel;
element('system-sheet').addEventListener('cancel', (event) => { event.preventDefault(); cancel(); });
element('system-confirm').onclick = () => {
  element('system-sheet').close();
  setBusy(false);
  if (state.intent === 'share') showStatus('Returned to Macro', 'No delivery receipt is available from this handoff.');
  else showStatus(`Saved ${fileName}`, 'A copy is saved in your chosen location.');
  restoreFocus();
};
element('old-menu').onclick = () => { element('current-menu').hidden = !element('current-menu').hidden; };
element('menu-download').onclick = (event) => {
  element('current-menu').hidden = true;
  if (state.version === 'proposed') start(event);
  else showStatus('Existing download route', 'Download is inside the file menu. Android uses its native save flow; the shared helper dispatches an anchor download elsewhere.');
};
element('share-macro').onclick = () => showStatus('Share in Macro', 'This separate action manages access to the Macro file and its link.');
element('selected-file').onclick = () => (state.version === 'proposed' ? element('header-download') : element('old-menu')).focus();
document.querySelectorAll('[data-explain]').forEach((button) => { button.onclick = () => { element('current-menu').hidden = true; showStatus(`${button.dataset.explain} file`, 'This prototype focuses on the download interaction.'); }; });
render();
