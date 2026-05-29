import React, { useState, useEffect } from 'react';
import { Plus, Trash2, DollarSign, History, X, Coins } from 'lucide-react';
import { StockQuote } from '../App';

interface TransactionItem {
  id: string;
  symbol: string;
  type: 'buy' | 'sell';
  date: string;
  price: number;
  shares: number;
  fee: number;
  tax: number;
}

interface TransactionsTabProps {
  transactions: TransactionItem[];
  quotes: Record<string, StockQuote>;
  onAddTransaction: (tx: any) => Promise<boolean>;
  onDeleteTransaction: (id: string) => Promise<boolean>;
}

const TransactionsTab: React.FC<TransactionsTabProps> = ({
  transactions,
  quotes,
  onAddTransaction,
  onDeleteTransaction,
}) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Form States
  const [searchTerm, setSearchTerm] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedStock, setSelectedStock] = useState<any | null>(null);

  const [symbol, setSymbol] = useState('');
  const [type, setType] = useState<'buy' | 'sell'>('buy');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [price, setPrice] = useState('');
  const [shares, setShares] = useState('');
  const [fee, setFee] = useState('');
  const [tax, setTax] = useState('');
  const [isManualFee, setIsManualFee] = useState(false);
  const [isManualTax, setIsManualTax] = useState(false);

  // Automatically calculate Fee and Tax based on Price & Shares when they change
  useEffect(() => {
    const p = parseFloat(price);
    const s = parseInt(shares);
    if (!isNaN(p) && !isNaN(s) && p > 0 && s > 0) {
      if (!isManualFee) {
        // Taiwan Standard Broker Fee: 0.1425%, minimum 20 NTD
        const calculatedFee = Math.max(20, Math.round(p * s * 0.001425));
        setFee(calculatedFee.toString());
      }
      if (!isManualTax) {
        // Taiwan Standard Transaction Tax: 0.3% on sell only
        const calculatedTax = type === 'sell' ? Math.round(p * s * 0.003) : 0;
        setTax(calculatedTax.toString());
      }
    } else {
      if (!isManualFee) setFee('');
      if (!isManualTax) setTax('');
    }
  }, [price, shares, type, isManualFee, isManualTax]);

  const openModal = () => {
    setSearchTerm('');
    setSuggestions([]);
    setShowSuggestions(false);
    setSelectedStock(null);
    setSymbol('');
    setType('buy');
    setDate(new Date().toISOString().split('T')[0]);
    setPrice('');
    setShares('');
    setFee('');
    setTax('');
    setIsManualFee(false);
    setIsManualTax(false);
    setErrorMsg('');
    setModalOpen(true);
  };

  const handleSearchChange = async (val: string) => {
    setSearchTerm(val);
    setSelectedStock(null);
    setSymbol(val);
    
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

  const handleSelectSuggestion = (stock: any) => {
    setSearchTerm(`${stock.code} - ${stock.name}`);
    setSymbol(stock.symbol);
    setSelectedStock(stock);
    setShowSuggestions(false);
    
    // Autofill current cached price as a suggestion
    if (stock.price) {
      setPrice(stock.price.toString());
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    const targetSymbol = selectedStock ? selectedStock.symbol : symbol.toUpperCase().trim();
    if (!targetSymbol) {
      setErrorMsg('請選擇或輸入股票代號');
      setLoading(false);
      return;
    }

    const p = parseFloat(price);
    const s = parseInt(shares);
    if (isNaN(p) || p <= 0) {
      setErrorMsg('請輸入正確的交易價格');
      setLoading(false);
      return;
    }
    if (isNaN(s) || s <= 0) {
      setErrorMsg('請輸入正確的交易股數');
      setLoading(false);
      return;
    }

    const finalFee = parseFloat(fee) || 0;
    const finalTax = parseFloat(tax) || 0;

    try {
      const payload = {
        symbol: targetSymbol,
        type,
        date,
        price: p,
        shares: s,
        fee: finalFee,
        tax: finalTax
      };
      
      const success = await onAddTransaction(payload);
      if (success) {
        setModalOpen(false);
      } else {
        setErrorMsg('儲存交易失敗，請檢查欄位資料與網路狀態');
      }
    } catch (err) {
      setErrorMsg('網路錯誤，無法連線至後端');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (tx: TransactionItem) => {
    const code = tx.symbol.split('.')[0];
    const name = quotes[tx.symbol]?.name || tx.symbol;
    const dateStr = tx.date;
    const typeText = tx.type === 'buy' ? '買入' : '賣出';
    
    if (window.confirm(`確定要刪除這筆交易紀錄嗎？\n${dateStr} | ${typeText} ${name} (${code}) ${tx.shares} 股`)) {
      await onDeleteTransaction(tx.id);
    }
  };

  // Chronological sort descending for table display (most recent first)
  const displayTransactions = [...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Aggregate stats
  const totalTxsCount = transactions.length;
  const totalFeesPaid = transactions.reduce((acc, curr) => acc + (curr.fee || 0), 0);
  const totalTaxesPaid = transactions.reduce((acc, curr) => acc + (curr.tax || 0), 0);
  const totalVolume = transactions.reduce((acc, curr) => acc + (curr.price * curr.shares), 0);

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>交易帳本管理</h2>
          <p>詳細記錄每筆庫存股票買賣歷史，提供最精確的手續費、證交稅及成本回溯分析</p>
        </div>
        <button className="btn btn-primary" onClick={openModal}>
          <Plus size={18} />
          <span>新增交易紀錄</span>
        </button>
      </div>

      {/* Aggregate Cost Cards */}
      <div className="grid-cols-4" style={{ marginBottom: '1.5rem' }}>
        <div className="glass-card">
          <div className="card-label">
            <History size={16} />
            <span>累計交易筆數</span>
          </div>
          <div className="card-value" style={{ fontSize: '1.8rem', padding: '0.2rem 0' }}>
            {totalTxsCount} 筆
          </div>
          <div className="card-subtext" style={{ color: 'var(--text-secondary)' }}>
            包含買入與賣出動作
          </div>
        </div>

        <div className="glass-card">
          <div className="card-label">
            <DollarSign size={16} color="var(--accent-primary)" />
            <span>累計交易總金額</span>
          </div>
          <div className="card-value" style={{ fontSize: '1.8rem', padding: '0.2rem 0', fontFamily: 'Outfit' }}>
            NT$ {Math.round(totalVolume).toLocaleString()}
          </div>
          <div className="card-subtext" style={{ color: 'var(--text-secondary)' }}>
            歷史交易週轉合算
          </div>
        </div>

        <div className="glass-card">
          <div className="card-label">
            <Coins size={16} color="var(--accent-purple)" />
            <span>累計繳納手續費</span>
          </div>
          <div className="card-value" style={{ fontSize: '1.8rem', padding: '0.2rem 0', fontFamily: 'Outfit', color: 'var(--accent-purple)' }}>
            NT$ {Math.round(totalFeesPaid).toLocaleString()}
          </div>
          <div className="card-subtext" style={{ color: 'var(--text-secondary)' }}>
            券商手續費累積 (0.1425%)
          </div>
        </div>

        <div className="glass-card">
          <div className="card-label">
            <Coins size={16} color="var(--trend-up)" />
            <span>累計繳納證交稅</span>
          </div>
          <div className="card-value" style={{ fontSize: '1.8rem', padding: '0.2rem 0', fontFamily: 'Outfit', color: 'var(--trend-up)' }}>
            NT$ {Math.round(totalTaxesPaid).toLocaleString()}
          </div>
          <div className="card-subtext" style={{ color: 'var(--text-secondary)' }}>
            政府交易稅累積 (0.3% 賣出時)
          </div>
        </div>
      </div>

      {/* Transactions Table list */}
      <div className="glass-card" style={{ padding: '1.5rem' }}>
        <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <History size={18} color="var(--accent-primary)" />
          <span>歷史買賣明細紀錄</span>
        </h3>
        
        <div className="table-container">
          {displayTransactions.length > 0 ? (
            <table className="custom-table">
              <thead>
                <tr>
                  <th>交易日期</th>
                  <th>股票個股</th>
                  <th>交易別</th>
                  <th style={{ textAlign: 'right' }}>成交價</th>
                  <th style={{ textAlign: 'right' }}>股數</th>
                  <th style={{ textAlign: 'right' }}>手續費</th>
                  <th style={{ textAlign: 'right' }}>證交稅</th>
                  <th style={{ textAlign: 'right' }}>交易淨額</th>
                  <th style={{ width: '60px' }}></th>
                </tr>
              </thead>
              <tbody>
                {displayTransactions.map((tx) => {
                  const code = tx.symbol.split('.')[0];
                  const name = quotes[tx.symbol]?.name || '台股個股';
                  const isBuy = tx.type === 'buy';
                  
                  // Compute Net Transaction Value (buy includes fee, sell subtracts fee and tax)
                  const principal = tx.price * tx.shares;
                  const netValue = isBuy ? (principal + tx.fee) : (principal - tx.fee - tx.tax);
                  
                  return (
                    <tr key={tx.id}>
                      <td style={{ color: 'var(--text-secondary)', fontFamily: 'Outfit, sans-serif' }}>
                        {tx.date}
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span className="stock-code">{code}</span>
                          <span className="stock-name" style={{ fontSize: '0.75rem' }}>{name}</span>
                        </div>
                      </td>
                      <td>
                        <span 
                          className={`badge ${isBuy ? 'trend-indicator-up' : 'trend-indicator-down'}`}
                          style={{ 
                            padding: '0.35rem 0.75rem', 
                            borderRadius: '8px', 
                            fontSize: '0.75rem', 
                            fontWeight: 700,
                            background: isBuy ? 'rgba(239, 68, 68, 0.15)' : 'rgba(34, 197, 94, 0.15)'
                          }}
                        >
                          {isBuy ? '買入 (+)' : '賣出 (-)'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600, fontFamily: 'Outfit' }}>
                        NT$ {tx.price.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600, fontFamily: 'Outfit' }}>
                        {tx.shares.toLocaleString()} 股
                      </td>
                      <td style={{ textAlign: 'right', color: 'var(--text-muted)', fontFamily: 'Outfit' }}>
                        {tx.fee > 0 ? `NT$ ${tx.fee}` : '-'}
                      </td>
                      <td style={{ textAlign: 'right', color: 'var(--text-muted)', fontFamily: 'Outfit' }}>
                        {tx.tax > 0 ? `NT$ ${tx.tax}` : '-'}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'Outfit', color: isBuy ? '#fff' : 'var(--trend-up)' }}>
                        NT$ {Math.round(netValue).toLocaleString()}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button className="btn-icon" onClick={() => handleDelete(tx)} title="刪除交易紀錄">
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', height: '240px', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
              <History size={36} style={{ marginBottom: '0.5rem', opacity: 0.5 }} />
              <p>目前沒有任何交易紀錄，請點擊右上角新增您的第一筆股票交易明細！</p>
            </div>
          )}
        </div>
      </div>

      {/* Add Transaction Modal */}
      {modalOpen && (
        <div className="modal-backdrop">
          <div className="modal-content glass-card" style={{ maxWidth: '520px', padding: '2rem' }}>
            <div className="modal-header">
              <h3>登記股票交易紀錄</h3>
              <button className="btn-icon" onClick={() => setModalOpen(false)}>
                <X size={20} />
              </button>
            </div>
            
            {errorMsg && <div className="error-message" style={{ margin: '0 0 1rem 0' }}>{errorMsg}</div>}
            
            <form onSubmit={handleSubmit}>
              {/* Type toggle */}
              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label className="form-label">交易類型</label>
                <div style={{ display: 'flex', gap: '0.5rem', background: 'rgba(255,255,255,0.03)', borderRadius: '10px', padding: '0.25rem' }}>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => setType('buy')}
                    style={{
                      flexGrow: 1,
                      padding: '0.5rem',
                      background: type === 'buy' ? 'var(--trend-up)' : 'transparent',
                      color: '#fff',
                      borderRadius: '8px',
                      fontSize: '0.85rem',
                      fontWeight: 700
                    }}
                  >
                    買入個股 (+)
                  </button>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => setType('sell')}
                    style={{
                      flexGrow: 1,
                      padding: '0.5rem',
                      background: type === 'sell' ? 'var(--trend-down)' : 'transparent',
                      color: '#fff',
                      borderRadius: '8px',
                      fontSize: '0.85rem',
                      fontWeight: 700
                    }}
                  >
                    賣出個股 (-)
                  </button>
                </div>
              </div>

              {/* Autocomplete Ticker search */}
              <div className="form-group" style={{ position: 'relative', marginBottom: '1.25rem' }}>
                <label className="form-label">搜尋並選擇台股</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="輸入股票代號或中文名稱...（如 2330 或 台積電）"
                  value={searchTerm}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  required
                />
                
                {showSuggestions && suggestions.length > 0 && (
                  <ul className="suggestions-list" style={{ position: 'absolute', width: '100%', top: '100%', left: 0, zIndex: 100, maxHeight: '200px', overflowY: 'auto' }}>
                    {suggestions.map((s) => (
                      <li
                        key={s.symbol}
                        onClick={() => handleSelectSuggestion(s)}
                        className="suggestion-item"
                        style={{ display: 'flex', justifyContent: 'space-between', padding: '0.65rem 1rem' }}
                      >
                        <div>
                          <span style={{ fontWeight: 700, color: 'var(--accent-primary)' }}>{s.code}</span>
                          <span style={{ marginLeft: '0.5rem', color: '#fff' }}>{s.name}</span>
                          <span style={{ marginLeft: '0.5rem', fontSize: '0.7rem', color: 'var(--text-muted)' }}>({s.market})</span>
                        </div>
                        <div style={{ fontWeight: 700, fontFamily: 'Outfit' }}>
                          NT$ {s.price}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Date selection */}
              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label className="form-label">交易日期</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="date"
                    className="form-input"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="grid-cols-2" style={{ gap: '1rem', marginBottom: '1.25rem' }}>
                {/* Price */}
                <div className="form-group">
                  <label className="form-label">成交單價 (NT$)</label>
                  <input
                    type="number"
                    step="0.05"
                    min="0.1"
                    className="form-input"
                    placeholder="例如 950.0"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    required
                  />
                </div>

                {/* Shares */}
                <div className="form-group">
                  <label className="form-label">成交股數 (股)</label>
                  <input
                    type="number"
                    min="1"
                    className="form-input"
                    placeholder="例如 1000"
                    value={shares}
                    onChange={(e) => setShares(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="grid-cols-2" style={{ gap: '1rem', marginBottom: '1.5rem' }}>
                {/* Broker Fee */}
                <div className="form-group">
                  <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>手續費 (NT$)</span>
                    <span 
                      style={{ fontSize: '0.7rem', color: isManualFee ? 'var(--accent-primary)' : 'var(--text-muted)', cursor: 'pointer' }}
                      onClick={() => setIsManualFee(!isManualFee)}
                    >
                      {isManualFee ? '🔓 自動計算' : '🔒 手動輸入'}
                    </span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    className="form-input"
                    value={fee}
                    onChange={(e) => { setFee(e.target.value); setIsManualFee(true); }}
                    disabled={!isManualFee}
                    required
                  />
                </div>

                {/* Tax */}
                <div className="form-group">
                  <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>證交稅 (NT$)</span>
                    <span 
                      style={{ fontSize: '0.7rem', color: isManualTax ? 'var(--accent-primary)' : 'var(--text-muted)', cursor: 'pointer' }}
                      onClick={() => setIsManualTax(!isManualTax)}
                    >
                      {isManualTax ? '🔓 自動計算' : '🔒 手動輸入'}
                    </span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    className="form-input"
                    value={tax}
                    onChange={(e) => { setTax(e.target.value); setIsManualTax(true); }}
                    disabled={!isManualTax || type === 'buy'}
                    required
                  />
                </div>
              </div>

              {/* Form submit */}
              <div className="modal-footer" style={{ padding: '1rem 0 0 0' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setModalOpen(false)}
                  style={{ flexGrow: 1 }}
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ flexGrow: 2 }}
                  disabled={loading}
                >
                  {loading ? '儲存中...' : '確認登記'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TransactionsTab;
