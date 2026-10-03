/* Built-in 8-frame stick-figure walking cycle.
 * Used as the default Main Character so the site works without external assets.
 */
(() => {
  const NS = 'http://www.w3.org/2000/svg';
  const makeFrame = (i) => {
    const leg = [-8,-4,2,8,6,2,-4,-8][i];
    const arm = [-7,-3,3,7,6,2,-3,-7][i];
    const svg = `<svg xmlns="${NS}" width="96" height="160" viewBox="0 0 96 160">
      <rect width="96" height="160" fill="none"/>
      <g fill="none" stroke="#222" stroke-width="6" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="48" cy="34" r="15"/>
        <path d="M48 49 L48 98"/>
        <path d="M48 61 L${31+arm} 91 L${27+arm} 111"/>
        <path d="M48 61 L${65-arm} 91 L${69-arm} 111"/>
        <path d="M48 98 L${39+leg} 139 L${31+leg} 151"/>
        <path d="M48 98 L${57-leg} 139 L${65-leg} 151"/>
      </g>
    </svg>`;
    return new File([svg], `stick-walk-${String(i+1).padStart(2,'0')}.svg`, {type:'image/svg+xml'});
  };
  function install() {
    const input = document.querySelector('#mainChar input[data-frames]');
    if (!input || input.files.length) return;
    const dt = new DataTransfer();
    for (let i = 0; i < 8; i++) dt.items.add(makeFrame(i));
    input.files = dt.files;
    input.dispatchEvent(new Event('change', {bubbles:true}));
    const name = document.querySelector('#mainChar input[data-f="name"]');
    if (name && !name.value) {
      name.value = 'Stick Walker';
      name.dispatchEvent(new Event('input', {bubbles:true}));
      name.dispatchEvent(new Event('change', {bubbles:true}));
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(install, 100));
  else setTimeout(install, 100);
})();
