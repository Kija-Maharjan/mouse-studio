const products = [
  {
    id: 0,
    name: 'Standard 400mm x 450mm',
    size: '400mm x 450mm',
    sizeClass: 'size-standard',
    label: '400mm x 450mm',
    // aspect for canvas: width / height
    aspect: 400 / 450
  },
  {
    id: 1,
    name: 'Desk Mat 700mm x 300mm',
    size: '700mm x 300mm',
    sizeClass: 'size-desk',
    label: '700mm x 300mm',
    aspect: 700 / 300
  },
  {
    id: 2,
    name: 'XL Desk mat 900mm x 400 mm',
    size: '900mm x 400 mm',
    sizeClass: 'size-xl',
    label: '900mm x 400 mm',
    aspect: 900 / 400
  }
];

let currentIndex = 0;
let selectedFile = null;
let originalImage = null;      // HTMLImageElement of original upload
let tweakedDataUrl = null;     // final composited image after tweak
let lastOrderData = null;

// Transform state for the editor
let transform = {
  scale: 1,
  offsetX: 0,
  offsetY: 0
};

// Drag state
let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;
let dragOriginOffsetX = 0;
let dragOriginOffsetY = 0;

// DOM
const productPreview = document.getElementById('productPreview');
const sizeLabel = document.getElementById('sizeLabel');
const productBadge = document.getElementById('productBadge');
const dots = document.querySelectorAll('.dot');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('fileInput');
const dropzoneContent = document.getElementById('dropzoneContent');
const previewImageWrap = document.getElementById('previewImageWrap');
const previewImage = document.getElementById('previewImage');
const removeImageBtn = document.getElementById('removeImage');
const placeOrderBtn = document.getElementById('placeOrderBtn');
const tweakBtn = document.getElementById('tweakBtn');
const modalOverlay = document.getElementById('modalOverlay');
const modalOrderNumber = document.getElementById('modalOrderNumber');
const modalOrderSize = document.getElementById('modalOrderSize');
const modalProductShape = document.getElementById('modalProductShape');
const downloadLink = document.getElementById('downloadLink');
const confirmBtn = document.getElementById('confirmBtn');

// Tweak editor DOM
const tweakOverlay = document.getElementById('tweakOverlay');
const tweakClose = document.getElementById('tweakClose');
const tweakCancel = document.getElementById('tweakCancel');
const tweakApply = document.getElementById('tweakApply');
const tweakCanvas = document.getElementById('tweakCanvas');
const zoomSlider = document.getElementById('zoomSlider');
const offsetXSlider = document.getElementById('offsetXSlider');
const offsetYSlider = document.getElementById('offsetYSlider');
const zoomValue = document.getElementById('zoomValue');
const offsetXValue = document.getElementById('offsetXValue');
const offsetYValue = document.getElementById('offsetYValue');
const fitBtn = document.getElementById('fitBtn');
const coverBtn = document.getElementById('coverBtn');
const resetBtn = document.getElementById('resetBtn');

const ctx = tweakCanvas.getContext('2d');

function updateProduct() {
  const product = products[currentIndex];
  productPreview.className = 'product-preview ' + product.sizeClass;
  sizeLabel.textContent = product.label;
  productBadge.textContent = product.name;

  dots.forEach((dot, i) => {
    dot.classList.toggle('active', i === currentIndex);
  });

  modalProductShape.className = 'modal-product-shape ' + product.sizeClass;

  // Re-apply current image (original or tweaked) to previews
  applyImageToPreviews();
}

function showProduct(index) {
  currentIndex = (index + products.length) % products.length;
  updateProduct();
}

prevBtn.addEventListener('click', () => showProduct(currentIndex - 1));
nextBtn.addEventListener('click', () => showProduct(currentIndex + 1));
dots.forEach(dot => {
  dot.addEventListener('click', () => showProduct(parseInt(dot.dataset.index)));
});

// ---------- Upload ----------
dropzone.addEventListener('click', (e) => {
  if (e.target !== removeImageBtn && !removeImageBtn.contains(e.target)) {
    fileInput.click();
  }
});

