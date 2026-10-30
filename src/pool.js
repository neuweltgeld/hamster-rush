// Tiny object pools + a spatial hash. No per-frame allocation in the hot paths.
export class Pool {
  constructor(make, reset = null, cap = 1e9) { this.make = make; this.reset = reset; this.free = []; this.cap = cap; this.made = 0; }
  get() { const o = this.free.length ? this.free.pop() : (this.made++, this.make()); if (this.reset) this.reset(o); return o; }
  put(o) { this.free.push(o); }
}

/** Image pool bound to a scene: get() returns an active, visible image; put() hides it again. */
export class ImgPool {
  constructor(scene, tex = 'fx_dot') {
    this.scene = scene; this.tex = tex; this.free = []; this.live = 0;
  }
  get(tex) {
    let im = this.free.pop();
    if (!im) im = this.scene.add.image(0, 0, tex || this.tex);
    else if (tex && im.texture.key !== tex) im.setTexture(tex);
    im.setActive(true).setVisible(true).clearTint().setAlpha(1).setScale(1).setRotation(0).setBlendMode(0).setFlip(false, false).setOrigin(0.5);
    this.live++;
    return im;
  }
  put(im) { im.setActive(false).setVisible(false); this.free.push(im); this.live--; }
}

/** Uniform-grid spatial hash over entity indices (linked cells). rebuilt once per frame. */
export class Grid {
  constructor(w, h, cs, max) {
    this.cs = cs; this.cols = Math.ceil(w / cs) + 1; this.rows = Math.ceil(h / cs) + 1;
    this.head = new Int32Array(this.cols * this.rows).fill(-1); this.next = new Int32Array(max);
    this.out = new Int32Array(max); this.n = 0;
  }
  clear() { this.head.fill(-1); }
  add(i, x, y) {
    const cx = Math.max(0, Math.min(this.cols - 1, (x / this.cs) | 0)), cy = Math.max(0, Math.min(this.rows - 1, (y / this.cs) | 0));
    const c = cy * this.cols + cx; this.next[i] = this.head[c]; this.head[c] = i;
  }
  /** collect indices of entities whose cell overlaps the square [x±r, y±r] into this.out; returns count */
  query(x, y, r) {
    const cs = this.cs, x0 = Math.max(0, ((x - r) / cs) | 0), x1 = Math.min(this.cols - 1, ((x + r) / cs) | 0);
    const y0 = Math.max(0, ((y - r) / cs) | 0), y1 = Math.min(this.rows - 1, ((y + r) / cs) | 0);
    let n = 0; const out = this.out, head = this.head, next = this.next;
    for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
      for (let i = head[cy * this.cols + cx]; i !== -1; i = next[i]) out[n++] = i;
    }
    return (this.n = n);
  }
}
