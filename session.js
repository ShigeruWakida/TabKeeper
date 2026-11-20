// Pure, separately testable session format logic.
(function (root) {
  'use strict';
  const isRestorable = url => /^https?:\/\//i.test(url);
  function createSnapshot(tabs) {
    if (!Array.isArray(tabs) || tabs.length === 0) throw new Error('保存対象のタブがありません。');
    return {
      format: 'tabkeeper-session', version: 1, createdAt: new Date().toISOString(),
      tabs: [...tabs].sort((a,b) => a.index-b.index).map(tab => ({
        url:tab.url || tab.pendingUrl || '', pinned:Boolean(tab.pinned), active:Boolean(tab.active)
      }))
    };
  }
  function parseSnapshot(session) {
    if (!session || session.format !== 'tabkeeper-session' || session.version !== 1 ||
        !Array.isArray(session.tabs) || session.tabs.length < 1 || session.tabs.length > 500) {
      throw new Error('TabKeeper v1のJSON形式ではありません。');
    }
    const tabs=session.tabs.map((tab,i) => {
      if (!tab || typeof tab.url !== 'string' || tab.url.length > 8192 ||
          typeof tab.pinned !== 'boolean' || typeof tab.active !== 'boolean') {
        throw new Error('タブ ' + (i+1) + ' のデータが不正です。');
      }
      return {url:tab.url,pinned:tab.pinned,active:tab.active};
    });
    const supported=tabs.filter(tab=>isRestorable(tab.url));
    const ordered=[...supported.filter(t=>t.pinned),...supported.filter(t=>!t.pinned)];
    return {tabs,ordered,skipped:tabs.length-supported.length};
  }
  function selectSourceTabs(tabs, pageUrl, sourceTabId) {
    const isPage = tab => tab.url?.split('?')[0] === pageUrl;
    const pageActive = tabs.some(tab => isPage(tab) && tab.active);
    const selected = tabs.filter(tab => !isPage(tab)).map(tab => ({...tab}));
    if (pageActive && selected.length) {
      const active = selected.find(tab => tab.id === sourceTabId) || selected[0];
      for (const tab of selected) tab.active = tab === active;
    }
    return selected;
  }
  function makeFilename(date) {
    if (!(date instanceof Date) || !Number.isFinite(date.getTime())) throw new Error('日時が不正です。');
    const p=n=>String(n).padStart(2,'0');
    return 'TabKeeper-'+date.getFullYear()+p(date.getMonth()+1)+p(date.getDate())+
      '-'+p(date.getHours())+p(date.getMinutes())+p(date.getSeconds())+'.json';
  }
  function addSequence(filename,sequence) {
    if (!Number.isInteger(sequence) || sequence<0 || sequence>99999) throw new Error('連番が不正です。');
    return sequence===0 ? filename : filename.replace(/\.json$/, '-' + String(sequence).padStart(3,'0') + '.json');
  }
  const api={createSnapshot,parseSnapshot,makeFilename,addSequence,selectSourceTabs};
  if(typeof module!=='undefined'&&module.exports) module.exports=api;
  else root.TabKeeperSession=api;
})(globalThis);
