// Pure, separately testable session format logic.
(function (root) {
  'use strict';
  const isRestorable = url => /^https?:\/\//i.test(url);
  function createSnapshot(tabs) {
    if (!Array.isArray(tabs) || tabs.length === 0) throw new Error('保存対象のタブがありません。');
    return {
      format: 'tabkeeper-session',
      version: 1,
      createdAt: new Date().toISOString(),
      tabs: [...tabs].sort((a, b) => a.index - b.index).map(tab => ({
        url: tab.url || tab.pendingUrl || '',
        pinned: Boolean(tab.pinned),
        active: Boolean(tab.active)
      }))
    };
  }
  function parseSnapshot(session) {
    if (!session || session.format !== 'tabkeeper-session' || session.version !== 1 ||
        !Array.isArray(session.tabs) || session.tabs.length < 1 || session.tabs.length > 500) {
      throw new Error('TabKeeper v1のJSON形式ではありません。');
    }
    const tabs = session.tabs.map((tab, i) => {
      if (!tab || typeof tab.url !== 'string' || tab.url.length > 8192 ||
          typeof tab.pinned !== 'boolean' || typeof tab.active !== 'boolean') {
        throw new Error('タブ ' + (i + 1) + ' のデータが不正です。');
      }
      return {url:tab.url, pinned:tab.pinned, active:tab.active};
    });
    const supported = tabs.filter(tab => isRestorable(tab.url));
    // Chrome pinned tabs must precede unpinned tabs. Canonicalize accordingly.
    const ordered = [...supported.filter(t => t.pinned), ...supported.filter(t => !t.pinned)];
    return {tabs, ordered, skipped:tabs.length-supported.length};
  }
  const api = {createSnapshot,parseSnapshot};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TabKeeperSession = api;
})(globalThis);
