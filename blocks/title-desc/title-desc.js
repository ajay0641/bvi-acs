export default function decorate(block) {
  // Wrap text nodes in the block
  const rows = block.querySelectorAll(':scope > div');
  rows.forEach((row) => {
    const cols = row.querySelectorAll(':scope > div');
    if (cols.length === 2) {
      // Ensure first column has title styling
      cols[0].classList.add('title-desc-title');
      // Ensure second column has description styling
      cols[1].classList.add('title-desc-description');
    }
  });
}
