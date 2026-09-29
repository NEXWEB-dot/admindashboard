// public/admin/js/api.js
// Shared API client and UI utilities for the ANRAF Studio admin dashboard.
// All requests go to /api/admin/* and are secured by Cloudflare Access.

const BASE = '/api/admin';

async function apiFetch(path, { method = 'GET', body } = {}) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
  };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || data.message || `HTTP ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export const api = {
  status: () => apiFetch('/status'),
  products: {
    list: () => apiFetch('/products'),
    create: (product) => apiFetch('/products', { method: 'POST', body: product }),
    update: (id, product) => apiFetch(`/products/${id}`, { method: 'PUT', body: product }),
    delete: (id, confirmShrink = false) =>
      apiFetch(`/products/${id}${confirmShrink ? '?confirmShrink=true' : ''}`, { method: 'DELETE' }),
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
    const form = new FormData();
    form.append('file', file);
    if (thumbFile) form.append('thumb', thumbFile);
    const res = await fetch(`${BASE}/upload`, {
      method: 'POST',
      credentials: 'same-origin',
      body: form,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.error || `Upload failed (${res.status})`);
      err.status = res.status;
      throw err;
    }
    return data;
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

// Convert image file to WebP + WebP thumbnail in browser using OffscreenCanvas
export async function toWebP(file) {
  const img = await createImageBitmap(file);
  const MAX = 1600;
  let w = img.width, h = img.height;
  if (Math.max(w, h) > MAX) {
    if (w > h) { h = Math.round((h * MAX) / w); w = MAX; }
    else { w = Math.round((w * MAX) / h); h = MAX; }
  }
  const canvas = new OffscreenCanvas(w, h);
  canvas.getContext('2d').drawImage(img, 0, 0, w, h);
  const fullBlob = await canvas.convertToBlob({ type: 'image/webp', quality: 0.82 });

  const TH = 400;
  let tw = w, th = h;
  if (Math.max(tw, th) > TH) {
    if (tw > th) { th = Math.round((th * TH) / tw); tw = TH; }
    else { tw = Math.round((tw * TH) / th); th = TH; }
  }
  const tCanvas = new OffscreenCanvas(tw, th);
  tCanvas.getContext('2d').drawImage(img, 0, 0, tw, th);
  const thumbBlob = await tCanvas.convertToBlob({ type: 'image/webp', quality: 0.8 });

  return {
    full: new File([fullBlob], 'image.webp', { type: 'image/webp' }),
    thumb: new File([thumbBlob], 'thumb.webp', { type: 'image/webp' }),
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