dropzone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropzone.classList.add('dragover');
});

dropzone.addEventListener('dragleave', () => {
  dropzone.classList.remove('dragover');
});

dropzone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropzone.classList.remove('dragover');
  if (e.dataTransfer.files.length) {
    handleFile(e.dataTransfer.files[0]);
  }
});

fileInput.addEventListener('change', () => {
  if (fileInput.files.length) {
    handleFile(fileInput.files[0]);
  }
});

function handleFile(file) {
  if (!file.type.startsWith('image/')) {
    alert('Please upload an image file.');
    return;
  }
  selectedFile = file;
  tweakedDataUrl = null;
  transform = { scale: 1, offsetX: 0, offsetY: 0 };

  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      originalImage = img;
      previewImage.src = e.target.result;
      dropzoneContent.style.display = 'none';
      previewImageWrap.style.display = 'flex';
      tweakBtn.style.display = 'block';
      applyImageToPreviews();
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

removeImageBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  selectedFile = null;
  originalImage = null;
  tweakedDataUrl = null;
  fileInput.value = '';
  previewImage.src = '';
  dropzoneContent.style.display = 'block';
  previewImageWrap.style.display = 'none';
  tweakBtn.style.display = 'none';
  productPreview.innerHTML = '';
  modalProductShape.innerHTML = '';
});

function applyImageToPreviews() {
  const src = tweakedDataUrl || (originalImage ? originalImage.src : null);
  if (!src) {
    productPreview.innerHTML = '';
    modalProductShape.innerHTML = '';
    return;
  }
  productPreview.innerHTML = `<img src="${src}" alt="Artwork">`;
  modalProductShape.innerHTML = `<img src="${src}" alt="Artwork">`;
}

// ---------- Tweak Editor ----------
tweakBtn.addEventListener('click', openTweakEditor);
tweakClose.addEventListener('click', closeTweakEditor);
tweakCancel.addEventListener('click', closeTweakEditor);

function openTweakEditor() {
  if (!originalImage) return;
  tweakOverlay.style.display = 'flex';
  // Default to Cover so the image fills the pad
  setCover();
  drawTweakCanvas();
  updateSliderUI();
}

function closeTweakEditor() {
  tweakOverlay.style.display = 'none';
}

function getPadSize() {
  // Logical pad size for the canvas (keep aspect, reasonable pixels)
  const product = products[currentIndex];
  const maxW = 560;
  const maxH = 420;
  let w, h;
  if (product.aspect >= 1) {
    w = maxW;
    h = Math.round(maxW / product.aspect);
  } else {
    h = maxH;
    w = Math.round(maxH * product.aspect);
  }
  return { w, h };
}

function drawTweakCanvas() {
  if (!originalImage) return;

  const { w: padW, h: padH } = getPadSize();
  const dpr = window.devicePixelRatio || 1;

  tweakCanvas.width = padW * dpr;
  tweakCanvas.height = padH * dpr;
  tweakCanvas.style.width = padW + 'px';
  tweakCanvas.style.height = padH + 'px';

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, padW, padH);

  // Black pad background
  const radius = Math.max(10, Math.min(padW, padH) * 0.04);
  ctx.fillStyle = '#1a1a1a';
  roundRect(ctx, 0, 0, padW, padH, radius);
  ctx.fill();

  // Clip to rounded pad
  ctx.save();
  roundRect(ctx, 0, 0, padW, padH, radius);
  ctx.clip();

  // Compute image draw size based on scale (scale 1 = cover)
  const img = originalImage;
  const coverScale = Math.max(padW / img.width, padH / img.height);
  const drawW = img.width * coverScale * transform.scale;
  const drawH = img.height * coverScale * transform.scale;

  // Center + offsets
  const x = (padW - drawW) / 2 + transform.offsetX;
  const y = (padH - drawH) / 2 + transform.offsetY;

  ctx.drawImage(img, x, y, drawW, drawH);
  ctx.restore();

  // Subtle border
  ctx.strokeStyle = '#3a3a3a';
  ctx.lineWidth = 3;
  roundRect(ctx, 1, 1, padW - 2, padH - 2, radius);
  ctx.stroke();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function updateSliderUI() {
  zoomSlider.value = Math.round(transform.scale * 100);
  zoomValue.textContent = Math.round(transform.scale * 100) + '%';
  offsetXSlider.value = Math.round(transform.offsetX);
  offsetYSlider.value = Math.round(transform.offsetY);
  offsetXValue.textContent = Math.round(transform.offsetX);
  offsetYValue.textContent = Math.round(transform.offsetY);
}

