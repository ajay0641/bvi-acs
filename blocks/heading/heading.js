export default function decorate(block) {
  const text = block.textContent.trim();
  const headingDiv = document.createElement('div');
  headingDiv.classList.add('custom-heading');
  headingDiv.textContent = text;
  block.innerHTML = '';
  block.appendChild(headingDiv);
}
