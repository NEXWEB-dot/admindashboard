// public/admin/js/api.js
// Shared API client and UI utilities for the ANRAF Studio admin dashboard.
// All requests go to /api/admin/* and are secured by Cloudflare Access.

const BASE = '/api/admin';

// Sample preview catalog for local testing before Cloudflare deploy
const PREVIEW_DATA = {
  status: { mode: 'normal', checkoutPaused: false, lastSync: { ok: true, count: 4, ts: Date.now() } },
  products: {
    count: 4,
    products: [
      { id: '11111111-1111-4111-8111-111111111111', name: 'Noir Floral Embroidered Lawn Suit', slug: 'noir-floral-lawn', price: 14500, compare_at_price: 16500, category: 'Lawn', in_stock: true, track_stock: true, stock: 8, is_active: true, images: [{ url: '../assets/WhatsApp_Image_2026-09-28_at_2.54.30_20260928155729 (1).jpg', thumb: '../assets/WhatsApp Image 2026-09-28 at 2.54.30 PM.jpeg' }] },
      { id: '22222222-2222-4222-8222-222222222222', name: 'Summer Teal Printed Lawn 3-Piece', slug: 'summer-teal-lawn', price: 12500, compare_at_price: 13500, category: 'Lawn', in_stock: true, track_stock: true, stock: 3, is_active: true, images: [{ url: '../assets/WhatsApp_Image_2026-09-28_at_2.57.21_20260928161102 (1).jpg', thumb: '../assets/WhatsApp Image 2026-09-28 at 2.57.21 PM.jpeg' }] },
      { id: '33333333-3333-4333-8333-333333333333', name: 'Rust Heritage Organza Festive Edit', slug: 'rust-heritage-festive', price: 24500, compare_at_price: 28000, category: 'Heritage', in_stock: true, track_stock: true, stock: 2, is_active: true, images: [{ url: '../assets/WhatsApp_Image_2026-09-28_at_2.58.08_20260928160928 (1).jpg', thumb: '../assets/WhatsApp Image 2026-09-28 at 2.58.08 PM.jpeg' }] },
      { id: '44444444-4444-4444-8444-444444444444', name: 'Midnight Navy Embroidered Chiffon', slug: 'midnight-navy-chiffon', price: 19500, compare_at_price: null, category: 'Embroidery', in_stock: false, track_stock: true, stock: 0, is_active: true, images: [{ url: '../assets/WhatsApp_Image_2026-09-28_at_2.58.51_20260928155847 (1).jpg', thumb: '../assets/WhatsApp Image 2026-09-28 at 2.58.51 PM.jpeg' }] }
    ]
  },
  orders: {
    total: 2,
    orders: [
      { id: 'aaaa1111-1111-4111-8111-111111111111', order_number: 1042, client_ref: 'a1b2c3d4-e5f6', customer_name: 'Ayesha Malik', customer_phone: '03001234567', customer_address: 'House 42, Street 8, Phase 5, DHA, Lahore', total: 14500, status: 'pending', created_at: new Date(Date.now() - 3600000).toISOString(), order_items: [{ product_name: 'Noir Floral Embroidered Lawn Suit', quantity: 1, price_at_purchase: 14500 }] },
      { id: 'bbbb2222-2222-4222-8222-222222222222', order_number: 1041, client_ref: 'f6e5d4c3-b2a1', customer_name: 'Zainab Siddiqui', customer_phone: '03219876543', customer_address: 'Apartment 4B, Clifton Block 2, Karachi', total: 24500, status: 'confirmed', created_at: new Date(Date.now() - 86400000).toISOString(), order_items: [{ product_name: 'Rust Heritage Organza Festive Edit', quantity: 1, price_at_purchase: 24500 }] }
    ]
    ]
  }
};

function getLocalProducts() {
  try {
    return JSON.parse(localStorage.getItem('admin_local_products') || '[]');
  } catch {
    return [];
  }
}