zoomSlider.addEventListener('input', () => {
  transform.scale = zoomSlider.value / 100;
  zoomValue.textContent = zoomSlider.value + '%';
  drawTweakCanvas();
});

offsetXSlider.addEventListener('input', () => {
  transform.offsetX = Number(offsetXSlider.value);
  offsetXValue.textContent = offsetXSlider.value;
  drawTweakCanvas();
});

offsetYSlider.addEventListener('input', () => {
  transform.offsetY = Number(offsetYSlider.value);
  offsetYValue.textContent = offsetYSlider.value;
  drawTweakCanvas();
});

// Mouse / touch drag on canvas
tweakCanvas.addEventListener('mousedown', startDrag);
tweakCanvas.addEventListener('touchstart', startDrag, { passive: false });

function startDrag(e) {
  e.preventDefault();
  isDragging = true;
  const point = e.touches ? e.touches[0] : e;
  dragStartX = point.clientX;
  dragStartY = point.clientY;
  dragOriginOffsetX = transform.offsetX;
  dragOriginOffsetY = transform.offsetY;
}

window.addEventListener('mousemove', onDrag);
window.addEventListener('touchmove', onDrag, { passive: false });

function onDrag(e) {
  if (!isDragging) return;
  e.preventDefault();
  const point = e.touches ? e.touches[0] : e;
  transform.offsetX = dragOriginOffsetX + (point.clientX - dragStartX);
  transform.offsetY = dragOriginOffsetY + (point.clientY - dragStartY);
  // Clamp slider range a bit wider while dragging
  offsetXSlider.min = Math.min(-300, Math.floor(transform.offsetX));
  offsetXSlider.max = Math.max(300, Math.ceil(transform.offsetX));
  offsetYSlider.min = Math.min(-300, Math.floor(transform.offsetY));
  offsetYSlider.max = Math.max(300, Math.ceil(transform.offsetY));
  updateSliderUI();
  drawTweakCanvas();
}

window.addEventListener('mouseup', () => { isDragging = false; });
window.addEventListener('touchend', () => { isDragging = false; });

// Scroll to zoom
tweakCanvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const delta = e.deltaY > 0 ? -0.05 : 0.05;
  transform.scale = Math.min(3, Math.max(0.2, transform.scale + delta));
  updateSliderUI();
  drawTweakCanvas();
}, { passive: false });

// Presets
function setCover() {
  transform.scale = 1;
  transform.offsetX = 0;
  transform.offsetY = 0;
  updateSliderUI();
  drawTweakCanvas();
}

function setFit() {
  if (!originalImage) return;
  const { w: padW, h: padH } = getPadSize();
  const img = originalImage;
  const coverScale = Math.max(padW / img.width, padH / img.height);
  const fitScale = Math.min(padW / img.width, padH / img.height);
  transform.scale = fitScale / coverScale;
  transform.offsetX = 0;
  transform.offsetY = 0;
  updateSliderUI();
  drawTweakCanvas();
}

function setReset() {
  transform = { scale: 1, offsetX: 0, offsetY: 0 };
  updateSliderUI();
  drawTweakCanvas();
}

fitBtn.addEventListener('click', setFit);
coverBtn.addEventListener('click', setCover);
resetBtn.addEventListener('click', setReset);

