import { useState, useEffect } from 'react';
import { LayoutDashboard, Wallet, BarChart3, Bell, Menu, X, Landmark, History, Coins } from 'lucide-react';
import DashboardTab from './components/DashboardTab';
import PortfolioTab from './components/PortfolioTab';
import AnalysisTab from './components/AnalysisTab';
import NotificationTab from './components/NotificationTab';
import TransactionsTab from './components/TransactionsTab';
import DividendsTab from './components/DividendsTab';

export interface StockItem {
  symbol: string;
  shares: number;
  avgCost?: number;
  totalCost?: number;
  realizedProfit?: number;
  unrealizedProfit?: number;
  currentValue?: number;
  changePercent?: number;
  name?: string;
}

export interface NotificationSettings {
  lineToken: string;
  discordWebhook: string;
  notifyTime: string;
  enabled: boolean;
}

export interface StockQuote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  prevClose: number;
  open: number;
  high: number;
  low: number;
  volume: number;
  eps: number;
  pe: number;
  pb: number;
  dividendYield: number;
  marketCap: number;
  isMock?: boolean;
}

function App() {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  
  // Application Data States
  const [transactions, setTransactions] = useState<any[]>([]);
  const [stocks, setStocks] = useState<StockItem[]>([]);
  const [settings, setSettings] = useState<NotificationSettings>({
    lineToken: '',
    discordWebhook: '',
    notifyTime: '14:00',
    enabled: false,
  });
  
  const [quotes, setQuotes] = useState<Record<string, StockQuote>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedSymbolForAnalysis, setSelectedSymbolForAnalysis] = useState<string>('2330.TW');

  // Fetch initial portfolio and configurations
  const fetchPortfolio = async () => {
    try {
      const response = await fetch('/api/portfolio');
      if (response.ok) {
        const data = await response.json();
        setTransactions(data.transactions || []);
        setStocks(data.stocks || []);
        setSettings(data.settings || {
          lineToken: '',
          discordWebhook: '',
          notifyTime: '14:00',
          enabled: false,
        });
        
        // Trigger quotes fetch for all loaded stocks
        if (data.stocks && data.stocks.length > 0) {
          fetchQuotes(data.stocks);
        } else {
          setLoading(false);
        }
      }
    } catch (error) {
      console.error('Error fetching portfolio data:', error);
      setLoading(false);
    }
  };

  // Fetch real-time quotes for all stocks in portfolio
  const fetchQuotes = async (stockList: StockItem[]) => {
    setLoading(true);
    const newQuotes: Record<string, StockQuote> = {};
    
    try {
      await Promise.all(
        stockList.map(async (stock) => {
          try {
            const res = await fetch(`/api/stock/quote/${stock.symbol}`);
            if (res.ok) {
              const quoteData: StockQuote = await res.json();
              newQuotes[stock.symbol] = quoteData;
            }
          } catch (e) {
            console.error(`Error loading quote for ${stock.symbol}:`, e);
          }
        })
      );
      setQuotes(newQuotes);
    } catch (err) {
      console.error('Error fetching batch quotes:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPortfolio();
  }, []);

  // Update backend database (stocks & settings)
  const savePortfolioData = async (updatedStocks: StockItem[], updatedSettings?: NotificationSettings) => {
    const payload = {
      stocks: updatedStocks,
      settings: updatedSettings || settings,
    };

    try {
      const response = await fetch('/api/portfolio', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const result = await response.json();
        setStocks(result.data.stocks);
        setSettings(result.data.settings);
        
        // Refresh quotes
        fetchQuotes(result.data.stocks);
        return true;
      }
    } catch (err) {
      console.error('Error saving portfolio data:', err);
    }
    return false;
  };

  // Callback to add/update shares and average cost of a stock
  const handleAddOrUpdateStock = async (symbol: string, shares: number, avgCost?: number) => {
    const formattedSymbol = symbol.trim().toUpperCase();
    
    // Auto-append .TW or .TWO if user entered just code
    let finalSymbol = formattedSymbol;
    if (!formattedSymbol.includes('.')) {
      // By default, assume .TW (Listed stocks). We will fallback in API anyway
      finalSymbol = `${formattedSymbol}.TW`;
    }

    const index = stocks.findIndex(s => s.symbol === finalSymbol);
    let updatedStocks = [...stocks];
    if (index >= 0) {
      updatedStocks[index] = { 
        symbol: finalSymbol, 
        shares, 
        avgCost: avgCost !== undefined ? avgCost : stocks[index].avgCost 
      };
    } else {
      updatedStocks.push({ 
        symbol: finalSymbol, 
        shares, 
        avgCost: avgCost || 0 
      });
    }

    return await savePortfolioData(updatedStocks);
  };

  // Callback to delete a stock
  const handleDeleteStock = async (symbol: string) => {
    const updatedStocks = stocks.filter(s => s.symbol !== symbol);
    return await savePortfolioData(updatedStocks);
  };

  // Callback to update settings
  const handleSaveSettings = async (newSettings: NotificationSettings) => {
    return await savePortfolioData(stocks, newSettings);
  };

  // Quick navigate to analysis
  const navigateToAnalysis = (symbol: string) => {
    setSelectedSymbolForAnalysis(symbol);
    setActiveTab('analysis');
  };

  return (
    <div className="app-container">
      {/* Mobile Top Header */}
      <div className="mobile-topbar">
        <div className="logo-section" style={{ marginBottom: 0 }}>
          <Landmark size={28} color="var(--accent-primary)" />
          <h1 style={{ fontSize: '1.25rem' }}>台股智慧資產</h1>
        </div>
        <button className="hamburger" onClick={() => setSidebarOpen(!sidebarOpen)}>
          {sidebarOpen ? <X size={26} /> : <Menu size={26} />}
        </button>
      </div>

      {/* Sidebar Navigation */}
      <div className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="logo-section">
          <Landmark size={32} color="var(--accent-primary)" style={{ filter: 'drop-shadow(0 0 10px rgba(37,99,235,0.4))' }} />
          <h1>台股智慧資產</h1>
        </div>

        <ul className="nav-links">
          <li className="nav-item">
            <button
              className={`nav-button ${activeTab === 'dashboard' ? 'active' : ''}`}
              onClick={() => { setActiveTab('dashboard'); setSidebarOpen(false); }}
            >
              <LayoutDashboard />
              <span>資產總覽</span>
            </button>
          </li>
          <li className="nav-item">
            <button
              className={`nav-button ${activeTab === 'portfolio' ? 'active' : ''}`}
              onClick={() => { setActiveTab('portfolio'); setSidebarOpen(false); }}
            >
              <Wallet />
              <span>持股管理</span>
            </button>
          </li>
          <li className="nav-item">
            <button
              className={`nav-button ${activeTab === 'transactions' ? 'active' : ''}`}
              onClick={() => { setActiveTab('transactions'); setSidebarOpen(false); }}
            >
              <History />
              <span>交易帳本</span>
            </button>
          </li>
          <li className="nav-item">
            <button
              className={`nav-button ${activeTab === 'dividends' ? 'active' : ''}`}
              onClick={() => { setActiveTab('dividends'); setSidebarOpen(false); }}
            >
              <Coins />
              <span>除權息分析</span>
            </button>
          </li>
          <li className="nav-item">
            <button
              className={`nav-button ${activeTab === 'analysis' ? 'active' : ''}`}
              onClick={() => { setActiveTab('analysis'); setSidebarOpen(false); }}
            >
              <BarChart3 />
              <span>技術面分析</span>
            </button>
          </li>
          <li className="nav-item">
            <button
              className={`nav-button ${activeTab === 'notifications' ? 'active' : ''}`}
              onClick={() => { setActiveTab('notifications'); setSidebarOpen(false); }}
            >
              <Bell />
              <span>收盤回報設定</span>
            </button>
          </li>
        </ul>

        <div className="sidebar-footer">
          <div className="status-badge">
            <span className={`status-dot ${settings.enabled ? 'active' : ''}`} />
            <span>收盤通知：{settings.enabled ? `開啟 (${settings.notifyTime})` : '關閉'}</span>
          </div>
          {Object.values(quotes).some(q => q.isMock) && (
            <div className="status-badge" style={{ color: 'var(--trend-up)', fontSize: '0.75rem' }}>
              ⚠️ 注意：目前使用模擬數據
            </div>
          )}
        </div>
      </div>

      {/* Main Page Area */}
      <div className="main-content">
        {loading && Object.keys(quotes).length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', height: '80vh', alignItems: 'center', justifyContent: 'center', gap: '1rem' }}>
            <div style={{ width: '40px', height: '40px', border: '3px solid rgba(255,255,255,0.1)', borderTopColor: 'var(--accent-primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            <p style={{ color: 'var(--text-secondary)' }}>正在載入即時台股數據...</p>
            <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
          </div>
        ) : (
          <>
            {activeTab === 'dashboard' && (
              <DashboardTab
                stocks={stocks}
                quotes={quotes}
                navigateToAnalysis={navigateToAnalysis}
              />
            )}
            
            {activeTab === 'portfolio' && (
              <PortfolioTab
                stocks={stocks}
                quotes={quotes}
                onAddStock={handleAddOrUpdateStock}
                onDeleteStock={handleDeleteStock}
                navigateToAnalysis={navigateToAnalysis}
              />
            )}

            {activeTab === 'transactions' && (
              <TransactionsTab
                transactions={transactions}
                quotes={quotes}
                onAddTransaction={async (tx) => {
                  try {
                    const res = await fetch('/api/portfolio/transaction', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(tx)
                    });
                    if (res.ok) {
                      fetchPortfolio();
                      return true;
                    }
                  } catch (e) {
                    console.error('Error adding transaction:', e);
                  }
                  return false;
                }}
                onDeleteTransaction={async (id) => {
                  try {
                    const res = await fetch(`/api/portfolio/transaction/${id}`, {
                      method: 'DELETE'
                    });
                    if (res.ok) {
                      fetchPortfolio();
                      return true;
                    }
                  } catch (e) {
                    console.error('Error deleting transaction:', e);
                  }
                  return false;
                }}
              />
            )}

            {activeTab === 'dividends' && (
              <DividendsTab
                stocks={stocks}
                quotes={quotes}
                transactions={transactions}
              />
            )}
            
            {activeTab === 'analysis' && (
              <AnalysisTab
                stocks={stocks}
                quotes={quotes}
                selectedSymbol={selectedSymbolForAnalysis}
                setSelectedSymbol={setSelectedSymbolForAnalysis}
              />
            )}
            
            {activeTab === 'notifications' && (
              <NotificationTab
                settings={settings}
                onSaveSettings={handleSaveSettings}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default App;
