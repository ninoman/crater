/** Release artwork as a small square. Decorative: the title next to it names the release. */
export function Cover({ src }: { src: string | null }) {
  return src ? (
    <img className="dh-cover" src={src} alt="" loading="lazy" />
  ) : (
    <span className="dh-cover dh-cover--empty" aria-hidden="true" />
  );
}
