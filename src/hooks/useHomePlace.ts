import { useEffect, useState } from 'react';
import { loadSettings } from '../shared/settings';

/** The place saved in settings, kept current when it's edited in the popup. Empty until read. */
export function useHomePlace(): string {
  const [place, setPlace] = useState('');

  useEffect(() => {
    let cancelled = false;
    const read = () =>
      loadSettings().then(
        (settings) => !cancelled && setPlace(settings.homePlace),
        () => undefined, // no place: "Near me" stays off
      );
    void read();
    chrome.storage.onChanged.addListener(read);
    return () => {
      cancelled = true;
      chrome.storage.onChanged.removeListener(read);
    };
  }, []);

  return place;
}
