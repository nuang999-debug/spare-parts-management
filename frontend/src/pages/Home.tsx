import { Link } from 'react-router-dom';

export function Home() {
  return (
    <div className="workflow">
      <h2>Warehouse Barcode Scanner</h2>
      <nav className="home-nav">
        <Link to="/receiving">Receiving</Link>
        <Link to="/picking">Picking / Issue</Link>
        <Link to="/stockcount">Stock Count</Link>
      </nav>
    </div>
  );
}
