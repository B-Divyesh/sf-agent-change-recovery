import { invoke } from '@tauri-apps/api/core';
import './styles.css';

type FileChange = {
  path: string;
  kind: 'modified' | 'added' | 'deleted';
  additions: number;
  deletions: number;
  diff: string[];
  restored?: boolean;
};

type Checkpoint = {
  id: string;
  intent: string;
  detail: string;
  createdAt: string;
  commands: string[];
  files: FileChange[];
  checks: string;
  checkPassed: boolean;
  safety?: boolean;
};

type LedgerResponse = {
  ledger: Checkpoint[];
  retention: number;
  policy: string;
};

type LicenseVerdict = {
  valid: boolean;
  reason: 'ok' | 'invalid' | 'expired' | 'revoked' | 'wrong_product';
  expires_at?: string | null;
};

declare global {
  interface Window { __TAURI_INTERNALS__?: unknown }
}

const app = document.querySelector<HTMLDivElement>('#app')!;
const product = 'Change Recovery Ledger';
const appVersion = '0.1.9';
const demoKey = 'demo:agent-change-recovery:ledger';
const releasePage = 'https://github.com/B-Divyesh/sf-agent-change-recovery/releases';
const releaseCacheKey = `release:agent-change-recovery:${appVersion}`;
const productSlug = 'agent-change-recovery';
const billingBase = 'https://api.sociobot.in/api/v1';
const productCatalog = `${billingBase}/products`;
const proPriceMinor = 1500;
const licenseKey = `sb_license:${productSlug}`;
const licenseCacheKey = `${licenseKey}:verification`;
let activeCheckpoint = 'cp-3';
let selectedFiles = new Set<string>(['src/auth/session.ts']);
let toastTimer = 0;
let realProjectPath = '';
let realLedger: Checkpoint[] = [];
let realPassphrase = '';
let realRetention = 7;
let realPolicy = '';
let dialogReturnFocus: HTMLElement | null = null;
let licenseToken = '';
let licenseStatus: 'free' | 'checking' | 'active' | 'invalid' = 'free';

const sample: Checkpoint[] = [
  {
    id: 'cp-1',
    intent: 'Add session expiry warnings',
    detail: 'Warn signed-in users five minutes before their session ends.',
    createdAt: '10:42',
    commands: ['npm test -- session', 'npm run lint'],
    checks: '42 tests passed',
    checkPassed: true,
    files: [
      { path: 'src/auth/expiry.ts', kind: 'added', additions: 61, deletions: 0, diff: ['+ export function minutesRemaining(expiry: number) {', '+   return Math.ceil((expiry - Date.now()) / 60_000)', '+ }'] },
      { path: 'src/ui/SessionWarning.tsx', kind: 'added', additions: 44, deletions: 0, diff: ['+ export function SessionWarning() {', '+   return <aside role="status">Session ends soon</aside>', '+ }'] }
    ]
  },
  {
    id: 'cp-2',
    intent: 'Keep draft after sign-in',
    detail: 'Preserve the editor draft while the user renews a session.',
    createdAt: '11:08',
    commands: ['npm test -- draft', 'git diff --stat'],
    checks: '47 tests passed',
    checkPassed: true,
    files: [
      { path: 'src/editor/draft.ts', kind: 'modified', additions: 18, deletions: 7, diff: ['- sessionStorage.removeItem(DRAFT_KEY)', '+ if (reason !== "renewal") {', '+   sessionStorage.removeItem(DRAFT_KEY)', '+ }'] },
      { path: 'tests/draft.test.ts', kind: 'modified', additions: 26, deletions: 2, diff: ['+ it("keeps a draft during renewal", () => {', '+   expect(loadDraft()).toEqual(savedDraft)', '+ })'] }
    ]
  },
  {
    id: 'cp-3',
    intent: 'Refactor session refresh',
    detail: 'Share refresh logic across the editor and account screens. The session file caused two failures.',
    createdAt: '11:31',
    commands: ['npm test -- session', 'npm test -- editor', 'npm run typecheck'],
    checks: '2 of 51 tests failed',
    checkPassed: false,
    files: [
      { path: 'src/auth/session.ts', kind: 'modified', additions: 38, deletions: 19, diff: ['- const token = await renewOnce()', '+ const token = refreshQueue.current', '+   ?? renewOnce()', '- refreshQueue.current = null', '+ return token.value'] },
      { path: 'src/editor/autosave.ts', kind: 'modified', additions: 11, deletions: 4, diff: ['- await ensureSession()', '+ await session.refresh()', '+ scheduleNextSave()'] },
      { path: 'src/account/profile.ts', kind: 'modified', additions: 9, deletions: 3, diff: ['- renewSession()', '+ session.refresh({ source: "profile" })'] },
      { path: 'src/auth/refresh-queue.ts', kind: 'added', additions: 72, deletions: 0, diff: ['+ export class RefreshQueue {', '+   current?: Promise<Token>', '+ }'] }
    ]
  },
  {
    id: 'cp-4',
    intent: 'Update account help text',
    detail: 'Clarify where users can end other active sessions.',
    createdAt: '11:44',
    commands: ['npm test -- account'],
    checks: '8 tests passed',
    checkPassed: true,
    files: [
      { path: 'src/account/SecurityHelp.tsx', kind: 'modified', additions: 3, deletions: 3, diff: ['- End sessions in account settings.', '+ Open Security, then choose Active sessions.', '+ Select End session beside a device.'] }
    ]
  }
];

const routeMeta: Record<string, { title: string; description: string }> = {
  '/': { title: 'Change Recovery Ledger — Reverse agent changes', description: 'Inspect, reverse, and export selected agent changes without losing unrelated work.' },
  '/demo': { title: 'Demo — Change Recovery Ledger', description: 'Try selective agent change recovery with isolated sample data.' },
  '/app': { title: 'Ledger — Change Recovery Ledger', description: 'Capture and inspect local project checkpoints.' },
  '/privacy': { title: 'Privacy — Change Recovery Ledger', description: 'How Change Recovery Ledger handles local project data and downloads.' },
  '/terms': { title: 'Terms — Change Recovery Ledger', description: 'Terms for using Change Recovery Ledger.' },
  '/404': { title: 'Not found — Change Recovery Ledger', description: 'This recovery sheet could not be found.' }
};

function currentPath() {
  if (location.search.includes('demo=1')) return '/demo';
  const path = location.pathname.replace(/\/$/, '') || '/';
  return routeMeta[path] ? path : '/404';
}

function isPro() {
  return licenseStatus === 'active';
}

function licenseStatusText() {
  if (licenseStatus === 'active') return 'Pro license active on this device.';
  if (licenseStatus === 'checking') return 'Checking your saved license…';
  if (licenseStatus === 'invalid') return 'This license is no longer active. You can restore another license or subscribe again.';
  return 'Free plan: retain 2 or 7 checkpoints.';
}

function readCachedLicense() {
  try {
    const cached = localStorage.getItem(licenseCacheKey);
    if (!cached) return null;
    const value = JSON.parse(cached) as { checkedAt: number; verdict: LicenseVerdict };
    return value.checkedAt && value.verdict ? value : null;
  } catch {
    return null;
  }
}

