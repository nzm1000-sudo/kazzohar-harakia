// The file side of the offline packs: the app's private data directory (@capacitor/filesystem, Directory.Data —
// never a shared folder, never iCloud documents). Loaded only when a download is actually started.
export async function createCapacitorPackFs() {
  const { Filesystem, Directory } = await import('@capacitor/filesystem');
  const toBase64 = bytes => {
    let binary = '';
    const step = 0x8000;
    for (let i = 0; i < bytes.length; i += step) binary += String.fromCharCode(...bytes.subarray(i, i + step));
    return btoa(binary);
  };
  return {
    async write(path, bytes) {
      await Filesystem.writeFile({ path, data: toBase64(bytes), directory: Directory.Data, recursive: true });
    },
    async remove(path) {
      await Filesystem.rmdir({ path, directory: Directory.Data, recursive: true }).catch(() => Filesystem.deleteFile({ path, directory: Directory.Data }));
    },
  };
}
