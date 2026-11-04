import { useEffect, useRef, useState, type DependencyList } from 'react';
import { db } from '../db';

export function useLiveQuery<T>(query: () => Promise<T>, dependencies: DependencyList = []): T | undefined {
  const current = useRef(query);
  current.current = query;
  const [state, setState] = useState<{value?: T; error?: unknown; dependencies?: DependencyList}>({});
  useEffect(() => {
    const captured = [...dependencies];
    return db.subscribe(current.current, {
      next: value => setState({value, dependencies:captured}), error: error => setState({error, dependencies:captured}),
    });
    // The caller explicitly supplies query dependencies, matching the prior Dexie hook.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies);
  const matches = state.dependencies?.length === dependencies.length && dependencies.every((value, i) => Object.is(value, state.dependencies![i]));
  if (matches && state.error) throw state.error;
  return matches ? state.value : undefined;
}
