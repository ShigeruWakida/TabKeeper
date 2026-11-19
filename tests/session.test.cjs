const test = require('node:test');
const assert = require('node:assert/strict');
const {createSnapshot,parseSnapshot} = require('../session.js');

test('preserves sorted tab order, pinned flags, selected tab', () => {
  const data = createSnapshot([
    {index:2,url:'https://c.example',pinned:false,active:false},
    {index:0,url:'https://a.example',pinned:true,active:false},
    {index:1,url:'https://b.example',pinned:false,active:true}
  ]);
  const parsed = parseSnapshot(data);
  assert.deepEqual(parsed.ordered.map(t=>t.url),['https://a.example','https://b.example','https://c.example']);
  assert.deepEqual(parsed.ordered.map(t=>t.pinned),[true,false,false]);
  assert.equal(parsed.ordered[1].active,true);
});
test('skips Chrome internal pages', () => {
  const data=createSnapshot([
    {index:0,url:'chrome://settings',pinned:false,active:false},
    {index:1,url:'https://example.com',pinned:false,active:true}
  ]);
  assert.equal(parseSnapshot(data).skipped,1);
});
test('rejects bad JSON shapes', () => {
  assert.throws(()=>parseSnapshot({format:'tabkeeper-session',version:1,tabs:[]}));
  assert.throws(()=>parseSnapshot({format:'tabkeeper-session',version:1,tabs:[{url:42,pinned:false,active:false}]}));
});