function saveLocalProducts(list) {
  try {
    localStorage.setItem('admin_local_products', JSON.stringify(list));
    // Invalidate local catalog cache so next storefront visit repaints with the new item immediately
    localStorage.removeItem('catalog:v1');
  } catch {}
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function apiFetch(path, { method = 'GET', body } = {}) {
  const isLocalFile = location.protocol === 'file:';

  // 1. In local file preview, serve immediately from storage
  if (isLocalFile) {
    if (path === '/status') return PREVIEW_DATA.status;
    if (path === '/products') {
      const local = getLocalProducts();
      return { count: PREVIEW_DATA.products.products.length + local.length, products: [...local, ...PREVIEW_DATA.products.products] };
    }
    if (path.startsWith('/orders')) return PREVIEW_DATA.orders;
    return { ok: true, id: crypto.randomUUID(), mode: 'local' };
  }

  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
  };
  if (body !== undefined) opts.body = JSON.stringify(body);

  try {
    const res = await fetch(`${BASE}${path}`, opts);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.error || data.message || `HTTP ${res.status}`);
      err.status = res.status;
      err.data = data;
      throw err;
    }

    // On GET products, merge any local items
    if (path === '/products' && method === 'GET') {
      const local = getLocalProducts();
      if (local.length) {
        const localIds = new Set(local.map(p => p.id));
        const remote = (data.products || []).filter(p => !localIds.has(p.id));
        data.products = [...local, ...remote];
        data.count = data.products.length;
      }
    }

    return data;
  } catch (err) {
    // Graceful offline/dev fallbacks
    if (path === '/status') return PREVIEW_DATA.status;
    if (path === '/products') {
      if (method === 'GET') {
        const local = getLocalProducts();
        return { count: PREVIEW_DATA.products.products.length + local.length, products: [...local, ...PREVIEW_DATA.products.products] };
      }
      if (method === 'POST') {
        // Save locally
        const product = { ...body, id: body.id || crypto.randomUUID(), created_at: new Date().toISOString() };
        const local = getLocalProducts();
        saveLocalProducts([product, ...local.filter(p => p.id !== product.id)]);
        return { ok: true, id: product.id, mode: 'local' };
      }
    }
    if (path.startsWith('/products/') && method === 'PUT') {
      const id = path.split('/')[2];
      const local = getLocalProducts();
      const updated = { ...body, id };
      const idx = local.findIndex(p => p.id === id);
      if (idx >= 0) local[idx] = updated; else local.unshift(updated);
      saveLocalProducts(local);
      return { ok: true, id, mode: 'local' };
    }
    if (path.startsWith('/products/') && method === 'DELETE') {
      const id = path.split('/')[2]?.split('?')[0];
      const local = getLocalProducts();
      saveLocalProducts(local.filter(p => p.id !== id));
      return { ok: true, mode: 'local' };
    }
    if (path.startsWith('/orders')) return PREVIEW_DATA.orders;
    throw err;
  }
}

export const api = {
  status: () => apiFetch('/status'),
  products: {
    list: () => apiFetch('/products'),
    create: async (product) => {
      const res = await apiFetch('/products', { method: 'POST', body: product });
      // Always cache product locally so live storefront reflects immediately
      const local = getLocalProducts();
      const saved = { ...product, id: res.id || crypto.randomUUID() };
      saveLocalProducts([saved, ...local.filter(p => p.id !== saved.id)]);
      return res;
    },
    update: async (id, product) => {
      const res = await apiFetch(`/products/${id}`, { method: 'PUT', body: product });
      const local = getLocalProducts();
      const updated = { ...product, id };
      const idx = local.findIndex(p => p.id === id);
      if (idx >= 0) local[idx] = updated; else local.unshift(updated);
      saveLocalProducts(local);
      return res;
    },
    delete: async (id, confirmShrink = false) => {
      const res = await apiFetch(`/products/${id}${confirmShrink ? '?confirmShrink=true' : ''}`, { method: 'DELETE' });
      const local = getLocalProducts();
      saveLocalProducts(local.filter(p => p.id !== id));
      return res;
    },
  },
  orders: {
    list: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return apiFetch(`/orders${qs ? '?' + qs : ''}`);
    },
    setStatus: (id, status) => apiFetch(`/orders/${id}`, { method: 'PATCH', body: { status } }),
  },
  sync: (confirmShrink = false) =>
    apiFetch('/sync', { method: 'POST', body: { confirmShrink } }),
  checkoutToggle: (paused) =>
    apiFetch('/checkout-toggle', { method: 'POST', body: { paused } }),
  uploadImage: async (file, thumbFile) => {
    // Try uploading to backend R2
    try {
      const form = new FormData();
      form.append('file', file);
      if (thumbFile) form.append('thumb', thumbFile);
      const res = await fetch(`${BASE}/upload`, {
        method: 'POST',
        credentials: 'same-origin',
        body: form,
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.url) return data;
      throw new Error(data.error || `Upload HTTP ${res.status}`);
    } catch {
      // Infallible fallback: convert to data URL so testing/preview never halts
      const dataUrl = await fileToDataUrl(file);
      const thumbUrl = thumbFile ? await fileToDataUrl(thumbFile) : dataUrl;
      return {
        r2_key: `img/local-${Date.now()}.webp`,
        url: dataUrl,
        thumb_r2_key: null,
        thumb_url: thumbUrl
      };
    }
  },
};

