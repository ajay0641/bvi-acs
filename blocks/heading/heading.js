export default function decorate(block) {
    const heading = block.querySelector('h1, h2, h3, h4, h5, h6');
    if (heading) {
        const level = heading.tagName[1];
        const newHeading = document.createElement(`h${level}`);
        newHeading.className = `heading-${level}`;
        newHeading.append(...heading.childNodes);
        heading.replaceWith(newHeading);
    }
}
