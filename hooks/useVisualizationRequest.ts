import { useEffect, useRef } from 'react';

/** Shared freshness gate for asynchronous visualizations, including unmounts. */
export function useVisualizationRequest() {
  const revision = useRef(0);
  const gate = useRef({
    begin: () => { const token = ++revision.current; return () => token === revision.current; },
    invalidate: () => { revision.current++; },
  });
  useEffect(() => () => gate.current.invalidate(), []);
  return gate.current;
}
