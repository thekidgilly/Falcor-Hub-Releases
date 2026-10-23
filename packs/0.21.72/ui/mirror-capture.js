// One encoding per decoded frame and format. Concurrent viewers share work; PNG analysis stays separate from JPEG viewing.
window.createMirrorCapture = function () {
  const jobs = new Map(), canvases = new Map();
  return {
    clear() { jobs.clear(); canvases.clear(); },
    take({canvas, deviceId, revision, at, mime}) {
      const key = deviceId + ':' + mime, previous = jobs.get(key);
      if (previous && (previous.pending || previous.revision === revision)) return previous.promise;
      const width = Math.min(canvas.width, 576), height = Math.round(canvas.height * width / canvas.width);
      let target = canvases.get(key);
      if (!target) { target = new OffscreenCanvas(width, height); canvases.set(key, target); }
      if (target.width !== width || target.height !== height) { target.width = width; target.height = height; }
      target.getContext('2d').drawImage(canvas, 0, 0, width, height);
      const job = {revision, pending: true, promise: null};
      job.promise = (async () => {
        try {
          const blob = await target.convertToBlob(mime === 'image/jpeg' ? {type: mime, quality: .72} : {type: 'image/png'});
          return {png: await blob.arrayBuffer(), width, height, at};
        } catch (error) { if (jobs.get(key) === job) jobs.delete(key); throw error; }
        finally { job.pending = false; }
      })();
      jobs.set(key, job); return job.promise;
    }
  };
};
