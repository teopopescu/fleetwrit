import { Link } from 'react-router-dom';
import { IconArrowRight } from '../components/Icons';

export function NotFound() {
  return (
    <div className="page">
      <h1 className="pagehead__title">Not on file</h1>
      <p className="pagehead__lede">That record does not exist in this register.</p>
      <Link to="/" className="panel__more">
        Back to overview <IconArrowRight size={15} />
      </Link>
    </div>
  );
}