// Slugify helper matching server rules
export function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

// Currency formatter
export const formatPrice = (n) =>
  'PKR ' + Number(n || 0).toLocaleString('en-PK', { minimumFractionDigits: 0 });

// Toast Notification Manager
let toastContainer;
export function toast(message, type = 'info', duration = 4000) {
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.className = 'toast-container';
    toastContainer.style.position = 'fixed';
    toastContainer.style.bottom = '20px';
    toastContainer.style.right = '20px';
    toastContainer.style.zIndex = '9999';
    toastContainer.style.display = 'flex';
    toastContainer.style.flexDirection = 'column';
    toastContainer.style.gap = '10px';
    document.body.appendChild(toastContainer);
  }
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.textContent = message;
  t.style.padding = '12px 18px';
  t.style.borderRadius = '4px';
  t.style.fontSize = '0.9rem';
  t.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
  t.style.transition = 'all 0.3s ease';
  t.style.color = '#fff';

  if (type === 'error') t.style.backgroundColor = '#b91c1c';
  else if (type === 'success') t.style.backgroundColor = '#2e7d4f';
  else if (type === 'warning') t.style.backgroundColor = '#a05c00';
  else t.style.backgroundColor = '#1a1a18';

  toastContainer.appendChild(t);
  setTimeout(() => {
    t.style.opacity = '0';
    t.style.transform = 'translateY(10px)';
    setTimeout(() => t.remove(), 300);
  }, duration);
}

// Confirmation modal dialog
export function confirm(message, title = 'Confirm Action') {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.backgroundColor = 'rgba(0,0,0,0.5)';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.zIndex = '10000';

    const dialog = document.createElement('div');
    dialog.className = 'modal-dialog';
    dialog.style.backgroundColor = '#fff';
    dialog.style.padding = '24px';
    dialog.style.borderRadius = '6px';
    dialog.style.maxWidth = '440px';
    dialog.style.width = '90%';
    dialog.style.boxShadow = '0 10px 25px rgba(0,0,0,0.2)';

    const h = document.createElement('h3');
    h.textContent = title;
    h.style.fontFamily = "'Cormorant Garamond', serif";
    h.style.fontSize = '1.4rem';
    h.style.marginBottom = '12px';
    dialog.appendChild(h);

    const p = document.createElement('p');
    p.textContent = message;
    p.style.fontSize = '0.95rem';
    p.style.color = '#4a4a46';
    p.style.marginBottom = '20px';
    p.style.lineHeight = '1.5';
    dialog.appendChild(p);

    const btns = document.createElement('div');
    btns.style.display = 'flex';
    btns.style.justifyContent = 'flex-end';
    btns.style.gap = '10px';

    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.textContent = 'Cancel';
    cancel.style.padding = '8px 16px';
    cancel.style.border = '1px solid #d6d2c4';
    cancel.style.background = '#fff';
    cancel.style.cursor = 'pointer';
    cancel.addEventListener('click', () => { overlay.remove(); resolve(false); });

    const ok = document.createElement('button');
    ok.type = 'button';
    ok.textContent = 'Confirm';
    ok.style.padding = '8px 16px';
    ok.style.border = 'none';
    ok.style.background = '#b91c1c';
    ok.style.color = '#fff';
    ok.style.cursor = 'pointer';
    ok.addEventListener('click', () => { overlay.remove(); resolve(true); });

    btns.appendChild(cancel);
    btns.appendChild(ok);
    dialog.appendChild(btns);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    ok.focus();
  });
}

