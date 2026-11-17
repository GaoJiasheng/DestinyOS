// Holds back the first streamed Suspense segment of an HTML response (the hidden `S:` div through
// its `$RC` reveal script) while everything else, including the Flight data, goes through, so the
// browser hydrates the shell while that boundary is still pending, as on a slow production page.
// Only requests that send `x-test-stream-delay: <ms>` (and no compression) are affected.
import { Buffer } from 'node:buffer';
import { ServerResponse } from 'node:http';
import { setTimeout } from 'node:timers';

const write = ServerResponse.prototype.write;
const end = ServerResponse.prototype.end;
const marker = Buffer.from('<div hidden id="S:');
const delayOf = (response) => Number(response.req?.headers?.['x-test-stream-delay'] ?? 0);

ServerResponse.prototype.write = function (chunk, encoding, callback) {
  if (!delayOf(this)) return write.call(this, chunk, encoding, callback);
  if (typeof encoding === 'function') [encoding, callback] = [undefined, encoding];
  let bytes = typeof chunk === 'string' ? Buffer.from(chunk, encoding) : Buffer.from(chunk);
  if (this.__released) {
    // Later boundary segments rely on the reveal runtime defined in the held one; keep their order.
    if (bytes.indexOf(marker) < 0 && bytes.indexOf('$RC(') < 0)
      return write.call(this, bytes, callback);
    this.__done = this.__done.then(() => write.call(this, bytes));
    callback?.();
    return true;
  }
  let pass = Buffer.alloc(0);
  if (!this.__holding) {
    const at = bytes.indexOf(marker);
    if (at < 0) return write.call(this, bytes, callback);
    pass = bytes.subarray(0, at);
    bytes = bytes.subarray(at);
    this.__holding = Buffer.alloc(0);
    this.__done = new Promise((resolve) => (this.__resolve = resolve));
  }
  const held = Buffer.concat([this.__holding, bytes]);
  const reveal = held.indexOf('$RC(');
  const stop = reveal < 0 ? -1 : held.indexOf('</script>', reveal);
  if (stop < 0) {
    this.__holding = held;
    if (pass.length) return write.call(this, pass, callback);
    callback?.();
    return true;
  }
  this.__released = true;
  const segment = held.subarray(0, stop + 9);
  setTimeout(() => {
    write.call(this, segment);
    this.__resolve();
  }, delayOf(this));
  return write.call(this, Buffer.concat([pass, held.subarray(stop + 9)]), callback);
};
ServerResponse.prototype.end = function (...args) {
  if (!this.__done) return end.apply(this, args);
  if (!this.__released) {
    this.__released = true;
    write.call(this, this.__holding);
    this.__resolve();
  }
  void this.__done.then(() => end.apply(this, args));
  return this;
};
