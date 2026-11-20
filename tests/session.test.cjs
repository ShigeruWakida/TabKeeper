const test=require('node:test');
const assert=require('node:assert/strict');
const {createSnapshot,parseSnapshot,makeFilename,addSequence}=require('../session.js');
test('preserves tab order, pinning and active tab',()=>{
  const data=createSnapshot([
    {index:2,url:'https://c.example',pinned:false,active:false},
    {index:0,url:'https://a.example',pinned:true,active:false},
    {index:1,url:'https://b.example',pinned:false,active:true}
  ]);
  const parsed=parseSnapshot(data);
  assert.deepEqual(parsed.ordered.map(t=>t.url),['https://a.example','https://b.example','https://c.example']);
  assert.deepEqual(parsed.ordered.map(t=>t.pinned),[true,false,false]);
  assert.equal(parsed.ordered[1].active,true);
});
test('skips Chrome internal pages',()=>{
  const data=createSnapshot([{index:0,url:'chrome://settings',pinned:false,active:false},{index:1,url:'https://example.com',pinned:false,active:true}]);
  assert.equal(parseSnapshot(data).skipped,1);
});
test('rejects invalid JSON',()=>{
  assert.throws(()=>parseSnapshot({format:'tabkeeper-session',version:1,tabs:[]}));
});
test('local filename has seconds, no milliseconds',()=>{
  const d=new Date(2026,10,20,8,34,15,978);
  assert.equal(makeFilename(d),'TabKeeper-20261120-083415.json');
});
test('repeated filename receives a sequence number',()=>{
  const base='TabKeeper-20261120-083415.json';
  assert.equal(addSequence(base,0),base);
  assert.equal(addSequence(base,1),'TabKeeper-20261120-083415-001.json');
  assert.equal(addSequence(base,2),'TabKeeper-20261120-083415-002.json');
});
