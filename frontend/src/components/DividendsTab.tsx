import React, { useState, useEffect } from 'react';
import { Coins, Calendar, TrendingUp, RefreshCw, BarChart2 } from 'lucide-react';
import { Bar } from 'react-chartjs-2';
import { StockItem, StockQuote } from '../App';

interface DividendEvent {
  date: string;
  amount: number;
}

interface DividendsTabProps {
  stocks: StockItem[];
  quotes: Record<string, StockQuote>;
  transactions?: any[];
}

const DividendsTab: React.FC<DividendsTabProps> = ({ stocks, quotes, transactions = [] }) => {
  const [loading, setLoading] = useState(true);
  const [dividendRecords, setDividendRecords] = useState<any[]>([]);
  const [selectedFilterSymbol, setSelectedFilterSymbol] = useState<string>('all');

  // Fetch dividend history for all active stocks in portfolio
  const fetchAllDividends = async () => {
    setLoading(true);
    const activeStocks = stocks.filter(s => s.shares > 0);
    const allRecords: any[] = [];

    try {
      await Promise.all(
        activeStocks.map(async (stock) => {
          try {
            const res = await fetch(`/api/stock/dividends/${stock.symbol}`);
            if (res.ok) {
              const data: DividendEvent[] = await res.json();
              data.forEach(evt => {
                // Calculate historical shares owned on ex-date chronologically
                let sharesOnExDate = stock.shares;
                let isCalculatedChronologically = false;

                if (transactions && transactions.length > 0) {
                  const txsForStock = transactions.filter((t: any) => t.symbol === stock.symbol);
                  if (txsForStock.length > 0) {
                    isCalculatedChronologically = true;
                    let calculatedShares = 0;
                    txsForStock.forEach((tx: any) => {
                      if (tx.date < evt.date) {
                        if (tx.type === 'buy') {
                          calculatedShares += tx.shares;
                        } else if (tx.type === 'sell') {
                          calculatedShares -= tx.shares;
                        }
                      }
                    });
                    sharesOnExDate = Math.max(0, calculatedShares);
                  }
                }

                const totalDividend = sharesOnExDate * evt.amount;
                allRecords.push({
                  symbol: stock.symbol,
                  code: stock.symbol.split('.')[0],
                  name: quotes[stock.symbol]?.name || stock.symbol,
                  shares: sharesOnExDate,
                  exDate: evt.date,
                  amountPerShare: evt.amount,
                  totalAmount: totalDividend,
                  year: evt.date.substring(0, 4),
                  month: evt.date.substring(5, 7),
                  isCalculatedChronologically
                });
              });
            }
          } catch (e) {
            console.error(`Error loading dividends for ${stock.symbol}:`, e);
          }
        })
      );

      // Sort chronological descending (most recent ex-date first)
      allRecords.sort((a, b) => new Date(b.exDate).getTime() - new Date(a.exDate).getTime());
      setDividendRecords(allRecords);
    } catch (err) {
      console.error('Error fetching batch dividends:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (stocks.length > 0) {
      fetchAllDividends();
    } else {
      setLoading(false);
    }
  }, [stocks]);

  // Calculations for Dividends Summary
  const activeStocks = stocks.filter(s => s.shares > 0);
  const totalPortfolioValue = activeStocks.reduce((acc, curr) => acc + ((quotes[curr.symbol]?.price || 0) * curr.shares), 0);

  // 1. Calculate Estimated Annual Dividend (預估未來12個月息收)
  // Formula: Sum of (Shares * current price * dividend yield %) or (Shares * average 1y payout)
  let estimatedAnnualDividend = 0;
  activeStocks.forEach(stock => {
    const quote = quotes[stock.symbol];
    if (quote) {
      const yieldPct = quote.dividendYield || 0;
      estimatedAnnualDividend += (quote.price * stock.shares * (yieldPct / 100));
    }
  });

  const portfolioDividendYield = totalPortfolioValue > 0 ? (estimatedAnnualDividend / totalPortfolioValue) * 100 : 0;
  const totalCollectedDividends = dividendRecords.reduce((acc, curr) => acc + curr.totalAmount, 0);

  // 2. Prepare Chart Data (Group by monthly payouts for the past 12 months)
  const getMonthlyChartData = () => {
    const monthlySums: Record<string, number> = {};
    const months = [];
    const now = new Date();
    
    // Generate past 12 months labels
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = d.getFullYear().toString();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const label = `${year}-${month}`;
      months.push(label);
      monthlySums[label] = 0;
    }

    // Accumulate total payments into correct months
    dividendRecords.forEach(rec => {
      const key = `${rec.year}-${rec.month}`;
      if (monthlySums[key] !== undefined) {
        monthlySums[key] += rec.totalAmount;
      }
    });

    return {
      labels: months.map(m => {
        const [y, mm] = m.split('-');
        return `${y.substring(2)}/${mm}`;
      }),
      datasets: [
        {
          label: '月度預估除息股利收入 (NT$)',
          data: months.map(m => Math.round(monthlySums[m])),
          backgroundColor: 'rgba(139, 92, 246, 0.65)',
          borderColor: 'rgb(139, 92, 246)',
          borderWidth: 1.5,
          borderRadius: 6,
          barThickness: 24,
        }
      ]
    };
  };

  const chartOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        backgroundColor: 'rgba(10, 15, 30, 0.95)',
        titleColor: '#fff',
        bodyColor: 'hsl(215, 20%, 70%)',
        borderColor: 'rgba(255,255,255,0.08)',
        borderWidth: 1,
        padding: 10,
        callbacks: {
          label: (context: any) => ` 預估領息：NT$ ${context.raw.toLocaleString()} 元`
        }
      }
    },
    scales: {
      x: {
        grid: { color: 'rgba(255, 255, 255, 0.02)' },
        ticks: { color: 'hsl(215, 15%, 50%)', font: { family: 'Outfit' } }
      },
      y: {
        position: 'right',
        grid: { color: 'rgba(255, 255, 255, 0.04)' },
        ticks: { color: 'hsl(215, 20%, 70%)', font: { family: 'Outfit' } }
      }
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>股息年會計看板</h2>
          <p>整合歷年配息時程、動態預估投組未來12個月息收及每月被動現金流分配</p>
        </div>
      </div>

      {/* Aggregate Stats Cards */}
      <div className="grid-cols-3" style={{ marginBottom: '1.5rem' }}>
        <div className="glass-card" style={{ borderLeft: '4px solid var(--accent-purple)' }}>
          <div className="card-label">
            <Coins size={16} color="var(--accent-purple)" />
            <span>預估未來12個月總息收</span>
          </div>
          <div className="card-value" style={{ color: 'var(--accent-purple)', fontFamily: 'Outfit' }}>
            NT$ {Math.round(estimatedAnnualDividend).toLocaleString()}
          </div>
          <div className="card-subtext" style={{ color: 'var(--text-secondary)' }}>
            預估平均每月領取息收：**NT$ {Math.round(estimatedAnnualDividend / 12).toLocaleString()}**
          </div>
        </div>

        <div className="glass-card">
          <div className="card-label">
            <TrendingUp size={16} color="var(--trend-up)" />
            <span>證券綜合年化股利率</span>
          </div>
          <div className="card-value" style={{ fontFamily: 'Outfit' }}>
            {portfolioDividendYield.toFixed(2)} %
          </div>
          <div className="card-subtext" style={{ color: 'var(--text-secondary)' }}>
            依目前現股持股比重加權合算
          </div>
        </div>

        <div className="glass-card">
          <div className="card-label">
            <Calendar size={16} />
            <span>歷史已領取股利總額</span>
          </div>
          <div className="card-value" style={{ fontFamily: 'Outfit', color: 'var(--trend-up)' }}>
            NT$ {Math.round(totalCollectedDividends).toLocaleString()}
          </div>
          <div className="card-subtext" style={{ color: 'var(--text-secondary)' }}>
            以歷年除息紀錄反算累積得之
          </div>
        </div>
      </div>

      {loading ? (
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', height: '320px', alignItems: 'center', justifyContent: 'center', gap: '1rem' }}>
          <RefreshCw size={24} style={{ animation: 'spin 1.5s linear infinite', color: 'var(--accent-purple)' }} />
          <p style={{ color: 'var(--text-secondary)' }}>正在爬梳投組個股除權息歷年數據...</p>
        </div>
      ) : activeStocks.length === 0 ? (
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', height: '240px', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
          <Coins size={36} style={{ marginBottom: '0.5rem', opacity: 0.5 }} />
          <p>目前無持股，請前往「持股管理」或「交易帳本」新增持股以試算配息年收！</p>
        </div>
      ) : (
        <div className="grid-cols-3" style={{ gap: '1.5rem', alignItems: 'start' }}>
          {/* Left Chart Side */}
          <div className="glass-card" style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', height: '360px', padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <BarChart2 size={18} color="var(--accent-purple)" />
              <span>近 12 個月配息除息現金流分配</span>
            </h3>
            <div style={{ position: 'relative', flexGrow: 1 }}>
              <Bar data={getMonthlyChartData()} options={chartOptions} />
            </div>
          </div>

          {/* Right Dividends list */}
          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', height: '360px', padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                <Calendar size={18} color="var(--trend-up)" />
                <span>除權息歷年記錄明細</span>
              </h3>
              
              <select
                value={selectedFilterSymbol}
                onChange={(e) => setSelectedFilterSymbol(e.target.value)}
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '6px',
                  color: 'var(--text-primary)',
                  padding: '4px 8px',
                  fontSize: '0.85rem',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                <option value="all" style={{ background: '#0d1117', color: '#fff' }}>全部股票</option>
                {activeStocks.map(s => (
                  <option key={s.symbol} value={s.symbol} style={{ background: '#0d1117', color: '#fff' }}>
                    {s.symbol.split('.')[0]} {quotes[s.symbol]?.name || ''}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="table-container" style={{ flexGrow: 1, overflowY: 'auto' }}>
              {(() => {
                const filteredRecords = dividendRecords.filter(rec => {
                  if (selectedFilterSymbol === 'all') {
                    return rec.shares > 0;
                  } else {
                    return rec.symbol === selectedFilterSymbol;
                  }
                });

                return filteredRecords.length > 0 ? (
                  <table className="custom-table" style={{ fontSize: '0.85rem' }}>
                    <thead>
                      <tr>
                        <th>除息日</th>
                        <th>股票</th>
                        <th style={{ textAlign: 'right' }}>每股配息</th>
                        <th style={{ textAlign: 'right' }}>估計實領</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRecords.slice(0, 30).map((rec, idx) => (
                        <tr key={idx}>
                          <td style={{ color: 'var(--text-secondary)', fontFamily: 'Outfit' }}>{rec.exDate}</td>
                          <td>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span className="stock-code" style={{ fontSize: '0.8rem' }}>{rec.code}</span>
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{rec.shares.toLocaleString()} 股</span>
                            </div>
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 600, fontFamily: 'Outfit' }}>
                            NT$ {rec.amountPerShare.toFixed(2)}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'Outfit', color: 'var(--trend-up)' }}>
                            NT$ {Math.round(rec.totalAmount).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                    {selectedFilterSymbol === 'all' ? '無實際領取股息記錄。' : '暫無該股票歷年除息紀錄。'}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DividendsTab;
