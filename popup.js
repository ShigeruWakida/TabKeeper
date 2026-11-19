'use strict';
const saveButton = document.querySelector('#save');
const restoreButton = document.querySelector('#restore');
const fileInput = document.querySelector('#file');
const preview = document.querySelector('#preview');
const status = document.querySelector('#status');
let parsed = null;

function report(text, error = false) {
  status.textContent = text;
  status.className = error ? 'error' : '';
}
function setBusy(busy) {
  saveButton.disabled = busy;
  restoreButton.disabled = busy || !parsed || parsed.ordered.length === 0;
}

saveButton.addEventListener('click', async () => {
  setBusy(true);
  try {
    const win = await chrome.windows.getCurrent();
    const tabs = await chrome.tabs.query({windowId:win.id});
    const data = TabKeeperSession.createSnapshot(tabs);
    const url = URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'TabKeeper-' + new Date().toISOString().replace(/[:.]/g,'-') + '.json';
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    report(data.tabs.length + 'タブのJSON保存を開始しました。');
  } catch (error) { report('保存失敗: ' + error.message, true); }
  finally {setBusy(false);}
});

fileInput.addEventListener('change', async () => {
  parsed = null;
  preview.hidden = true;
  restoreButton.disabled = true;
  const file = fileInput.files?.[0];
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) {report('JSONは2MB以下にしてください。',true); return;}
  try {
    parsed = TabKeeperSession.parseSnapshot(JSON.parse(await file.text()));
    preview.textContent = '保存: ' + parsed.tabs.length + 'タブ\n復元可能: ' +
      parsed.ordered.length + 'タブ\nスキップ: ' + parsed.skipped + 'タブ';
    preview.hidden = false;
    restoreButton.disabled = parsed.ordered.length === 0;
    report('内容を確認して復元してください。');
  } catch (error) {report('読み込み失敗: ' + error.message,true);}
});

restoreButton.addEventListener('click', async () => {
  if (!parsed?.ordered.length) return;
  setBusy(true);
  try {
    const tabs = parsed.ordered;
    const newWin = await chrome.windows.create({url:tabs[0].url,focused:true});
    if (!newWin?.id || !newWin.tabs?.[0]?.id) throw new Error('新しいウィンドウを作成できません。');
    const ids = [newWin.tabs[0].id];
    if (tabs[0].pinned) await chrome.tabs.update(ids[0],{pinned:true});
    for (const tab of tabs.slice(1)) {
      const created = await chrome.tabs.create({windowId:newWin.id,url:tab.url,pinned:tab.pinned,active:false});
      ids.push(created.id);
    }
    const active = tabs.findIndex(tab => tab.active);
    await chrome.tabs.update(ids[active >= 0 ? active : 0],{active:true});
    report(tabs.length + 'タブを新しいウィンドウに復元しました。');
  } catch (error) {
    report('復元中にエラー: ' + error.message + '\n一部のタブは既に復元されている可能性があります。',true);
  } finally {setBusy(false);}
});
