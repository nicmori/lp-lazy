type DocumentLike = Pick<Document, 'body' | 'readyState'> & {
  documentElement?: ParentNode | null;
};

export function canObserveDocument(documentLike: DocumentLike): boolean {
  return Boolean(documentLike.body) || Boolean(documentLike.documentElement) || documentLike.readyState !== 'loading';
}

export function getObservationRoot(documentLike: DocumentLike): Element | null {
  if (documentLike.body) {
    return documentLike.body;
  }

  if (documentLike.documentElement instanceof Element) {
    return documentLike.documentElement;
  }

  return null;
}
