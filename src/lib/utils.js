import { debug } from "../lib";

export function getMatchingNodes(documentOrNode, selector) {
  // Find all decendent nodes with a matching attribute
  const nodesToParse = [];
  nodesToParse.push(...documentOrNode.querySelectorAll(selector));
  const isDocument = documentOrNode instanceof Document;
  if (!isDocument && documentOrNode.matches(selector)) {
    // And include the node itself if it has a matching attribute
    nodesToParse.push(documentOrNode);
  }
  return nodesToParse;
}

export function getDocumentOrWindow(modifiers) {
  if (modifiers.document) return document;
  if (modifiers.window || modifiers.outside) return window;
  return null;
}

export function prettyNodeName(documentOrNode) {
  return documentOrNode instanceof Document
    ? "#document"
    : "<" +
        documentOrNode.tagName.toLowerCase() +
        (documentOrNode.id ? "#" + documentOrNode.id : "") +
        ">";
}