function saveLicenseVerdict(verdict: LicenseVerdict) {
  localStorage.setItem(licenseCacheKey, JSON.stringify({ checkedAt: Date.now(), verdict }));
}

function captureLicenseFromUrl() {
  const url = new URL(location.href);
  const token = url.searchParams.get('license');
  if (!token) return;
  localStorage.setItem(licenseKey, token);
  url.searchParams.delete('license');
  history.replaceState(history.state, '', `${url.pathname}${url.search}${url.hash}`);
}

async function verifyLicense() {
  if (!licenseToken || !navigator.onLine) return;
  licenseStatus = 'checking';
  if (currentPath() === '/' || currentPath() === '/app') render();
  try {
    const verdict = window.__TAURI_INTERNALS__
      ? await invoke<LicenseVerdict>('verify_license', { license: licenseToken })
      : await (async () => {
        const response = await fetch(`${billingBase}/products/${productSlug}/verify?license=${encodeURIComponent(licenseToken)}`);
        if (!response.ok) throw new Error('License verification was unavailable.');
        return response.json() as Promise<LicenseVerdict>;
      })();
    saveLicenseVerdict(verdict);
    licenseStatus = verdict.valid ? 'active' : 'invalid';
  } catch {
    const cached = readCachedLicense();
    licenseStatus = cached?.verdict.valid ? 'active' : 'free';
  }
  if (currentPath() === '/' || currentPath() === '/app') render();
}

function initialiseLicense() {
  captureLicenseFromUrl();
  licenseToken = localStorage.getItem(licenseKey) ?? '';
  if (!licenseToken) return;
  const cached = readCachedLicense();
  licenseStatus = cached?.verdict.valid ? 'active' : cached ? 'invalid' : 'checking';
  if (!cached || Date.now() - cached.checkedAt >= 86_400_000) void verifyLicense();
}

function header() {
  return `
    <div class="offline-notice" role="status">You are offline. Saved ledgers and the demo still work.</div>
    <header class="site-header">
      <a class="brand" href="/" data-route><span class="brand-mark" aria-hidden="true"></span><span>Change Recovery Ledger</span></a>
      <button class="mobile-menu" type="button" aria-expanded="false" aria-controls="site-nav">Menu</button>
      <nav class="site-nav" id="site-nav" aria-label="Main navigation">
        <a href="/demo" data-route>Demo</a>
        <a href="/app" data-route>Open ledger</a>
        <a href="/#how">How it works</a>
        <a href="/privacy" data-route>Privacy</a>
      </nav>
    </header>`;
}

function footer() {
  return `
    <footer class="site-footer">
      <div><strong>Change Recovery Ledger</strong><p class="muted">Reverse selected agent changes without losing the rest.</p><small>Original generated artwork · v${appVersion} · build 2026.08.29</small></div>
      <nav class="footer-links" aria-label="Footer navigation"><a href="/privacy" data-route>Privacy</a><a href="/terms" data-route>Terms</a><a href="https://sociobot.in" rel="external">Built by Param Factory<span class="sr-only"> (external site)</span></a></nav>
    </footer>`;
}

function previewMarkup() {
  return `
    <div class="preview-window" aria-label="Loaded recovery ledger preview">
      <div class="window-bar"><span>ACME-WEB / 4 CHECKPOINTS</span><span>LOCAL</span></div>
      <div class="window-body">
        <div class="operation-list">
          <button class="operation-card"><strong>Keep draft after sign-in</strong><span>2 files · 11:08</span></button>
          <button class="operation-card" aria-current="true"><strong>Refactor session refresh</strong><span>4 files · 11:31</span></button>
          <button class="operation-card"><strong>Update account help text</strong><span>1 file · 11:44</span></button>
        </div>
        <div class="preview-detail">
          <div class="status-line"><strong>src/auth/session.ts</strong><span class="chip warn">2 tests failed</span></div>
          <div class="diff" aria-label="Text version of the selected change">
            <div class="diff-line remove">- const token = await renewOnce()</div>
            <div class="diff-line add">+ const token = refreshQueue.current</div>
            <div class="diff-line add">+   ?? renewOnce()</div>
            <div class="diff-line remove">- refreshQueue.current = null</div>
            <div class="diff-line add">+ return token.value</div>
          </div>
          <p class="notice"><strong>Selected recovery:</strong> reverse this file and keep the other three.</p>
          <a class="button small" href="/?demo=1" data-route>Open sample recovery</a>
        </div>
      </div>
    </div>`;
}

function retentionOptions() {
  const values = [2, 7, 30, 90];
  const visibleRetention = isPro() ? realRetention : Math.min(realRetention, 7);
  return values.map(value => {
    const needsPro = value > 7;
    const selected = value === visibleRetention ? ' selected' : '';
    const disabled = needsPro && !isPro() ? ' disabled' : '';
    return `<option value="${value}"${selected}${disabled}>Keep ${value} checkpoints${needsPro ? ' (Pro)' : ''}</option>`;
  }).join('');
}

function pricingMarkup() {
  return `<section class="section section-ink" id="pricing"><div class="sheet price-strip"><div><p class="eyebrow">Pro plan</p><h2>Keep more encrypted recovery history</h2><p class="max-text">Pro keeps 30 or 90 local checkpoints, adds team policy notes, and exports password-protected recovery files.</p><p class="price" id="pro-price" hidden></p><p class="muted" id="license-status">${escapeHtml(licenseStatusText())}</p></div><div><div id="checkout-action" aria-live="polite"><span class="muted">Checking whether Pro checkout is available…</span></div><form id="license-form" class="license-form"><label for="license-token">Have a license? Paste it<input id="license-token" name="license" required autocomplete="off" placeholder="sb_license…"></label><button class="secondary" type="submit">Restore license</button></form><p class="field-help">Sociobot is the merchant of record. The free plan still exports standard patches.</p></div></div></section>`;
}

function downloadMarkup(buttonId: string, statusId: string) {
  return `<a class="button blue" id="${buttonId}" data-download-primary href="${releasePage}">View available downloads</a><div class="macos-downloads" data-macos-downloads hidden><p class="field-help">Choose the build for your Mac.</p><div class="macos-download-actions"><a class="button secondary" data-macos-arm href="${releasePage}">Apple silicon</a><a class="button secondary" data-macos-intel href="${releasePage}">Intel Mac</a></div></div><p id="${statusId}" class="muted">Checking published releases…</p>`;
}

