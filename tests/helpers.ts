// Collects every visible text node and input value in document order, one per
// line, so a snapshot diff points at the exact figure that changed.
export function visibleText(root: Element): string {
  const lines: string[] = [];
  const walk = (node: Node) => {
    if (node.nodeType === 3) {
      const text = node.textContent?.trim();
      if (text) lines.push(text);
      return;
    }
    if (node instanceof HTMLInputElement) {
      lines.push(node.type === 'checkbox' ? `[checkbox:${node.checked}]` : `[input:${node.value}]`);
    }
    node.childNodes.forEach(walk);
  };
  walk(root);
  return lines.join('\n');
}