// Apply → export canvas as the final image
tweakApply.addEventListener('click', () => {
  // Render at higher resolution for quality
  const product = products[currentIndex];
  const exportScale = 3; // 3x for sharp download
  const { w: baseW, h: baseH } = getPadSize();
  const padW = baseW * exportScale;
  const padH = baseH * exportScale;

  const off = document.createElement('canvas');
  off.width = padW;
  off.height = padH;
  const octx = off.getContext('2d');

  const radius = Math.max(10, Math.min(padW, padH) * 0.04) * exportScale / 3;

  // Black base
  octx.fillStyle = '#1a1a1a';
  roundRect(octx, 0, 0, padW, padH, radius);
  octx.fill();

  octx.save();
  roundRect(octx, 0, 0, padW, padH, radius);
  octx.clip();

  const img = originalImage;
  const coverScale = Math.max(padW / img.width, padH / img.height);
  const drawW = img.width * coverScale * transform.scale;
  const drawH = img.height * coverScale * transform.scale;
  const x = (padW - drawW) / 2 + transform.offsetX * exportScale;
  const y = (padH - drawH) / 2 + transform.offsetY * exportScale;

  octx.drawImage(img, x, y, drawW, drawH);
  octx.restore();

  tweakedDataUrl = off.toDataURL('image/png');
  applyImageToPreviews();
  // Also update the small dropzone preview
  previewImage.src = tweakedDataUrl;
  closeTweakEditor();
});

// ---------- Place Order ----------
placeOrderBtn.addEventListener('click', async () => {
  if (!selectedFile && !tweakedDataUrl) {
    alert('Please upload an artwork first.');
    return;
  }

  placeOrderBtn.disabled = true;
  placeOrderBtn.textContent = 'Processing...';

  const product = products[currentIndex];
  const formData = new FormData();

  // Prefer the tweaked image if the user adjusted it
  if (tweakedDataUrl) {
    const blob = await (await fetch(tweakedDataUrl)).blob();
    formData.append('artwork', blob, 'tweaked_artwork.png');
  } else {
    formData.append('artwork', selectedFile);
  }
  formData.append('size', product.size);
  formData.append('product_name', product.name);

  try {
    const res = await fetch('/api/place-order', {
      method: 'POST',
      body: formData
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to place order');

    lastOrderData = data;

    modalOrderNumber.textContent = `Order number: ${data.order_number}`;
    modalOrderSize.textContent = `size: ${data.size}`;
    const orderId = String(data.order_number).replace(/^#/, '');
    downloadLink.href = `/api/download-order/${orderId}`;
    downloadLink.download = `order_${data.order_number}_preview.png`;

    // Make sure modal shows the current (possibly tweaked) image
    applyImageToPreviews();
    modalOverlay.style.display = 'flex';
  } catch (err) {
    alert('Error: ' + err.message);
  } finally {
    placeOrderBtn.disabled = false;
    placeOrderBtn.textContent = 'Place order';
  }
});

const successOverlay = document.getElementById('successOverlay');
const successMessage = document.getElementById('successMessage');
const successOkBtn = document.getElementById('successOkBtn');

confirmBtn.addEventListener('click', () => {
  modalOverlay.style.display = 'none';

  // Show success popup
  if (lastOrderData) {
    successMessage.textContent = `Order ${lastOrderData.order_number} for ${lastOrderData.size} has been placed successfully.`;
  } else {
    successMessage.textContent = 'Your order has been placed successfully.';
  }
  successOverlay.style.display = 'flex';
});

successOkBtn.addEventListener('click', () => {
  successOverlay.style.display = 'none';
});

successOverlay.addEventListener('click', (e) => {
  if (e.target === successOverlay) {
    successOverlay.style.display = 'none';
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft' && tweakOverlay.style.display === 'none') showProduct(currentIndex - 1);
  if (e.key === 'ArrowRight' && tweakOverlay.style.display === 'none') showProduct(currentIndex + 1);
  if (e.key === 'Escape') {
    modalOverlay.style.display = 'none';
    successOverlay.style.display = 'none';
    closeTweakEditor();
  }
});

// Init
updateProduct();