function landing() {
  return `${header()}<main id="main" tabindex="-1">
    <section class="hero sheet">
      <div class="hero-copy">
        <h1>Reverse the wrong agent changes</h1>
        <p class="lede">For developers supervising long agent sessions who need to recover one change without discarding the rest.</p>
        <div class="hero-actions"><a class="button" href="/?demo=1" data-route>Try it with sample data</a><span class="action-note">A loaded ledger opens next. Nothing is saved to your data.</span></div>
        <ul class="facts"><li>Project files are encrypted locally.</li><li>The demo works offline after one visit.</li><li id="pro-fact" aria-live="polite">Checking whether Pro checkout is available.</li></ul>
      </div>
      <figure class="hero-art"><img src="/assets/hero-ledger-800.webp" srcset="/assets/hero-ledger-600.webp 600w, /assets/hero-ledger-800.webp 800w" sizes="(max-width: 850px) calc(100vw - 32px), min(800px, 52vw)" width="1200" height="800" alt="A paper code ledger where one faulty strip is lifted while the others stay pinned." fetchpriority="high" decoding="async"><figcaption class="art-caption">REVERSE ONE FILE / KEEP THE REST</figcaption></figure>
    </section>
    <section class="section section-blue"><div class="sheet split"><div><p class="eyebrow">Loaded checkpoint preview</p><h2>Inspect an agent turn before reversing it</h2><p class="max-text">Each checkpoint shows the request, commands, files, and check result.</p></div>${previewMarkup()}</div></section>
    <section class="section" id="how"><div class="sheet split"><div><p class="eyebrow">How it works</p><h2>Reverse selected changes in three steps</h2></div><ol class="steps"><li><div><h3>Capture the turn</h3><p>Write the agent’s request and commands. The desktop app records the chosen project.</p></div></li><li><div><h3>Inspect the file group</h3><p>Compare the checkpoint with the current folder. Select only the files that went wrong.</p></div></li><li><div><h3>Reverse or export</h3><p>Create a safety checkpoint, reverse selected files, or export a patch for review. Patches never run themselves.</p></div></li></ol></div></section>
    <section class="section walkthrough"><div class="sheet"><p class="eyebrow">Desktop walkthrough</p><h2>See one selected file reversed</h2><ol class="walkthrough-grid"><li><img src="/assets/walkthrough-1.webp" width="900" height="620" loading="lazy" decoding="async" alt="The sample ledger with one failed session file selected."><strong>1 / Select the suspect file</strong></li><li><img src="/assets/walkthrough-2.webp" width="900" height="426" loading="lazy" decoding="async" alt="A confirmation names the selected files and safety checkpoint."><strong>2 / Confirm the safety checkpoint</strong></li><li><img src="/assets/walkthrough-3.webp" width="900" height="618" loading="lazy" decoding="async" alt="The ledger shows reversed files and a new safety checkpoint."><strong>3 / Keep the recovery record</strong></li></ol></div></section>
    <section class="section"><div class="sheet split"><div><p class="eyebrow">What stays on your device</p><h2>It does not replace Git</h2></div><div class="max-text"><p>The ledger leaves Git data out of its checkpoints. It records the folder you choose.</p><p>Checkpoint files can contain secrets. A passphrase encrypts every local snapshot and manifest. Delete a local ledger when you no longer need it. This keeps your project files unchanged.</p><p>The demo uses a separate <code>demo:</code> browser storage key. Leaving the demo removes its data.</p></div></div></section>
    ${pricingMarkup()}
    <section class="section"><div class="sheet split"><div><p class="eyebrow">Desktop app</p><h2>Choose the build for your computer</h2><p class="max-text">Desktop builds are published for macOS, Windows, and Linux. Check the release notes before installing.</p></div><div>${downloadMarkup('download-button', 'download-status')}</div></div></section>
  </main>${footer()}`;
}

function getDemoLedger(): Checkpoint[] {
  try {
    const stored = localStorage.getItem(demoKey);
    return stored ? JSON.parse(stored) as Checkpoint[] : structuredClone(sample);
  } catch { return structuredClone(sample); }
}

function saveDemoLedger(ledger: Checkpoint[]) {
  localStorage.setItem(demoKey, JSON.stringify(ledger));
}

function demoBanner() {
  return `<aside class="demo-banner" aria-label="Demo mode"><p>Demo — sample data, nothing is saved</p><div class="banner-actions"><button class="small secondary" id="reset-demo" type="button">Reset demo</button><button class="button small blue" id="exit-demo" type="button">Start for real</button></div></aside>`;
}

function operationButtons(ledger: Checkpoint[]) {
  return ledger.map(item => `<button class="operation-card" type="button" data-checkpoint="${item.id}" aria-current="${item.id === activeCheckpoint}"><strong>${escapeHtml(item.intent)}</strong><span>${item.files.length} ${item.files.length === 1 ? 'file' : 'files'} · ${item.createdAt}${item.safety ? ' · safety' : ''}</span></button>`).join('');
}

function ledgerMarkup(ledger: Checkpoint[], demo = true) {
  const cp = ledger.find(item => item.id === activeCheckpoint) ?? ledger.at(-1);
  if (!cp) return `<div class="empty-state"><div class="empty-mark" aria-hidden="true">＋</div><h2>No checkpoints yet</h2><p>Capture an agent turn to record its intent, commands, and files here.</p></div>`;
  activeCheckpoint = cp.id;
  return `<div class="ledger">
    <aside class="ledger-sidebar" aria-label="Checkpoints"><div class="ledger-sidebar-header"><h2>Checkpoint ledger</h2></div><div class="operation-list">${operationButtons(ledger)}</div></aside>
    <section class="ledger-detail" aria-labelledby="checkpoint-title"><div class="ledger-detail-header"><div><p class="eyebrow">${cp.createdAt} / ${cp.files.length} files</p><h2 id="checkpoint-title">${escapeHtml(cp.intent)}</h2></div><span class="chip ${cp.checkPassed ? 'pass' : 'warn'}">${escapeHtml(cp.checks)}</span></div>
      <div class="intent"><p class="eyebrow">Recorded intent</p><p>${escapeHtml(cp.detail)}</p></div>
      <table class="file-table"><thead><tr><th scope="col">Select file</th><th scope="col">Change</th><th scope="col">Lines</th></tr></thead><tbody>${cp.files.map(file => `<tr><td><label class="file-check"><input type="checkbox" data-file="${escapeHtml(file.path)}" ${selectedFiles.has(file.path) ? 'checked' : ''} ${file.restored ? 'disabled' : ''}><span>${escapeHtml(file.path)}${file.restored ? ' — restored' : ''}</span></label></td><td>${file.kind}</td><td><span class="change-add">+${file.additions}</span> <span class="change-remove">−${file.deletions}</span></td></tr>`).join('')}</tbody></table>
      <details class="intent"><summary>Read selected file diff</summary><div class="diff">${(cp.files.find(f => selectedFiles.has(f.path)) ?? cp.files[0])?.diff.map(line => `<div class="diff-line ${line.startsWith('+') ? 'add' : line.startsWith('-') ? 'remove' : ''}">${escapeHtml(line)}</div>`).join('') ?? ''}</div></details>
      <div class="command-trail" aria-label="Command trail"><strong>Command trail</strong>${cp.commands.map(cmd => `<code>$ ${escapeHtml(cmd)}</code>`).join('')}</div>
      <div class="ledger-actions"><button class="primary" id="restore-selected" type="button" ${selectedFiles.size ? '' : 'disabled'}>${selectedFiles.size ? `${cp.safety ? 'Restore' : 'Reverse'} ${selectedFiles.size} selected ${selectedFiles.size === 1 ? 'file' : 'files'}` : `${cp.safety ? 'Restore' : 'Reverse'} files`}</button><button class="secondary" id="export-patch" type="button" ${selectedFiles.size ? '' : 'disabled'}>Export selected patch</button><button class="secondary" id="select-all" type="button">Select all files</button>${demo ? '' : '<button class="secondary" id="refresh-checkpoint" type="button">Compare with folder</button>'}${!demo && isPro() ? '<button class="secondary" id="encrypted-export" type="button" ' + (selectedFiles.size ? '' : 'disabled') + '>Export encrypted recovery</button>' : ''}${!demo && ledger.length ? '<button class="secondary destructive" id="delete-ledger" type="button">Delete local ledger</button>' : ''}</div>
    </section></div>`;
}

