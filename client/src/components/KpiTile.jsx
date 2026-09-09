import Icon from './Icon.jsx';
import Sparkline from './Sparkline.jsx';

export default function KpiTile({ icon, tone = 'mint', dark, label, value, foot, series }) {
  return (
    <div className={dark ? 'card kpi dark' : 'card kpi'}>
      <div className="kpi-head">
        <span className={`kpi-icon ${tone}`}>
          <Icon name={icon} size={19} strokeWidth={1.9} />
        </span>
        <span className="kpi-label">{label}</span>
      </div>

      <div className="kpi-figure">
        <span className="kpi-value">{value}</span>
        {series && <Sparkline values={series} tone={dark ? 'light' : tone} />}
      </div>

      <span className="kpi-foot">{foot}</span>
    </div>
  );
}
