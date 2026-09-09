import landscape from '../assets/sidebar-landscape.svg';

// The original forest and mountain artwork, clipped from the supplied reference.
// Navigation, labels, and profile remain live, accessible interface elements.
export default function ForestArt() {
  return <img className="sidebar-trees" src={landscape} alt="" aria-hidden="true" />;
}
