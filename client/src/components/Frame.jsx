import Icon from './Icon.jsx';

// A card, or the same content with its frame taken off.
//
// These panels are used twice: on their own, where they need a card and a
// heading, and inside a settings row, where the row already said what this is
// and a second heading is just repetition.
export default function Frame({ bare, icon, title, children }) {
  if (bare) return <div className="setting-detail">{children}</div>;

  return (
    <section className="card">
      <h2>
        <Icon name={icon} size={19} strokeWidth={1.9} />
        {title}
      </h2>
      {children}
    </section>
  );
}
