import React, { useState, useEffect } from 'react';

const API_BASE = 'http://localhost:8000/api/v1';

export default function App() {
  const [items, setItems] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(false);

  // Form states for adding a tracked item
  const [form, setForm] = useState({
    competitor_name: '',
    product_name: '',
    category: 'General',
    our_target_price: '',
    url: '',
    price_selector: '',
    stock_selector: ''
  });

  // Simulation states
  const [selectedItemId, setSelectedItemId] = useState('');
  const [simPrice, setSimPrice] = useState('');
  const [simStock, setSimStock] = useState(true);

  const fetchData = async () => {
    try {
      const itemsRes = await fetch(`${API_BASE}/items`);
      const itemsData = await itemsRes.json();
      setItems(itemsData);

      const alertsRes = await fetch(`${API_BASE}/alerts`);
      const alertsData = await alertsRes.json();
      setAlerts(alertsData);
    } catch (err) {
      console.error("Failed to fetch data from backend:", err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleTrackItem = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/items/track`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          our_target_price: form.our_target_price ? parseFloat(form.our_target_price) : null
        })
      });
      if (res.ok) {
        setForm({ competitor_name: '', product_name: '', category: 'General', our_target_price: '', url: '', price_selector: '', stock_selector: '' });
        fetchData();
      } else {
        alert("Failed to track item. Check URL or inputs.");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleRunScan = async () => {
    setLoading(true);
    try {
      await fetch(`${API_BASE}/scan/all`, { method: 'POST' });
      fetchData();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSimulate = async (e) => {
    e.preventDefault();
    if (!selectedItemId) return;
    try {
      const res = await fetch(`${API_BASE}/items/${selectedItemId}/simulate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          simulated_price: parseFloat(simPrice),
          simulated_in_stock: simStock
        })
      });
      if (res.ok) {
        setSimPrice('');
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-800 pb-5 gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">Competitor & Market Price Monitor</h1>
            <p className="text-slate-400 text-sm mt-1">Real-time pricing intelligence, margin tracking, and automated stock alerts.</p>
          </div>
          <button
            onClick={handleRunScan}
            disabled={loading}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium px-4 py-2 rounded-lg text-sm transition shadow-lg shadow-indigo-900/30 disabled:opacity-50"
          >
            {loading ? "Scanning..." : "Run Live Market Scan"}
          </button>
        </div>

        {/* Metrics Overview Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
            <p className="text-sm font-medium text-slate-400">Tracked Products</p>
            <p className="text-3xl font-bold text-white mt-2">{items.length}</p>
          </div>
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
            <p className="text-sm font-medium text-slate-400">In-Stock Rate</p>
            <p className="text-3xl font-bold text-emerald-400 mt-2">
              {items.length ? `${Math.round((items.filter(i => i.in_stock).length / items.length) * 100)}%` : '0%'}
            </p>
          </div>
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
            <p className="text-sm font-medium text-slate-400">Total Recorded Alerts</p>
            <p className="text-3xl font-bold text-amber-400 mt-2">{alerts.length}</p>
          </div>
        </div>

        {/* Main Grid: Tracked Items & Forms */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left 2 Cols: Tracked Items Table */}
          <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
            <div className="p-5 border-b border-slate-800">
              <h2 className="text-lg font-semibold text-white">Monitored Competitor Items</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-950/50 text-slate-400 border-b border-slate-800">
                    <th className="p-4 font-medium">Competitor / Product</th>
                    <th className="p-4 font-medium">Current Price</th>
                    <th className="p-4 font-medium">Target Price Gap</th>
                    <th className="p-4 font-medium">Stock</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="p-6 text-center text-slate-500">No items currently tracked. Add one using the form.</td>
                    </tr>
                  ) : (
                    items.map(item => (
                      <tr key={item.id} className="hover:bg-slate-800/40 transition">
                        <td className="p-4">
                          <div className="font-medium text-white">{item.product_name}</div>
                          <div className="text-xs text-slate-400">{item.competitor_name} • {item.category}</div>
                        </td>
                        <td className="p-4 font-semibold text-white">
                          {item.current_price !== null ? `$${item.current_price.toFixed(2)}` : 'Pending'}
                        </td>
                        <td className="p-4">
                          {item.price_gap !== null ? (
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${item.price_gap > 0 ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-rose-950 text-rose-300 border border-rose-800'}`}>
                              {item.price_gap > 0 ? `+${item.price_gap}` : item.price_gap} vs target
                            </span>
                          ) : (
                            <span className="text-slate-500 text-xs">No target set</span>
                          )}
                        </td>
                        <td className="p-4">
                          <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${item.in_stock ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                            {item.in_stock ? 'In Stock' : 'Out of Stock'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right Col: Add Item & Simulation Controls */}
          <div className="space-y-8">
            
            {/* Add Item Form */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl">
              <h2 className="text-lg font-semibold text-white mb-4">Track New Product</h2>
              <form onSubmit={handleTrackItem} className="space-y-4 text-sm">
                <div>
                  <label className="block text-slate-400 mb-1">Competitor Name</label>
                  <input
                    type="text"
                    required
                    value={form.competitor_name}
                    onChange={e => setForm({...form, competitor_name: e.target.value})}
                    placeholder="e.g. Amazon / BestBuy"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Product Name</label>
                  <input
                    type="text"
                    required
                    value={form.product_name}
                    onChange={e => setForm({...form, product_name: e.target.value})}
                    placeholder="e.g. Wireless Mouse X1"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-slate-400 mb-1">Category</label>
                    <input
                      type="text"
                      value={form.category}
                      onChange={e => setForm({...form, category: e.target.value})}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Our Target ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={form.our_target_price}
                      onChange={e => setForm({...form, our_target_price: e.target.value})}
                      placeholder="49.99"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Product URL</label>
                  <input
                    type="url"
                    required
                    value={form.url}
                    onChange={e => setForm({...form, url: e.target.value})}
                    placeholder="https://example.com/product"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Price CSS Selector</label>
                  <input
                    type="text"
                    required
                    value={form.price_selector}
                    onChange={e => setForm({...form, price_selector: e.target.value})}
                    placeholder="span.price"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2 rounded-lg transition shadow-md"
                >
                  Save & Scan Item
                </button>
              </form>
            </div>

            {/* Simulation Panel */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl">
              <h2 className="text-lg font-semibold text-white mb-4">Simulate Market Event</h2>
              <form onSubmit={handleSimulate} className="space-y-4 text-sm">
                <div>
                  <label className="block text-slate-400 mb-1">Select Product</label>
                  <select
                    value={selectedItemId}
                    onChange={e => setSelectedItemId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">-- Choose item --</option>
                    {items.map(item => (
                      <option key={item.id} value={item.id}>{item.competitor_name} - {item.product_name}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-slate-400 mb-1">New Price ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={simPrice}
                      onChange={e => setSimPrice(e.target.value)}
                      placeholder="39.99"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Stock Status</label>
                    <select
                      value={simStock}
                      onChange={e => setSimStock(e.target.value === 'true')}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white focus:outline-none focus:border-indigo-500"
                    >
                      <option value="true">In Stock</option>
                      <option value="false">Out of Stock</option>
                    </select>
                  </div>
                </div>
                <button
                  type="submit"
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-2 rounded-lg transition shadow-md"
                >
                  Trigger Simulation Event
                </button>
              </form>
            </div>

          </div>

        </div>

        {/* Live Alerts Feed */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl">
          <h2 className="text-lg font-semibold text-white mb-4">Live Alert & Event Stream</h2>
          <div className="space-y-3">
            {alerts.length === 0 ? (
              <p className="text-slate-500 text-sm">No price drops or stock alerts recorded yet.</p>
            ) : (
              alerts.map(alert => (
                <div key={alert.alert_id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-slate-950 border border-slate-800 p-4 rounded-lg gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white">{alert.product_name}</span>
                      <span className="text-xs px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800">{alert.event_type}</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">{alert.competitor_name} • Recorded at {new Date(alert.recorded_at).toLocaleTimeString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-white">${alert.recorded_price.toFixed(2)}</p>
                    <p className="text-xs text-slate-400">In Stock: {alert.in_stock ? 'Yes' : 'No'}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
