import React, { useState } from 'react';
import { Plus, Edit2, Trash2, Eye, X } from 'lucide-react';
import { StockItem, StockQuote } from '../App';

interface PortfolioTabProps {
  stocks: StockItem[];
  quotes: Record<string, StockQuote>;
  onAddStock: (symbol: string, shares: number, avgCost: number) => Promise<boolean>;
  onDeleteStock: (symbol: string) => Promise<boolean>;
  navigateToAnalysis: (symbol: string) => void;
}

const PortfolioTab: React.FC<PortfolioTabProps> = ({
  stocks,
  quotes,
  onAddStock,
  onDeleteStock,
  navigateToAnalysis,
}) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  
  // State for Add Stock Search Autocomplete
  const [searchTerm, setSearchTerm] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedStock, setSelectedStock] = useState<any | null>(null);

  const [symbol, setSymbol] = useState('');
  const [shares, setShares] = useState('');
  const [avgCost, setAvgCost] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Handle opening modal for Add Stock
  const openAddModal = () => {
    setIsEditing(false);
    setSymbol('');
    setSearchTerm('');
    setSelectedStock(null);
    setSuggestions([]);
    setShowSuggestions(false);
    setShares('');
    setAvgCost('');
    setErrorMsg('');
    setModalOpen(true);
  };

  // Handle opening modal for Editing existing stock
  const openEditModal = (item: StockItem) => {
    setIsEditing(true);
    const code = item.symbol.split('.')[0];
    const name = quotes[item.symbol]?.name || '';
    setSymbol(item.symbol);
    setSearchTerm(name ? `${code} - ${name}` : code);
    setSelectedStock(null);
    setSuggestions([]);
    setShowSuggestions(false);
    setShares(item.shares.toString());
    setAvgCost(item.avgCost ? Math.round(item.avgCost).toString() : '');
    setErrorMsg('');
    setModalOpen(true);
  };

  // Trigger Autocomplete Search on typing
  const handleSearchChange = async (val: string) => {
    setSearchTerm(val);
    setSelectedStock(null); // Clear selection if typing again
    setSymbol(val); // In case they just want to type a raw ticker (e.g. AAPL)
    
    if (val.trim().length >= 1) {
      try {
        const response = await fetch(`/api/stock/search?query=${encodeURIComponent(val)}`);
        if (response.ok) {
          const data = await response.json();
          setSuggestions(data);
          setShowSuggestions(true);
        }
      } catch (err) {
        console.error('Error fetching autocomplete results:', err);
      }
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  // When suggestion clicked
  const handleSelectSuggestion = (stock: any) => {
    setSearchTerm(`${stock.code} - ${stock.name}`);
    setSymbol(stock.symbol); // Store the correct TWSE/TPEx symbol (e.g. "2330.TW" or "8069.TWO")
    setSelectedStock(stock);
    setShowSuggestions(false);
  };

  // Handle Form submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    const targetSymbol = isEditing ? symbol : (selectedStock ? selectedStock.symbol : symbol.trim());

    if (!targetSymbol) {
      setErrorMsg('請選擇或輸入股票代號');
      setLoading(false);
      return;
    }

    const sharesNum = parseInt(shares);
    if (isNaN(sharesNum) || sharesNum <= 0) {
      setErrorMsg('請輸入正確的股數 (必須大於 0)');
      setLoading(false);
      return;
    }

    const avgCostNum = parseFloat(avgCost);
    if (isNaN(avgCostNum) || avgCostNum <= 0) {
      setErrorMsg('請輸入正確的平均買入價格 (必須大於 0)');
      setLoading(false);
      return;
    }

    try {
      const success = await onAddStock(targetSymbol, sharesNum, avgCostNum);
      if (success) {
        setModalOpen(false);
      } else {
        setErrorMsg('儲存庫存失敗，請確認代號是否正確或伺服器連線');
      }
    } catch (err) {
      setErrorMsg('連線錯誤，無法聯絡後端');
    } finally {
      setLoading(false);
    }
  };

  // Handle deleting a stock with brief browser confirm
  const handleDelete = async (item: StockItem) => {
    const symbolCode = item.symbol.split('.')[0];
    const quoteName = quotes[item.symbol]?.name || '';
    if (window.confirm(`確定要刪除 ${quoteName} (${symbolCode}) 的所有庫存資料嗎？`)) {
      await onDeleteStock(item.symbol);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>持股庫存管理</h2>
          <p>新增、修改或移除您的台股庫存部位，即時試算總市值變化</p>
        </div>
        <button className="btn btn-primary" onClick={openAddModal}>
          <Plus size={18} />
          <span>新增庫存個股</span>
        </button>
      </div>

      {/* Main Stock Table */}
      <div className="glass-card">
        <div className="table-container">
          {stocks.length > 0 ? (
            <table className="custom-table">
              <thead>
                <tr>
                  <th>股票</th>
                  <th style={{ textAlign: 'right' }}>庫存股數</th>
                  <th style={{ textAlign: 'right' }}>持有均價</th>
                  <th style={{ textAlign: 'right' }}>目前股價</th>
                  <th style={{ textAlign: 'right' }}>估計市值</th>
                  <th style={{ textAlign: 'right' }}>未實現損益</th>
                  <th style={{ textAlign: 'center' }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {stocks.map((item) => {
                  const quote = quotes[item.symbol];
                  const marketValue = quote ? quote.price * item.shares : 0;
                  const avgCostVal = item.avgCost || 0;
                  const unrealized = item.unrealizedProfit !== undefined ? item.unrealizedProfit : (quote ? (quote.price - avgCostVal) * item.shares : 0);
                  const unrealizedPercent = avgCostVal > 0 && quote ? ((quote.price - avgCostVal) / avgCostVal) * 100 : 0;
                  
                  const isUp = quote ? quote.changePercent >= 0 : true;
                  const isUnrealizedUp = unrealized >= 0;

                  return (
                    <tr key={item.symbol}>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span className="stock-code">{item.symbol.split('.')[0]}</span>
                          <span className="stock-name">{quote?.name || '正在載入...'}</span>
                        </div>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600, fontFamily: 'Outfit, sans-serif' }}>
                        {item.shares.toLocaleString()} 股
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600, fontFamily: 'Outfit, sans-serif', color: 'var(--text-secondary)' }}>
                        NT$ {Math.round(avgCostVal).toLocaleString()}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'end' }}>
                          <span style={{ fontWeight: 700, fontFamily: 'Outfit, sans-serif' }}>
                            {quote ? `NT$ ${quote.price.toLocaleString()}` : '-'}
                          </span>
                          {quote && (
                            <span style={{ fontSize: '0.75rem', fontWeight: 600 }} className={isUp ? 'trend-indicator-up' : 'trend-indicator-down'}>
                              {isUp ? '+' : ''}{quote.changePercent.toFixed(2)}%
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'Outfit, sans-serif' }}>
                        NT$ {Math.round(marketValue).toLocaleString()}
                      </td>
                      <td style={{ textAlign: 'right' }} className={isUnrealizedUp ? 'trend-indicator-up' : 'trend-indicator-down'}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'end', fontWeight: 600, fontFamily: 'Outfit, sans-serif' }}>
                          <span>{isUnrealizedUp ? '+' : ''}{Math.round(unrealized).toLocaleString()}</span>
                          <span style={{ fontSize: '0.75rem' }}>
                            {isUnrealizedUp ? '+' : ''}{unrealizedPercent.toFixed(2)}%
                          </span>
                        </div>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.25rem' }}>
                          <button
                            className="btn-icon"
                            onClick={() => navigateToAnalysis(item.symbol)}
                            title="查看技術分析"
                          >
                            <Eye size={16} />
                          </button>
                          <button
                            className="btn-icon"
                            onClick={() => openEditModal(item)}
                            title="修改持股與均價"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            className="btn-icon delete"
                            onClick={() => handleDelete(item)}
                            title="刪除庫存"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '260px', color: 'var(--text-muted)', gap: '1rem' }}>
              <p style={{ fontSize: '1.1rem' }}>目前尚無任何持股資料</p>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>點擊右上角「新增庫存個股」按鈕，快速建立您的台股資產明細吧！</p>
              <button className="btn btn-primary" onClick={openAddModal} style={{ marginTop: '0.5rem' }}>
                <Plus size={18} />
                <span>立即新增</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Add / Edit Glassmorphic Dialog Modal */}
      {modalOpen && (
        <div className="modal-overlay">
          <div className="glass-card modal-content" style={{ overflow: 'visible' }}>
            <div className="flex-header" style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.75rem' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>
                {isEditing ? '修改股票股數' : '新增台股庫存'}
              </h3>
              <button className="btn-icon" onClick={() => setModalOpen(false)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="form-group" style={{ position: 'relative' }}>
                <label className="form-label">搜尋並選擇台股</label>
                
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="輸入股票名稱或代號 (如: 台積電 或 2330)"
                    value={searchTerm}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    disabled={isEditing} // Cannot change ticker code during edit
                    onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
                    onBlur={() => { setTimeout(() => setShowSuggestions(false), 200); }} // Brief delay to allow clicks to register
                    required
                  />
                  
                  {/* Glassmorphic Suggestion Dropdown */}
                  {showSuggestions && suggestions.length > 0 && (
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      background: 'rgba(13, 18, 36, 0.96)',
                      backdropFilter: 'blur(20px)',
                      WebkitBackdropFilter: 'blur(20px)',
                      border: '1px solid var(--glass-border)',
                      borderRadius: '12px',
                      maxHeight: '240px',
                      overflowY: 'auto',
                      zIndex: 220,
                      marginTop: '0.35rem',
                      boxShadow: '0 12px 36px rgba(0,0,0,0.6)'
                    }}>
                      {suggestions.map((stock) => {
                        const isUp = stock.changePercent >= 0;
                        return (
                          <div
                            key={stock.symbol}
                            onClick={() => handleSelectSuggestion(stock)}
                            style={{
                              padding: '0.85rem 1rem',
                              cursor: 'pointer',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              borderBottom: '1px solid rgba(255,255,255,0.03)',
                              transition: 'var(--transition-smooth)'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                          >
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.95rem' }}>
                                {stock.code} {stock.name}
                              </span>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                {stock.market === 'TWSE' ? '上市股票' : '上櫃股票'}
                              </span>
                            </div>
                            <div style={{ textAlign: 'right', fontFamily: 'Outfit, sans-serif' }}>
                              <span style={{ fontWeight: 700, display: 'block', fontSize: '0.9rem' }}>
                                NT$ {stock.price.toLocaleString()}
                              </span>
                              <span style={{ fontSize: '0.75rem', fontWeight: 600 }} className={isUp ? 'trend-indicator-up' : 'trend-indicator-down'}>
                                {isUp ? '+' : ''}{stock.changePercent.toFixed(2)}%
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {!isEditing && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.35rem', display: 'block' }}>
                    {selectedStock ? (
                      <span style={{ color: 'var(--accent-neon)', fontWeight: 600 }}>
                        已選取：{selectedStock.name} (即時市價 NT$ {selectedStock.price})
                      </span>
                    ) : (
                      '* 輸入股票代號或名稱，即刻匹配上市、上櫃公司行情資料'
                    )}
                  </span>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">庫存股數 (股)</label>
                <input
                  type="number"
                  className="form-input"
                  placeholder="例如: 1000"
                  value={shares}
                  onChange={(e) => setShares(e.target.value)}
                  min="1"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">平均買入價格 (均價/元)</label>
                <input
                  type="number"
                  step="0.01"
                  className="form-input"
                  placeholder="例如: 950.0"
                  value={avgCost}
                  onChange={(e) => setAvgCost(e.target.value)}
                  min="0.01"
                  required
                />
              </div>

              {errorMsg && (
                <div style={{ padding: '0.75rem 1rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '8px', color: '#f87171', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
                  {errorMsg}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '2rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setModalOpen(false)}
                  disabled={loading}
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={loading || (!isEditing && !selectedStock && !searchTerm.trim())}
                >
                  {loading ? '儲存中...' : '確定儲存'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PortfolioTab;
