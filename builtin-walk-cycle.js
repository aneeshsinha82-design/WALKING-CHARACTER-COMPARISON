/* Real 8-frame human walking character from OpenGameArt.org.
 * Source: "Girl walking side" by noxsucco.
 * License: CC0.
 * https://opengameart.org/content/girl-walking-side
 * The source image is an actual 8-pose side-view walking sprite sheet.
 */
(() => {
  const SPRITE_URL = 'https://opengameart.org/sites/default/files/walk.png';
  const FRAME_COUNT = 8;

  async function loadImage() {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = SPRITE_URL;
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = () => reject(new Error('Could not load the CC0 walking sprite.'));
    });
    return img;
  }

  async function makeFrameFiles(img) {
    const frameW = Math.floor(img.naturalWidth / FRAME_COUNT);
    const frameH = img.naturalHeight;
    const files = [];

    for (let i = 0; i < FRAME_COUNT; i++) {
      const canvas = document.createElement('canvas');
      canvas.width = frameW;
      canvas.height = frameH;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, frameW, frameH);
      ctx.drawImage(img, i * frameW, 0, frameW, frameH, 0, 0, frameW, frameH);
      const blob = await new Promise((resolve, reject) => {
        canvas.toBlob(b => b ? resolve(b) : reject(new Error('PNG conversion failed.')), 'image/png');
      });
      files.push(new File([blob], `girl-walk-${String(i + 1).padStart(2, '0')}.png`, {type:'image/png'}));
    }
    return files;
  }

  async function install() {
    const input = document.querySelector('#mainChar input[data-frames]');
    if (!input || input.files.length) return;

    try {
      const img = await loadImage();
      const files = await makeFrameFiles(img);
      const dt = new DataTransfer();
      files.forEach(file => dt.items.add(file));
      input.files = dt.files;
      input.dispatchEvent(new Event('change', {bubbles:true}));

      const name = document.querySelector('#mainChar input[data-f="name"]');
      if (name && !name.value) {
        name.value = 'Girl';
        name.dispatchEvent(new Event('input', {bubbles:true}));
        name.dispatchEvent(new Event('change', {bubbles:true}));
      }
    } catch (err) {
      console.error(err);
      const toast = document.querySelector('#toast');
      if (toast) {
        toast.textContent = 'Could not load the real CC0 walking character. You can upload frames manually.';
        toast.classList.add('show');
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(install, 120));
  } else {
    setTimeout(install, 120);
  }
})();
