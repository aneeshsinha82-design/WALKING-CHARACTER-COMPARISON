/* Built-in CC0-style 8-frame walk cycle for the default main character.
 * The site normally waits for user-uploaded frames. This adds a ready-to-use
 * frame-by-frame pixel character so the Main Character walks immediately.
 */
(() => {
  const NS = 'http://www.w3.org/2000/svg';
  const makeFrame = (i) => {
    const swing = [-9,-5,0,6,9,5,0,-6][i];
    const legA = [-7,-3,4,9,7,3,-4,-9][i];
    const legB = -legA;
    const armA = -legA * 0.75;
    const armB = -legB * 0.75;
    const svg = `<svg xmlns="${NS}" width="96" height="160" viewBox="0 0 96 160">
      <rect width="96" height="160" fill="none"/>
      <g stroke="#242424" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M48 77 L48 ${106+swing}" fill="none"/>
        <path d="M48 103 L${39+legA} 142 L${31+legA} 151" fill="none"/>
        <path d="M48 103 L${57+legB} 142 L${65+legB} 151" fill="none"/>
        <path d="M46 79 L${31+armA} 105 L${25+armA} 122" fill="none"/>
        <path d="M50 79 L${65+armB} 105 L${71+armB} 122" fill="none"/>
        <path d="M30 44 Q48 27 66 44 L62 73 Q48 82 34 73Z" fill="#f0b88f"/>
        <path d="M30 48 Q28 28 48 18 Q68 28 66 48 L58 40 Q48 34 38 40Z" fill="#2f6fb2"/>
        <path d="M33 39 Q48 31 63 39" fill="none" stroke="#d8b04a" stroke-width="3"/>
        <circle cx="41" cy="54" r="2.5" fill="#202020" stroke="none"/>
        <circle cx="55" cy="54" r="2.5" fill="#202020" stroke="none"/>
        <path d="M42 64 Q48 68 54 64" fill="none" stroke-width="2.5"/>
        <path d="M32 75 Q48 68 64 75 L66 111 Q48 118 30 111Z" fill="#4b8fd1"/>
        <path d="M35 79 L61 79" fill="none" stroke="#e8c46a" stroke-width="3"/>
        <path d="M33 109 L63 109" fill="none"/>
        <path d="M23 151 L39 151" fill="none" stroke-width="6"/>
        <path d="M57 151 L73 151" fill="none" stroke-width="6"/>
      </g>
    </svg>`;
    return new File([svg], `simple-walker-${String(i+1).padStart(2,'0')}.svg`, {type:'image/svg+xml'});
  };
  function install() {
    const input = document.querySelector('#mainChar input[data-frames]');
    if (!input || input.files.length) return;
    const files = Array.from({length:8}, (_, i) => makeFrame(i));
    const dt = new DataTransfer();
    files.forEach(f => dt.items.add(f));
    try { input.files = dt.files; input.dispatchEvent(new Event('change', {bubbles:true})); } catch (e) { console.warn('Built-in walking cycle could not be installed automatically.', e); }
    const name = document.querySelector('#mainChar input[data-f="name"]');
    if (name && !name.value) { name.value = 'Simple Walker'; name.dispatchEvent(new Event('input', {bubbles:true})); name.dispatchEvent(new Event('change', {bubbles:true})); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(install, 80)); else setTimeout(install, 80);
})();
