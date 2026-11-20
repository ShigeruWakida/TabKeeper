const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const session = require('../session.js');

// Browser boundary simulation. This does not verify Chrome permission/picker behavior.
function createPage(store, chrome) {
  const nodes = new Map();
  const document = {querySelector(id) {
    if (!nodes.has(id)) nodes.set(id, {disabled:false, files:[], addEventListener(event, fn) {this[event]=fn;}});
    return nodes.get(id);
  }};
  const indexedDB = {open(name, version) {
    assert.equal(name, 'tabkeeper-settings');assert.equal(version, 1);
    const req = {};
    queueMicrotask(() => {
      req.result = {close() {}, transaction(table, mode) {
        assert.equal(table, 'settings');
        const tx = {objectStore() {return {
          get(key) {assert.equal(key,'directory');const read={};queueMicrotask(()=>{read.result=store.handle;read.onsuccess();});return read;},
          put(handle,key) {assert.equal(key,'directory');queueMicrotask(()=>{store.handle=handle;tx.oncomplete();});}
        };}};
        return tx;
      }};
      req.onsuccess();
    });
    return req;
  }};
  const writes=[];
  const context = {
    document, indexedDB, chrome, console, URLSearchParams, Date,
    location:{search:'?sourceTabId=2'},
    navigator:{locks:{request:async(name,fn)=>{assert.equal(name,'tabkeeper-save');return fn();}}},
    window:{showDirectoryPicker:async()=>store.selected},
    TabKeeperSession:session,
    TabKeeperFolder:{requireWritePermission:async handle=>{assert.equal(handle,store.handle);},
      writeUniqueFile:async(handle,name,contents)=>{writes.push(JSON.parse(contents));return name;}}
  };
  vm.runInNewContext(fs.readFileSync(require.resolve('../popup.js'),'utf8'),context);
  return {nodes,writes};
}
const settle = () => new Promise(resolve=>setImmediate(resolve));

test('folder selection persists, reopening retrieves it, and save uses only the current window',async()=>{
  const handle={name:'Backup',queryPermission:async()=> 'granted'};
  const store={handle:null,selected:handle};
  const calls=[];
  const chrome={runtime:{getURL:()=> 'chrome-extension://test/popup.html'},
    windows:{getCurrent:async()=>({id:9})},
    tabs:{query:async options=>{calls.push(options);return [
      {id:1,index:0,url:'https://a.example',pinned:true,active:false},
      {id:2,index:1,url:'https://b.example',pinned:false,active:false},
      {id:3,index:2,url:'chrome-extension://test/popup.html?sourceTabId=2',active:true}
    ];}}
  };
  const first=createPage(store,chrome);await settle();
  await first.nodes.get('#choose-folder').click();
  assert.equal(store.handle,handle);
  assert.match(first.nodes.get('#status').textContent,/記憶しました/);
  const reopened=createPage(store,chrome);await settle();
  assert.equal(reopened.nodes.get('#save').disabled,false);
  await reopened.nodes.get('#save').click();
  await reopened.nodes.get('#save').click();
  assert.equal(calls.length,2);assert.equal(calls[0].windowId,9);
  assert.deepEqual(reopened.writes[0].tabs,[
    {url:'https://a.example',pinned:true,active:false},
    {url:'https://b.example',pinned:false,active:true}
  ]);
  store.selected={name:'Other',queryPermission:async()=> 'granted'};
  await reopened.nodes.get('#choose-folder').click();
  assert.equal(store.handle,store.selected);
});

test('legacy JSON restores in a new window with ordered pins and active tab',async()=>{
  const calls=[];
  const chrome={windows:{create:async options=>{calls.push(['window',options]);return {id:10,tabs:[{id:100}]};}},
    tabs:{update:async(id,options)=>calls.push(['update',id,options]),
      create:async options=>{calls.push(['tab',options]);return {id:101};}}};
  const page=createPage({handle:null},chrome);await settle();
  const legacy={format:'tabkeeper-session',version:1,tabs:[
    {url:'https://a.example',pinned:true,active:false},
    {url:'https://b.example',pinned:false,active:true}
  ]};
  page.nodes.get('#file').files=[{size:100,text:async()=>JSON.stringify(legacy)}];
  await page.nodes.get('#file').change();
  await page.nodes.get('#restore').click();
  assert.equal(calls[0][1].url,'https://a.example');
  assert.equal(calls[1][1],100);assert.equal(calls[1][2].pinned,true);
  assert.equal(calls[2][1].url,'https://b.example');assert.equal(calls[2][1].windowId,10);
  assert.equal(calls[3][1],101);assert.equal(calls[3][2].active,true);
});
