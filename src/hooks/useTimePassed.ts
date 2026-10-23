import { useEffect, useState } from 'react';

/** True once `ms` have passed since the component mounted. */
export function useTimePassed(ms: number): boolean {
  const [passed, setPassed] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setPassed(true), ms);
    return () => clearTimeout(timer);
  }, [ms]);

  return passed;
}
