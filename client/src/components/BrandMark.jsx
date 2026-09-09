// The Tessera mark, cut from the supplied artwork (client/brand/logo.png) as
// mint on transparency, so it sits on the sidebar's green without a matte.
export default function BrandMark({ size = 30 }) {
  return (
    <img
      src={`${import.meta.env.BASE_URL}brand-mark.png`}
      width={size}
      height={size}
      alt=""
      className="brand-glyph"
    />
  );
}
