(function(root) {
  'use strict';
  async function requireWritePermission(handle) {
    const opts = {mode: 'readwrite'};
    if (await handle.queryPermission(opts) === 'granted') return;
    if (await handle.requestPermission(opts) !== 'granted') {
      throw new Error('保存先への書き込みが許可されていません。「現在のタブをJSONに保存」を押して再許可するか、保存先フォルダーを選択・変更してください。');
    }
  }
  async function writeUniqueFile(handle, filename, contents) {
    for (let sequence = 0; sequence <= 9999; sequence++) {
      const name = root.TabKeeperSession.addSequence(filename, sequence);
      try { await handle.getFileHandle(name); continue; }
      catch (error) { if (error.name !== 'NotFoundError') throw error; }
      // Directories also occupy names; TypeMismatchError must not be treated as absent.
      const file = await handle.getFileHandle(name, {create: true});
      const writer = await file.createWritable();
      try { await writer.write(contents); await writer.close(); }
      catch (error) {
        try { await writer.abort(); }
        catch (cleanupError) { console.error('保存ストリームの中止失敗:', cleanupError); }
        throw error;
      }
      return name;
    }
    throw new Error('保存ファイル名の連番が上限に達しました。');
  }
  const api = {requireWritePermission, writeUniqueFile};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TabKeeperFolder = api;
})(globalThis);
