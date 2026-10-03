/* Built-in 8-frame human walk cycle from OpenGameArt.org.
 * Source: "Girl walking side" by noxsucco, CC0.
 * https://opengameart.org/content/girl-walking-side
 * The source sprite sheet contains 8 side-view walking poses.
 */
(() => {
  const SPRITE_URL = 'https://opengameart.org/sites/default/files/walk.png';
  const FRAME_COUNT = 8;
  const FRAME_W = 128;
  const FRAME_H = 160;

  async function makeFrameFiles() {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = SPRITE_URL;
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = () => reject(new Error('Could not load the CC0 walking sprite.'));
    });

    const files = [];
    for (let i = 0; i < FRAME_COUNT; i++) {
      const canvas = document.createElement('canvas');
      canvas.width = FRAME_W;
      canvas.height = FRAME_H;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, FRAME_W, FRAME_H);
      ctx.drawImage(img, i * FRAME_W, 0, FRAME_W, FRAME_H, 0, 0, FRAME_W, FRAME_H);
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      files.push(new File([blob], `girl-walk-${String(i + 1).padStart(2, '0')}.png`, {type: 'image/png'}));
    }
    return files;
  }

  async function install() {
    const input = document.querySelector('#mainChar input[data-frames]');
    if (!input || input.files.length) return;
    try {
      const files = await makeFrameFiles();
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
        toast.textContent = 'Could not load the built-in CC0 walking character. You can upload frames manually.';
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
