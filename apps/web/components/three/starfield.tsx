/** CSS-only stars remain visible without WebGL and stop under reduced motion. */
export function StarfieldCSS() {
  return (
    <div className="starfield" aria-hidden>
      <div className="stars stars-small" />
      <div className="stars stars-large" />
    </div>
  );
}

export { StarfieldCSS as Starfield };
