const test = require('node:test');
const assert = require('node:assert/strict');
globalThis.TabKeeperSession = require('../session.js');
const {requireWritePermission, writeUniqueFile} = require('../folder.js');

test('permission is checked again and only requested when necessary', async () => {
  let requests = 0;
  const handle = {queryPermission: async () => 'granted', requestPermission: async () => { requests++; return 'granted'; }};
  await requireWritePermission(handle);
  assert.equal(requests, 0);
  handle.queryPermission = async () => 'prompt';
  await requireWritePermission(handle);
  assert.equal(requests, 1);
  handle.requestPermission = async () => 'denied';
  await assert.rejects(requireWritePermission(handle), /再許可/);
});

test('repeated saves keep existing bytes and use sequential names', async () => {
  const files = new Map();
  const handle = {async getFileHandle(name, options) {
    if (!files.has(name) && !options?.create) throw new DOMException('missing', 'NotFoundError');
    return {async createWritable() {return {
      async write(contents) {files.set(name, contents);}, async close() {}, async abort() {}
    };}};
  }};
  const base = 'TabKeeper-20261120-083415.json';
  assert.equal(await writeUniqueFile(handle, base, 'first'), base);
  assert.equal(await writeUniqueFile(handle, base, 'second'), base.replace('.json', '-001.json'));
  assert.equal(await writeUniqueFile(handle, base, 'third'), base.replace('.json', '-002.json'));
  assert.deepEqual([...files.values()], ['first', 'second', 'third']);
});

test('access errors propagate without trying to create a file', async () => {
  for (const name of ['NotAllowedError', 'NotReadableError', 'TypeMismatchError']) {
    let calls = 0;
    const error = new DOMException('access failed', name);
    await assert.rejects(writeUniqueFile({async getFileHandle() {calls++; throw error;}}, 'x.json', '{}'), error);
    assert.equal(calls, 1);
  }
});

test('failed writes abort the stream and preserve the original error', async () => {
  let aborted = false;
  const failure = new Error('disk full');
  const handle = {async getFileHandle(name, options) {
    if (!options) throw new DOMException('missing', 'NotFoundError');
    return {async createWritable() {return {
      async write() {throw failure;}, async close() {}, async abort() {aborted = true;}
    };}};
  }};
  await assert.rejects(writeUniqueFile(handle, 'x.json', '{}'), failure);
  assert.equal(aborted, true);
});