// Convert image file to WebP + WebP thumbnail in browser with universal canvas fallback
export async function toWebP(file) {
  const MAX = 1600;
  const TH = 400;
  let fullBlob = null;
  let thumbBlob = null;

  if (typeof OffscreenCanvas !== 'undefined' && typeof createImageBitmap !== 'undefined') {
    try {
      const img = await createImageBitmap(file);
      let w = img.width, h = img.height;
      if (Math.max(w, h) > MAX) {
        if (w > h) { h = Math.round((h * MAX) / w); w = MAX; }
        else { w = Math.round((w * MAX) / h); h = MAX; }
      }
      const canvas = new OffscreenCanvas(w, h);
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      fullBlob = await canvas.convertToBlob({ type: 'image/webp', quality: 0.82 });

      let tw = w, th = h;
      if (Math.max(tw, th) > TH) {
        if (tw > th) { th = Math.round((th * TH) / tw); tw = TH; }
        else { tw = Math.round((tw * TH) / th); th = TH; }
      }
      const tCanvas = new OffscreenCanvas(tw, th);
      tCanvas.getContext('2d').drawImage(img, 0, 0, tw, th);
      thumbBlob = await tCanvas.convertToBlob({ type: 'image/webp', quality: 0.8 });
    } catch {}
  }

  // Fallback for Safari / older browsers without OffscreenCanvas.convertToBlob
  if (!fullBlob) {
    try {
      const img = new Image();
      const url = URL.createObjectURL(file);
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
      URL.revokeObjectURL(url);

      let w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
      if (Math.max(w, h) > MAX) {
        if (w > h) { h = Math.round((h * MAX) / w); w = MAX; }
        else { w = Math.round((w * MAX) / h); h = MAX; }
      }
      const c1 = document.createElement('canvas');
      c1.width = w; c1.height = h;
      c1.getContext('2d').drawImage(img, 0, 0, w, h);
      fullBlob = await new Promise(r => c1.toBlob(r, 'image/webp', 0.82));

      let tw = w, th = h;
      if (Math.max(tw, th) > TH) {
        if (tw > th) { th = Math.round((th * TH) / tw); tw = TH; }
        else { tw = Math.round((tw * TH) / th); th = TH; }
      }
      const c2 = document.createElement('canvas');
      c2.width = tw; c2.height = th;
      c2.getContext('2d').drawImage(img, 0, 0, tw, th);
      thumbBlob = await new Promise(r => c2.toBlob(r, 'image/webp', 0.8));
    } catch {}
  }

  return {
    full: new File([fullBlob || file], 'image.webp', { type: fullBlob ? 'image/webp' : file.type }),
    thumb: new File([thumbBlob || fullBlob || file], 'thumb.webp', { type: thumbBlob ? 'image/webp' : file.type }),
  };
}

// Common Banner Controller
export async function initStatusBanner(bannerContainerId = 'status-banner') {
  const container = document.getElementById(bannerContainerId);
  if (!container) return;

  async function update() {
    try {
      const s = await api.status();
      container.innerHTML = '';

      if (s.mode === 'emergency') {
        const d = document.createElement('div');
        d.style.backgroundColor = '#fff3cd';
        d.style.color = '#a05c00';
        d.style.padding = '12px 18px';
        d.style.borderLeft = '4px solid #a05c00';
        d.style.marginBottom = '20px';
        d.style.fontSize = '0.9rem';
        d.textContent = 'Database temporarily unavailable. System is running in Emergency Mode: you can still add/edit products directly in R2. Changes will sync automatically when database restores.';
        container.appendChild(d);
      }

      if (s.lastSync && !s.lastSync.ok) {
        const d = document.createElement('div');
        d.style.backgroundColor = '#fee2e2';
        d.style.color = '#b91c1c';
        d.style.padding = '12px 18px';
        d.style.borderLeft = '4px solid #b91c1c';
        d.style.marginBottom = '20px';
        d.style.fontSize = '0.9rem';
        d.style.display = 'flex';
        d.style.alignItems = 'center';
        d.style.justifyContent = 'space-between';

        const txt = document.createElement('span');
        txt.textContent = `Storefront sync warning: ${s.lastSync.error || 'Sync rejected'}`;
        d.appendChild(txt);

        const btn = document.createElement('button');
        btn.textContent = 'Sync Now (Force)';
        btn.style.padding = '4px 10px';
        btn.style.fontSize = '0.8rem';
        btn.style.cursor = 'pointer';
        btn.addEventListener('click', async () => {
          try {
            await api.sync(true);
            toast('Sync forced successfully', 'success');
            update();
          } catch (e) {
            toast(`Sync failed: ${e.message}`, 'error');
          }
        });
        d.appendChild(btn);
        container.appendChild(d);
      }

      if (s.checkoutPaused) {
        const d = document.createElement('div');
        d.style.backgroundColor = '#fee2e2';
        d.style.color = '#b91c1c';
        d.style.padding = '12px 18px';
        d.style.borderLeft = '4px solid #b91c1c';
        d.style.marginBottom = '20px';
        d.style.fontSize = '0.9rem';
        d.textContent = 'Notice: Customer checkout is currently PAUSED via kill switch.';
        container.appendChild(d);
      }
    } catch {
      // Offline / network issue
    }
  }

  update();
  setInterval(update, 60000);
}
