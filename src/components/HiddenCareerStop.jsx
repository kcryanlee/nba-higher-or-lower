import { formatYears } from "../game/careerPath.js";

export default function HiddenCareerStop({ stop }) {
  return (
    <span className="career-stop is-hidden" role="img" aria-label={`Hidden team, ${formatYears(stop)}`}>
      <span className="career-blank career-mystery" aria-hidden="true">?</span>
      <span className="career-team" aria-hidden="true">Hidden team</span>
      <span className="career-years" aria-hidden="true">{formatYears(stop)}</span>
    </span>
  );
}
