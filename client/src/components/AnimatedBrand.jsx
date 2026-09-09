// The mark assembling itself, once, while the sign-in page settles.
//
// Ribbon contours follow the Tessera artwork, in a shared viewBox. It is
// decoration over a form that is already usable, so it is hidden from screen
// readers and it never delays anything.
const RIBBONS = [
  '74,0 218,0 342,126 258,214 139,100 0,228 0,76',
  '240,0 414,0 640,228 464,228',
  '494,59 650,59 650,216',
  '167,149 463,435 463,611 167,324',
  '400,185 463,247 463,411 320,270',
  '177,356 320,494 320,674 177,529'
];

export default function AnimatedBrand() {
  return (
    <section className="landing-brand" aria-label="Tessera">
      <div className="landing-brand-animation" aria-hidden="true">
        <svg className="landing-brand-mark" viewBox="-45 -45 740 764" fill="currentColor">
          {RIBBONS.map((points, index) => (
            <polygon key={points} className={`landing-ribbon landing-ribbon-${index}`} points={points} />
          ))}
        </svg>
        <div className="landing-wordmark">Tessera</div>
        <p className="landing-tagline">Your money, in focus.</p>
      </div>
    </section>
  );
}
