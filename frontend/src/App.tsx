import { Link, Route, Routes } from 'react-router-dom'
import './App.css'
import { Home } from './pages/Home'
import { Picking } from './pages/Picking'
import { Receiving } from './pages/Receiving'
import { StockCount } from './pages/StockCount'

function App() {
  return (
    <div className="app">
      <header className="app-header">
        <Link to="/">Warehouse Barcode</Link>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/receiving" element={<Receiving />} />
          <Route path="/picking" element={<Picking />} />
          <Route path="/stockcount" element={<StockCount />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