function demoPage() {
  const ledger = getDemoLedger();
  if (!ledger.find(item => item.id === activeCheckpoint)) activeCheckpoint = ledger[0]?.id ?? '';
  return `${header()}${demoBanner()}<main id="main" tabindex="-1" class="app-shell"><div class="app-heading"><div><p class="eyebrow">Sample project / acme-web</p><h1>Inspect the failed session change</h1></div><span class="chip warn">2 tests need attention</span></div>${ledgerMarkup(ledger)}</main>${footer()}`;
}

function realAppPage() {
  const desktop = Boolean(window.__TAURI_INTERNALS__);
  const pro = isPro();
  return `${header()}<main id="main" tabindex="-1" class="app-shell"><div class="app-heading"><div><p class="eyebrow">Local project</p><h1>Capture an agent turn</h1></div><span class="chip ${desktop ? 'pass' : 'warn'}">${desktop ? 'Desktop ready' : 'Browser preview'}</span></div>
    <section class="capture-panel" aria-labelledby="capture-title"><h2 id="capture-title">New checkpoint</h2>${desktop ? '<div class="capture-actions"><button class="secondary" id="load-sample-project" type="button">Load sample project</button><button class="secondary" id="reset-sample-project" type="button">Reset sample project</button><button class="secondary" id="open-local-ledger" type="button">Open local ledger</button>' + (pro ? '<button class="secondary" id="open-encrypted-recovery" type="button">Open encrypted recovery</button>' : '') + '<p class="field-help">The bundled sample is stored separately from projects you choose.</p></div>' : '<p class="notice">Folder access starts in the desktop app. Download it to record a project you choose.</p>'}<form id="capture-form" class="capture-grid"><label>Project folder<input id="project-path" name="path" required placeholder="/Users/me/project" ${desktop ? '' : 'disabled'}><span class="field-help">Type the full path to one local project.</span></label><label>Agent intent<input id="checkpoint-intent" name="intent" required placeholder="Fix session refresh race" ${desktop ? '' : 'disabled'}><span class="field-help">Describe the requested result.</span></label><label>Commands<textarea id="checkpoint-commands" name="commands" rows="2" placeholder="npm test" ${desktop ? '' : 'disabled'}></textarea></label><label>Ledger passphrase<input id="ledger-passphrase" name="passphrase" type="password" minlength="12" required autocomplete="current-password" ${desktop ? '' : 'disabled'}><span class="field-help">Encrypts every local snapshot. It is never saved.</span></label><label>Retention<select id="retention" name="retention" ${desktop ? '' : 'disabled'}>${retentionOptions()}</select><span class="field-help">The oldest checkpoint is pruned safely.</span></label>${pro ? `<label>Team policy note<textarea id="team-policy" name="policy" rows="2" placeholder="Review authentication changes before reversal" ${desktop ? '' : 'disabled'}>${escapeHtml(realPolicy)}</textarea><span class="field-help">Saved in this encrypted local ledger.</span></label>` : '<p class="field-help pro-note">Pro adds 30/90 checkpoint retention and an encrypted team policy note.</p>'}<button class="primary" type="submit" ${desktop ? '' : 'disabled'}>Capture checkpoint</button></form></section>
    <div id="real-ledger">${desktop ? '<div class="empty-state"><div class="empty-mark" aria-hidden="true">＋</div><h2>No project loaded</h2><p>Load the bundled sample or capture an agent turn.</p></div>' : '<div class="empty-state"><div class="empty-mark" aria-hidden="true">⌁</div><h2>Download the desktop app</h2><p>The browser cannot read project folders. The desktop app records only the folder you choose.</p>' + downloadMarkup('app-download-button', 'app-download-status') + '</div>'}</div>
  </main>${footer()}`;
}

function legalPage(kind: 'privacy' | 'terms') {
  const privacy = `<p><strong>Effective 29 August 2026.</strong></p><h2>Project data stays local</h2><p>The desktop app reads only the project folder you enter. It does not send project files, patches, commands, or intent notes to us.</p><p>Your ledger passphrase encrypts local snapshots, manifests, retention settings, and policy notes. The passphrase stays in app memory while the ledger is open. It is not written to disk.</p><h2>Demo data is separate</h2><p>The browser demo stores its sample state under <code>${demoKey}</code>. Resetting or leaving the demo removes that state.</p><h2>Download and license checks</h2><p>The landing page asks the GitHub API for current public release files. It asks Sociobot whether Pro checkout is published. It opens hosted checkout only when you select Subscribe to Pro.</p><p>If you restore a license, the app sends that license token to Sociobot only to verify it. The app checks no more than once each day. Project files are never part of that request.</p><h2>Delete your data</h2><p>Open a local ledger in the desktop app. Choose Delete local ledger. This removes local snapshots only. It does not change files in your project folder. You can also clear this site’s browser storage. Contact <a href="mailto:privacy@sociobot.in">privacy@sociobot.in</a> with privacy questions.</p>`;
  const terms = `<p><strong>Effective 29 August 2026.</strong></p><h2>Use of the app</h2><p>You may use the app to checkpoint folders you are allowed to access. Review every reversal and patch before relying on it.</p><h2>Pro plan</h2><p>Pro adds 30 or 90 checkpoint retention, a local team policy note, and password-protected recovery export.</p><p>The price and purchase action appear only when Sociobot publishes a working checkout. An issued license can be restored on another device.</p><h2>Git and backups</h2><p>The app is not Git and is not a full backup service. Keep normal version control and backups. Git metadata is excluded from checkpoints.</p><h2>Warranty</h2><p>The software is provided under the MIT License, without warranty. You are responsible for reviewing reversed files and exported patches.</p><h2>Contact</h2><p>Send terms questions to <a href="mailto:support@sociobot.in">support@sociobot.in</a>.</p>`;
  const title = kind === 'privacy' ? 'Read the privacy policy' : 'Read the terms of use';
  return `${header()}<main id="main" tabindex="-1" class="sheet legal"><article><p class="eyebrow">${kind}</p><h1>${title}</h1>${kind === 'privacy' ? privacy : terms}</article></main>${footer()}`;
}

function notFound() {
  return `${header()}<main id="main" tabindex="-1" class="not-found sheet"><div><div class="code" aria-hidden="true">404</div><h1>This recovery sheet is missing</h1><p>The address may be wrong. Return to the ledger start page.</p><a class="button" href="/" data-route>Return home</a></div></main>${footer()}`;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]!);
}

