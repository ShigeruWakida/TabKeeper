'use strict';
const saveButton=document.querySelector('#save');
const chooseButton=document.querySelector('#choose-folder');
const folderLabel=document.querySelector('#folder-label');
const restoreButton=document.querySelector('#restore');
const fileInput=document.querySelector('#file');
const preview=document.querySelector('#preview');
const status=document.querySelector('#status');
let parsed=null;
let directoryHandle=null;
let busy=false;

function report(text,error=false) { status.textContent=text;status.className=error?'error':''; }
function setBusy(value) {
  busy=value;chooseButton.disabled=value;
  saveButton.disabled=value||!directoryHandle;
  fileInput.disabled=value;
  restoreButton.disabled=value||!parsed||parsed.ordered.length===0;
}
function refreshFolder() {
  folderLabel.textContent=directoryHandle?'保存先フォルダー: '+directoryHandle.name:'保存先フォルダー: 未設定';
  setBusy(busy);
}
function openDb() {
  return new Promise((resolve,reject)=>{
    const req=indexedDB.open('tabkeeper-settings',1);
    req.onupgradeneeded=()=>req.result.createObjectStore('settings');
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error);
  });
}
async function readFolder() {
  const db=await openDb();
  try {
    return await new Promise((resolve,reject)=>{
      const req=db.transaction('settings','readonly').objectStore('settings').get('directory');
      req.onsuccess=()=>resolve(req.result||null);
      req.onerror=()=>reject(req.error);
    });
  } finally {db.close();}
}
async function persistFolder(handle) {
  const db=await openDb();
  try {
    await new Promise((resolve,reject)=>{
      const tx=db.transaction('settings','readwrite');
      tx.objectStore('settings').put(handle,'directory');
      tx.oncomplete=()=>resolve();
      tx.onerror=()=>reject(tx.error);
      tx.onabort=()=>reject(tx.error);
    });
  } finally {db.close();}
}
async function init() {
  try {
    if(typeof window.showDirectoryPicker!=='function') {
      report('このChrome環境はフォルダーへの直接保存に対応していません。',true);
      chooseButton.disabled=true;return;
    }
    directoryHandle=await readFolder();
    refreshFolder();
    if(directoryHandle && await directoryHandle.queryPermission({mode:'readwrite'})!=='granted') {
      report('保存先は記憶されています。保存ボタンを押して書き込みを再許可してください。');
    }
  } catch(error){report('保存先の読込失敗: '+error.message,true);refreshFolder();}
}
chooseButton.addEventListener('click',async()=>{
  // Must be called directly from a user gesture.
  if(busy||typeof window.showDirectoryPicker!=='function') return;
  setBusy(true);
  try {
    const selected=await window.showDirectoryPicker({mode:'readwrite',id:'tabkeeper-backup'});
    await persistFolder(selected);
    directoryHandle=selected;
    refreshFolder();
    report('保存先フォルダーを記憶しました。');
  } catch(error) {
    if(error.name!=='AbortError') report('フォルダー選択失敗: '+error.message,true);
  } finally {setBusy(false);}
});
saveButton.addEventListener('click',async()=>{
  if(busy||!directoryHandle) return;
  setBusy(true);
  try {
    // Try the permission request directly in response to the click.
    await TabKeeperFolder.requireWritePermission(directoryHandle);
    const win=await chrome.windows.getCurrent();
    const allTabs=await chrome.tabs.query({windowId:win.id});
    const tabs=TabKeeperSession.selectSourceTabs(
      allTabs, chrome.runtime.getURL('popup.html'),
      Number(new URLSearchParams(location.search).get('sourceTabId'))
    );
    const snapshot=TabKeeperSession.createSnapshot(tabs);
    // Serialize the existence check and write across all TabKeeper pages.
    const filename=await navigator.locks.request('tabkeeper-save', ()=>
      TabKeeperFolder.writeUniqueFile(
        directoryHandle,TabKeeperSession.makeFilename(new Date()),JSON.stringify(snapshot,null,2)
      )
    );
    report(snapshot.tabs.length+'タブを保存しました: '+filename);
  } catch(error) {report('保存失敗: '+error.message+'\n保存先が削除・移動された場合やアクセスできない場合は、保存先フォルダーを選択・変更してください。',true);}
  finally {setBusy(false);}
});
fileInput.addEventListener('change',async()=>{
  parsed=null;preview.hidden=true;restoreButton.disabled=true;
  const file=fileInput.files?.[0];
  if(!file) return;
  if(file.size>2*1024*1024){report('JSONは2MB以下にしてください。',true);return;}
  try {
    parsed=TabKeeperSession.parseSnapshot(JSON.parse(await file.text()));
    preview.textContent='保存: '+parsed.tabs.length+'タブ\n復元可能: '+parsed.ordered.length+'タブ\nスキップ: '+parsed.skipped+'タブ';
    preview.hidden=false;restoreButton.disabled=parsed.ordered.length===0;
    report('内容を確認して復元してください。');
  } catch(error){report('読み込み失敗: '+error.message,true);}
});
restoreButton.addEventListener('click',async()=>{
  if(busy||!parsed?.ordered.length)return;
  setBusy(true);
  try{
    const tabs=parsed.ordered;
    const win=await chrome.windows.create({url:tabs[0].url,focused:true});
    if(!win?.id||!win.tabs?.[0]?.id)throw new Error('新しいウィンドウを作成できません。');
    const ids=[win.tabs[0].id];
    if(tabs[0].pinned)await chrome.tabs.update(ids[0],{pinned:true});
    for(const tab of tabs.slice(1)){
      const created=await chrome.tabs.create({windowId:win.id,url:tab.url,pinned:tab.pinned,active:false});
      ids.push(created.id);
    }
    const active=tabs.findIndex(tab=>tab.active);
    await chrome.tabs.update(ids[active>=0?active:0],{active:true});
    report(tabs.length+'タブを新しいウィンドウに復元しました。');
  }catch(error){report('復元中にエラー: '+error.message+'\n一部のタブは既に復元されている可能性があります。',true);}
  finally{setBusy(false);}
});
init();
