export default function decorate(block) {
  const [content] = block.querySelectorAll(':scope > div > div');
  if (!content) return;

  const blockquote = document.createElement('blockquote');
  blockquote.className = 'quote-text';
  blockquote.append(...content.childNodes);

  block.textContent = '';
  block.append(blockquote);
}