function render(focus = false) {
  const path = currentPath();
  const meta = routeMeta[path];
  document.title = meta.title;
  document.querySelector<HTMLMetaElement>('meta[name="description"]')?.setAttribute('content', meta.description);
  document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.setAttribute('href', `https://agent-change-recovery.sociobot.in${path === '/' ? '/' : path}`);
  for (const selector of ['meta[property="og:title"]', 'meta[name="twitter:title"]']) document.querySelector<HTMLMetaElement>(selector)?.setAttribute('content', meta.title);
  for (const selector of ['meta[property="og:description"]', 'meta[name="twitter:description"]']) document.querySelector<HTMLMetaElement>(selector)?.setAttribute('content', meta.description);
  app.innerHTML = path === '/' ? landing() : path === '/demo' ? demoPage() : path === '/app' ? realAppPage() : path === '/privacy' ? legalPage('privacy') : path === '/terms' ? legalPage('terms') : notFound();
  document.querySelector('h1')?.setAttribute('tabindex', '-1');
  document.body.classList.toggle('offline', !navigator.onLine);
  if (focus) {
    const y = Number(history.state?.scrollY ?? 0);
    window.scrollTo({ top: y, behavior: 'instant' });
    const heading = document.querySelector<HTMLElement>('h1');
    if (y === 0) heading?.focus({ preventScroll: false });
  }
  if (path === '/' || path === '/app') void resolveDownload();
  if (path === '/') void resolveCheckout();
  announce(document.querySelector('h1')?.textContent ?? product);
}

function navigate(path: string) {
  history.replaceState({ ...(history.state ?? {}), scrollY: window.scrollY }, '', location.href);
  history.pushState({ scrollY: 0 }, '', path);
  render(true);
}

function announce(message: string) {
  let region = document.querySelector<HTMLDivElement>('#route-announcer');
  if (!region) {
    region = document.createElement('div');
    region.id = 'route-announcer';
    region.className = 'sr-only';
    region.setAttribute('aria-live', 'polite');
    document.body.append(region);
  }
  region.textContent = message;
}

function showToast(message: string) {
  document.querySelector('.toast')?.remove();
  const node = document.createElement('div');
  node.className = 'toast';
  node.setAttribute('role', 'status');
  node.textContent = message;
  document.body.append(node);
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => node.remove(), 5000);
}

function closeDialog(restoreFocus = true) {
  const backdrop = document.querySelector<HTMLElement>('.dialog-backdrop');
  if (!backdrop) return;
  backdrop.remove();
  const trigger = dialogReturnFocus;
  dialogReturnFocus = null;
  if (restoreFocus && trigger?.isConnected) requestAnimationFrame(() => trigger.focus());
}

function openDialog(backdrop: HTMLDivElement, initialFocus: string) {
  dialogReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  document.body.append(backdrop);
  backdrop.querySelector<HTMLElement>(initialFocus)?.focus();
}

function trapDialogFocus(event: KeyboardEvent) {
  const dialog = document.querySelector<HTMLElement>('.dialog-backdrop [role="dialog"]');
  if (!dialog || event.key !== 'Tab') return;
  const controls = [...dialog.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')]
    .filter(control => !control.hasAttribute('hidden'));
  if (!controls.length) {
    event.preventDefault();
    dialog.focus();
    return;
  }
  const first = controls[0];
  const last = controls.at(-1)!;
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function openRestoreDialog() {
  const count = selectedFiles.size;
  if (!count) return;
  const ledger = currentPath() === '/demo' ? getDemoLedger() : realLedger;
  const checkpoint = ledger.find(item => item.id === activeCheckpoint);
  const restoringSafety = Boolean(checkpoint?.safety);
  const verb = restoringSafety ? 'Restore' : 'Reverse';
  const copy = restoringSafety
    ? 'The ledger creates another safety checkpoint first. It then restores the saved pre-reversal files. Other files stay unchanged.'
    : 'The ledger creates a safety checkpoint first. Other files in this agent turn stay unchanged.';
  const backdrop = document.createElement('div');
  backdrop.className = 'dialog-backdrop';
  backdrop.innerHTML = `<div class="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title" aria-describedby="dialog-copy"><h2 id="dialog-title">${verb} ${count} selected ${count === 1 ? 'file' : 'files'}?</h2><p id="dialog-copy">${copy}</p><div class="dialog-actions"><button class="secondary" id="cancel-restore" type="button">Keep files</button><button class="primary" id="confirm-restore" type="button">Create checkpoint and ${verb.toLowerCase()}</button></div></div>`;
  openDialog(backdrop, '#cancel-restore');
}

function completeDemoRestore() {
  const ledger = getDemoLedger();
  const source = ledger.find(item => item.id === activeCheckpoint);
  if (!source) return;
  const restoringSafety = Boolean(source.safety);
  const paths = [...selectedFiles];
  source.files.forEach(file => { if (selectedFiles.has(file.path)) file.restored = true; });
  ledger.push({ id: `safe-${Date.now()}`, intent: 'Safety checkpoint before reversal', detail: `Saved the current state before reversing ${paths.length} selected ${paths.length === 1 ? 'file' : 'files'}.`, createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), commands: ['No commands run'], checks: 'Safety copy created', checkPassed: true, safety: true, files: source.files.filter(file => paths.includes(file.path)).map(file => ({ ...file, restored: false })) });
  saveDemoLedger(ledger);
  selectedFiles.clear();
  closeDialog(false);
  render();
  showToast(restoringSafety
    ? `${paths.length} ${paths.length === 1 ? 'file was' : 'files were'} restored from the safety checkpoint.`
    : `${paths.length} ${paths.length === 1 ? 'file was' : 'files were'} reversed. The safety checkpoint is in the ledger.`);
}

async function completeRestore() {
  if (currentPath() === '/demo') {
    completeDemoRestore();
    return;
  }
  const paths = [...selectedFiles];
  if (!realProjectPath || !paths.length) return;
  const safety = realLedger.find(item => item.id === activeCheckpoint)?.safety;
  const confirm = document.querySelector<HTMLButtonElement>('#confirm-restore');
  if (confirm) { confirm.disabled = true; confirm.textContent = safety ? 'Restoring safety copy…' : 'Creating safety checkpoint…'; }
  try {
    realLedger = await invoke<Checkpoint[]>('restore_files', { path: realProjectPath, checkpointId: activeCheckpoint, files: paths, passphrase: realPassphrase, pro: isPro() });
    activeCheckpoint = realLedger.at(-1)?.id ?? activeCheckpoint;
    selectedFiles.clear();
    closeDialog(false);
    refreshLedgerView();
    showToast(safety
      ? `${paths.length} ${paths.length === 1 ? 'file was' : 'files were'} restored from the safety checkpoint. Another safety checkpoint was created first.`
      : `${paths.length} ${paths.length === 1 ? 'file was' : 'files were'} reversed. A safety checkpoint was created first.`);
  } catch (error) {
    closeDialog(false);
    showToast(`The files were not reversed. ${String(error)}`);
  }
}

function exportPatch() {
  if (currentPath() === '/app') {
    void exportRealPatch();
    return;
  }
  const ledger = getDemoLedger();
  const cp = ledger.find(item => item.id === activeCheckpoint);
  if (!cp) return;
  const files = cp.files.filter(file => selectedFiles.has(file.path));
  const patch = files.map(sampleUnifiedPatch).filter(Boolean).join('\n');
  const url = URL.createObjectURL(new Blob([patch], { type: 'text/x-diff' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `recovery-${cp.id}.patch`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast(`Patch exported for ${files.length} selected ${files.length === 1 ? 'file' : 'files'}. Nothing was run.`);
}

function sampleUnifiedPatch(file: FileChange) {
  const removed = file.diff.filter(line => line.startsWith('-'));
  const added = file.diff.filter(line => line.startsWith('+'));
  if (!removed.length && !added.length) return '';
  const oldPath = file.kind === 'added' ? '/dev/null' : `a/${file.path}`;
  const newPath = file.kind === 'deleted' ? '/dev/null' : `b/${file.path}`;
  const oldStart = removed.length ? 1 : 0;
  const newStart = added.length ? 1 : 0;
  return [`diff --git a/${file.path} b/${file.path}`, `--- ${oldPath}`, `+++ ${newPath}`, `@@ -${oldStart},${removed.length} +${newStart},${added.length} @@`, ...removed, ...added].join('\n') + '\n';
}

async function exportRealPatch() {
  try {
    const target = await invoke<string>('export_patch', { path: realProjectPath, checkpointId: activeCheckpoint, files: [...selectedFiles], passphrase: realPassphrase });
    showToast(`The patch was saved to ${target}. Nothing was run.`);
  } catch (error) {
    showToast(`The patch was not exported. ${String(error)}`);
  }
}

function openEncryptionDialog() {
  const backdrop = document.createElement('div');
  backdrop.className = 'dialog-backdrop';
  backdrop.innerHTML = `<form class="dialog" id="encrypt-form" role="dialog" aria-modal="true" aria-labelledby="encrypt-title"><h2 id="encrypt-title">Encrypt this recovery</h2><p>The passphrase is not saved. Use Open encrypted recovery to turn the <code>.crl</code> file back into a patch.</p><label for="export-passphrase">Passphrase<input id="export-passphrase" name="passphrase" type="password" minlength="12" required autocomplete="new-password"><span class="field-help">Use at least 12 characters.</span></label><div class="dialog-actions"><button class="secondary" id="cancel-encrypt" type="button">Cancel export</button><button class="primary" type="submit">Save encrypted recovery</button></div></form>`;
  openDialog(backdrop, 'input');
}

async function exportEncrypted(form: HTMLFormElement) {
  const passphrase = String(new FormData(form).get('passphrase'));
  const button = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  button.disabled = true;
  button.textContent = 'Encrypting recovery…';
  try {
    const target = await invoke<string>('export_encrypted', { path: realProjectPath, checkpointId: activeCheckpoint, files: [...selectedFiles], passphrase, ledgerPassphrase: realPassphrase, pro: isPro() });
    closeDialog(false);
    showToast(`The encrypted recovery was saved to ${target}. The passphrase was not stored.`);
  } catch (error) {
    button.disabled = false;
    button.textContent = 'Save encrypted recovery';
    showToast(`The encrypted recovery was not saved. ${String(error)}`);
  }
}

function openEncryptedRecoveryDialog() {
  const backdrop = document.createElement('div');
  backdrop.className = 'dialog-backdrop';
  backdrop.innerHTML = `<form class="dialog" id="import-recovery-form" role="dialog" aria-modal="true" aria-labelledby="import-title"><h2 id="import-title">Open encrypted recovery</h2><p>Choose a <code>.crl</code> file and enter its passphrase. The ledger saves a patch for review. It never runs the patch.</p><label for="recovery-path">Recovery file path<input id="recovery-path" name="path" required placeholder="/Users/me/Downloads/recovery.crl" autocomplete="off"><span class="field-help">Type the full path to the encrypted recovery file.</span></label><label for="import-passphrase">Passphrase<input id="import-passphrase" name="passphrase" type="password" minlength="12" required autocomplete="current-password"></label><div class="dialog-actions"><button class="secondary" id="cancel-import-recovery" type="button">Cancel</button><button class="primary" type="submit">Open as patch</button></div></form>`;
  openDialog(backdrop, '#recovery-path');
}

async function importEncryptedRecovery(form: HTMLFormElement) {
  const data = new FormData(form);
  const button = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  button.disabled = true;
  button.textContent = 'Opening recovery…';
  try {
    const target = await invoke<string>('import_encrypted_recovery', {
      recoveryPath: String(data.get('path')),
      passphrase: String(data.get('passphrase'))
    });
    closeDialog(false);
    showToast(`The recovery was opened as a patch at ${target}. Nothing was run.`);
  } catch (error) {
    button.disabled = false;
    button.textContent = 'Open as patch';
    showToast(`The encrypted recovery was not opened. ${String(error)}`);
  }
}

async function restoreLicense(form: HTMLFormElement) {
  const token = String(new FormData(form).get('license') ?? '').trim();
  if (!token) return;
  licenseToken = token;
  localStorage.setItem(licenseKey, token);
  localStorage.removeItem(licenseCacheKey);
  licenseStatus = 'checking';
  render();
  await verifyLicense();
  showToast(isPro() ? 'Your Pro license is active on this device.' : 'The license could not be activated. Check the token and try again.');
}

function openDeleteLedgerDialog() {
  if (!realProjectPath || !realLedger.length) return;
  const count = realLedger.length;
  const backdrop = document.createElement('div');
  backdrop.className = 'dialog-backdrop';
  backdrop.innerHTML = `<div class="dialog" role="dialog" aria-modal="true" aria-labelledby="delete-title" aria-describedby="delete-copy"><h2 id="delete-title">Delete ${count} local ${count === 1 ? 'checkpoint' : 'checkpoints'}?</h2><p id="delete-copy">This permanently removes the local ledger snapshots. Files in ${escapeHtml(realProjectPath)} stay unchanged.</p><div class="dialog-actions"><button class="secondary" id="cancel-delete-ledger" type="button">Keep ledger</button><button class="primary destructive" id="confirm-delete-ledger" type="button">Delete local ledger</button></div></div>`;
  openDialog(backdrop, '#cancel-delete-ledger');
}

async function deleteLedger() {
  const button = document.querySelector<HTMLButtonElement>('#confirm-delete-ledger');
  if (button) { button.disabled = true; button.textContent = 'Deleting local ledger…'; }
  try {
    await invoke('delete_ledger', { path: realProjectPath });
    realLedger = [];
    selectedFiles.clear();
    activeCheckpoint = '';
    closeDialog(false);
    refreshLedgerView();
    showToast('The local ledger was deleted. Project files were unchanged.');
  } catch (error) {
    if (button) { button.disabled = false; button.textContent = 'Delete local ledger'; }
    showToast(`The local ledger was not deleted. ${String(error)}`);
  }
}

async function captureCheckpoint(form: HTMLFormElement) {
  const data = new FormData(form);
  const button = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  button.disabled = true;
  button.textContent = 'Capturing files…';
  try {
    const result = await invoke<LedgerResponse>('capture_checkpoint', {
      input: {
        path: String(data.get('path')),
        intent: String(data.get('intent')),
        commands: String(data.get('commands')).split('\n').filter(Boolean),
        passphrase: String(data.get('passphrase')),
        retention: Number(data.get('retention')),
        pro: isPro(),
        policy: String(data.get('policy') ?? '')
      }
    });
    realProjectPath = String(data.get('path'));
    realPassphrase = String(data.get('passphrase'));
    realLedger = result.ledger;
    realRetention = result.retention;
    realPolicy = result.policy;
    activeCheckpoint = result.ledger.at(-1)?.id ?? '';
    selectedFiles.clear();
    refreshLedgerView();
    showToast('Checkpoint captured in the local ledger.');
  } catch (error) {
    showToast(`The checkpoint was not captured. Check the folder path and try again. ${String(error)}`);
  } finally {
    button.disabled = false;
    button.textContent = 'Capture checkpoint';
  }
}

async function loadBundledSample(reset = false) {
  const button = document.querySelector<HTMLButtonElement>(reset ? '#reset-sample-project' : '#load-sample-project');
  if (button) { button.disabled = true; button.textContent = reset ? 'Resetting sample…' : 'Loading sample…'; }
  try {
    const form = document.querySelector<HTMLFormElement>('#capture-form');
    const data = form ? new FormData(form) : null;
    const passphrase = String(data?.get('passphrase') ?? '');
    if (!passphrase) throw new Error('Enter a local ledger passphrase before loading the sample project.');
    const result = await invoke<{ path: string; ledger: Checkpoint[]; retention: number; policy: string }>('load_sample_project', {
      reset,
      passphrase,
      retention: Number(data?.get('retention') ?? 7),
      pro: isPro()
    });
    realProjectPath = result.path;
    realLedger = result.ledger;
    realPassphrase = passphrase;
    realRetention = result.retention;
    realPolicy = result.policy;
    activeCheckpoint = result.ledger.at(-1)?.id ?? '';
    selectedFiles = new Set(result.ledger.at(-1)?.files.map(file => file.path) ?? []);
    const pathInput = document.querySelector<HTMLInputElement>('#project-path');
    if (pathInput) pathInput.value = result.path;
    refreshLedgerView();
    showToast(reset ? 'The bundled sample project was reset.' : 'The bundled sample project is loaded.');
  } catch (error) {
    showToast(`The sample project could not be loaded. ${String(error)}`);
  } finally {
    if (button) { button.disabled = false; button.textContent = reset ? 'Reset sample project' : 'Load sample project'; }
  }
}

async function openLocalLedger() {
  const path = document.querySelector<HTMLInputElement>('#project-path')?.value.trim();
  const passphrase = document.querySelector<HTMLInputElement>('#ledger-passphrase')?.value ?? '';
  if (!path) {
    showToast('Enter a project folder, then open its local ledger.');
    return;
  }
  if (!passphrase) {
    showToast('Enter the local ledger passphrase, then open its local ledger.');
    return;
  }
  try {
    const result = await invoke<LedgerResponse>('load_ledger', { path, passphrase, pro: isPro() });
    realProjectPath = path;
    realPassphrase = passphrase;
    realLedger = result.ledger;
    realRetention = result.retention;
    realPolicy = result.policy;
    activeCheckpoint = result.ledger.at(-1)?.id ?? '';
    selectedFiles.clear();
    refreshLedgerView();
    showToast(result.ledger.length ? 'The saved encrypted local ledger is open.' : 'No saved checkpoints exist for this folder.');
  } catch (error) {
    showToast(`The local ledger could not be opened. ${String(error)}`);
  }
}

function refreshLedgerView() {
  const container = document.querySelector<HTMLDivElement>('#real-ledger');
  if (container) container.innerHTML = ledgerMarkup(realLedger, false);
}

function releaseAsset(release: Release, pattern: RegExp) {
  return release.assets.find(item => pattern.test(item.name));
}

function isCurrentCompleteRelease(release: Release) {
  if (release.tag_name !== `v${appVersion}`) return false;
  const requiredAssets = [
    /(?:aarch64|arm64).*\.dmg$/i,
    /(?:x64|x86_64|amd64).*\.dmg$/i,
    /\.AppImage$/i,
    /\.deb$/i,
    /\.rpm$/i,
    /\.(?:msi|exe)$/i,
    /^SHA256SUMS$/i,
    /^latest\.json$/i
  ];
  return requiredAssets.every(pattern => release.assets.some(asset => pattern.test(asset.name)));
}

function setDownloadButtons(buttons: HTMLAnchorElement[], asset: ReleaseAsset, label: string) {
  for (const button of buttons) {
    button.href = asset.browser_download_url;
    button.textContent = label;
  }
}

function hideMacDownloadChoices() {
  for (const group of document.querySelectorAll<HTMLElement>('[data-macos-downloads]')) group.hidden = true;
}

async function resolveDownload() {
  const buttons = [...document.querySelectorAll<HTMLAnchorElement>('[data-download-primary]')];
  const statuses = [...document.querySelectorAll<HTMLElement>('#download-status, #app-download-status')];
  if (!buttons.length || !statuses.length) return;
  const os = /Win/i.test(navigator.userAgent) ? 'Windows' : /Mac/i.test(navigator.userAgent) ? 'macOS' : 'Linux';
  try {
    const cacheRaw = localStorage.getItem(releaseCacheKey);
    const cache = cacheRaw ? JSON.parse(cacheRaw) as { saved: number; value: Release } : null;
    let release: Release;
    if (cache && Date.now() - cache.saved < 3_600_000) release = cache.value;
    else {
      const response = await fetch('https://api.github.com/repos/B-Divyesh/sf-agent-change-recovery/releases/latest');
      if (!response.ok) throw new Error('No published release');
      release = await response.json() as Release;
      localStorage.setItem(releaseCacheKey, JSON.stringify({ saved: Date.now(), value: release }));
    }
    if (!isCurrentCompleteRelease(release)) throw new Error('Current desktop release is not published yet');
    if (os === 'macOS') {
      const appleSilicon = releaseAsset(release, /(?:aarch64|arm64).*(?:\.dmg|\.app\.tar\.gz)$/i);
      const intel = releaseAsset(release, /(?:x64|x86_64|amd64).*(?:\.dmg|\.app\.tar\.gz)$/i);
      if (!appleSilicon || !intel) throw new Error('Both macOS builds are not published yet');
      const prefersAppleSilicon = /(?:arm64|aarch64)/i.test(navigator.userAgent);
      const primary = prefersAppleSilicon ? appleSilicon : intel;
      setDownloadButtons(buttons, primary, `Download for macOS (${prefersAppleSilicon ? 'Apple silicon' : 'Intel'})`);
      for (const group of document.querySelectorAll<HTMLElement>('[data-macos-downloads]')) {
        group.hidden = false;
        const armLink = group.querySelector<HTMLAnchorElement>('[data-macos-arm]')!;
        const intelLink = group.querySelector<HTMLAnchorElement>('[data-macos-intel]')!;
        armLink.href = appleSilicon.browser_download_url;
        armLink.textContent = 'Apple silicon';
        intelLink.href = intel.browser_download_url;
        intelLink.textContent = 'Intel Mac';
      }
      for (const status of statuses) status.textContent = `${release.tag_name} · Choose Apple silicon or Intel.`;
      return;
    }
    hideMacDownloadChoices();
    const asset = os === 'Windows'
      ? releaseAsset(release, /\.msi$/i) ?? releaseAsset(release, /\.exe$/i)
      : releaseAsset(release, /\.AppImage$/i) ?? releaseAsset(release, /\.deb$/i);
    if (!asset) throw new Error('Platform build pending');
    setDownloadButtons(buttons, asset, `Download for ${os}`);
    for (const status of statuses) status.textContent = `${release.tag_name} · ${asset.name}`;
  } catch {
    hideMacDownloadChoices();
    for (const button of buttons) { button.href = releasePage; button.textContent = 'View release page'; }
    for (const status of statuses) status.textContent = `The ${os} download is being published. The release page shows current files.`;
  }
}

type ReleaseAsset = { name: string; browser_download_url: string };
type Release = { tag_name: string; assets: ReleaseAsset[] };
type ProductListing = { slug: string; checkout_url: string; price_minor: number; currency: string };

function setCheckoutUnavailable() {
  const action = document.querySelector<HTMLElement>('#checkout-action');
  const price = document.querySelector<HTMLElement>('#pro-price');
  const fact = document.querySelector<HTMLElement>('#pro-fact');
  if (action) action.innerHTML = '<span class="button unavailable" aria-disabled="true">Pro checkout is being enabled</span><p class="field-help">Your free ledger keeps working. Check back when the price is published.</p>';
  if (price) {
    price.hidden = true;
    price.textContent = '';
  }
  if (fact) fact.textContent = 'Pro checkout is not available yet.';
}

async function resolveCheckout() {
  const action = document.querySelector<HTMLElement>('#checkout-action');
  const price = document.querySelector<HTMLElement>('#pro-price');
  const fact = document.querySelector<HTMLElement>('#pro-fact');
  if (!action || !price || !fact) return;
  try {
    const catalogResponse = await fetch(productCatalog);
    if (!catalogResponse.ok) throw new Error('Product catalog unavailable');
    const catalog = await catalogResponse.json() as { data?: ProductListing[] };
    const listed = catalog.data?.find(item => item.slug === productSlug);
    const checkout = listed ? new URL(listed.checkout_url) : null;
    if (
      !listed ||
      listed.price_minor !== proPriceMinor ||
      listed.currency !== 'USD' ||
      checkout?.origin !== 'https://api.sociobot.in' ||
      checkout.pathname !== `/api/v1/products/${productSlug}/checkout`
    ) throw new Error('Product checkout is not published');
    price.hidden = false;
    price.innerHTML = '$15 <small>per developer / month</small>';
    fact.textContent = 'Pro costs $15 per developer each month.';
    action.innerHTML = `<a class="button" id="buy-pro" href="${escapeHtml(checkout.href)}" rel="external">Subscribe to Pro<span class="sr-only"> (opens Sociobot checkout)</span></a>`;
  } catch {
    setCheckoutUnavailable();
  }
}

document.addEventListener('click', event => {
  const target = event.target as HTMLElement;
  const route = target.closest<HTMLAnchorElement>('a[data-route]');
  if (route && route.origin === location.origin) {
    event.preventDefault();
    navigate(route.pathname + route.search + route.hash);
    return;
  }
  if (target.closest('.mobile-menu')) {
    const button = target.closest<HTMLButtonElement>('.mobile-menu')!;
    const nav = document.querySelector('.site-nav');
    const open = nav?.classList.toggle('open') ?? false;
    button.setAttribute('aria-expanded', String(open));
  }
  const checkpoint = target.closest<HTMLButtonElement>('[data-checkpoint]');
  if (checkpoint) {
    activeCheckpoint = checkpoint.dataset.checkpoint!;
    selectedFiles.clear();
    if (currentPath() === '/app') refreshLedgerView(); else render();
  }
  if (target.closest('#reset-demo')) {
    localStorage.removeItem(demoKey);
    activeCheckpoint = 'cp-3';
    selectedFiles = new Set(['src/auth/session.ts']);
    render();
    showToast('The sample ledger was reset.');
  }
  if (target.closest('#exit-demo')) {
    for (const key of Object.keys(localStorage)) if (key.startsWith('demo:')) localStorage.removeItem(key);
    activeCheckpoint = 'cp-3';
    selectedFiles = new Set(['src/auth/session.ts']);
    navigate('/app');
    showToast('Demo data was removed. Download the desktop app to start with a project.');
  }
  if (target.closest('#load-sample-project')) void loadBundledSample();
  if (target.closest('#reset-sample-project')) void loadBundledSample(true);
  if (target.closest('#open-local-ledger')) void openLocalLedger();
  if (target.closest('#select-all')) {
    const ledger = currentPath() === '/demo' ? getDemoLedger() : realLedger;
    const cp = ledger.find(item => item.id === activeCheckpoint);
    selectedFiles = new Set(cp?.files.filter(file => !file.restored).map(file => file.path) ?? []);
    if (currentPath() === '/app') refreshLedgerView(); else render();
  }
  if (target.closest('#restore-selected')) openRestoreDialog();
  if (target.closest('#cancel-restore')) closeDialog();
  if (target.classList.contains('dialog-backdrop')) closeDialog();
  if (target.closest('#confirm-restore')) void completeRestore();
  if (target.closest('#export-patch')) exportPatch();
  if (target.closest('#encrypted-export')) openEncryptionDialog();
  if (target.closest('#cancel-encrypt')) closeDialog();
  if (target.closest('#open-encrypted-recovery')) openEncryptedRecoveryDialog();
  if (target.closest('#cancel-import-recovery')) closeDialog();
  if (target.closest('#delete-ledger')) openDeleteLedgerDialog();
  if (target.closest('#cancel-delete-ledger')) closeDialog();
  if (target.closest('#confirm-delete-ledger')) void deleteLedger();
});

document.addEventListener('change', event => {
  const input = (event.target as HTMLElement).closest<HTMLInputElement>('input[data-file]');
  if (!input) return;
  if (input.checked) selectedFiles.add(input.dataset.file!); else selectedFiles.delete(input.dataset.file!);
  if (currentPath() === '/app') refreshLedgerView(); else render();
});

document.addEventListener('submit', event => {
  const form = (event.target as HTMLElement).closest<HTMLFormElement>('#capture-form');
  const encryptForm = (event.target as HTMLElement).closest<HTMLFormElement>('#encrypt-form');
  const importForm = (event.target as HTMLElement).closest<HTMLFormElement>('#import-recovery-form');
  const licenseForm = (event.target as HTMLElement).closest<HTMLFormElement>('#license-form');
  if (form) { event.preventDefault(); void captureCheckpoint(form); }
  if (encryptForm) { event.preventDefault(); void exportEncrypted(encryptForm); }
  if (importForm) { event.preventDefault(); void importEncryptedRecovery(importForm); }
  if (licenseForm) { event.preventDefault(); void restoreLicense(licenseForm); }
});

document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && document.querySelector('.dialog-backdrop')) {
    event.preventDefault();
    closeDialog();
  }
  trapDialogFocus(event);
});

if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
window.addEventListener('popstate', () => render(true));
window.addEventListener('online', () => document.body.classList.remove('offline'));
window.addEventListener('offline', () => document.body.classList.add('offline'));

history.replaceState({ ...(history.state ?? {}), scrollY: window.scrollY }, '', location.href);
initialiseLicense();
render();

if ('serviceWorker' in navigator && !window.__TAURI_INTERNALS__) {
  window.addEventListener('load', () => { void navigator.serviceWorker.register('/sw.js').catch(() => undefined); });
}
