import React, { useState, useEffect } from 'react';
import { Chart as ChartJS, registerables, ChartData, ChartOptions } from 'chart.js';
import { Doughnut, Line } from 'react-chartjs-2';
import { TrendingUp, TrendingDown, Layers, Award, DollarSign, ArrowUpRight, RefreshCw, BarChart2 } from 'lucide-react';
import { StockItem, StockQuote } from '../App';

ChartJS.register(...registerables);

interface DashboardTabProps {
  stocks: StockItem[];
  quotes: Record<string, StockQuote>;
  navigateToAnalysis: (symbol: string) => void;
}

const DashboardTab: React.FC<DashboardTabProps> = ({ stocks, quotes, navigateToAnalysis }) => {
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(true);

  // Fetch 1-year NAV history from backend
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const response = await fetch('/api/portfolio/history');
        if (response.ok) {
          const data = await response.json();
          setHistoryData(data);
        }
      } catch (err) {
        console.error('Error fetching NAV history:', err);
      } finally {
        setLoadingHistory(false);
      }
    };
    fetchHistory();
  }, [stocks]);

  // Calculate portfolio P&L metrics
  let totalValue = 0;
  let totalPrevValue = 0;
  let totalCost = 0;
  let totalRealized = 0;
  let totalUnrealized = 0;
  
  let highestValueStock = { name: '無', value: 0 };
  let biggestWinner = { name: '無', changePercent: -Infinity };

  stocks.forEach((item) => {
    totalRealized += item.realizedProfit || 0;
    
    if (item.shares > 0) {
      totalValue += item.currentValue || 0;
      totalCost += item.totalCost || 0;
      totalUnrealized += item.unrealizedProfit || 0;

      // Compute total prev value for today P&L
      const quote = quotes[item.symbol];
      if (quote) {
        totalPrevValue += quote.prevClose * item.shares;
        
        if (quote.changePercent > biggestWinner.changePercent) {
          biggestWinner = { name: quote.name, changePercent: quote.changePercent };
        }
      }
      
      const currentVal = item.currentValue || 0;
      if (currentVal > highestValueStock.value) {
        highestValueStock = { name: quote?.name || item.symbol.split('.')[0], value: currentVal };
      }
    }
  });

  const dailyGainLoss = totalValue - totalPrevValue;
  const dailyGainLossPercent = totalPrevValue > 0 ? (dailyGainLoss / totalPrevValue) * 100 : 0;
  const isDailyProfit = dailyGainLoss >= 0;
  const isUnrealizedProfit = totalUnrealized >= 0;
  const isRealizedProfit = totalRealized >= 0;

  // Prepare chart data for Doughnut
  const activeStocks = stocks.filter(s => s.shares > 0);
  const doughnutLabels = activeStocks.map(item => quotes[item.symbol]?.name || item.symbol.split('.')[0]);
  const doughnutDataValues = activeStocks.map(item => Math.round(item.currentValue || 0));

  const doughnutColors = [
    'rgba(37, 99, 235, 0.75)',   // Electric Blue
    'rgba(139, 92, 246, 0.75)',  // Cyber Purple
    'rgba(6, 182, 212, 0.75)',   // Cyan
    'rgba(236, 72, 153, 0.75)',  // Soft Pink
    'rgba(245, 158, 11, 0.75)',  // Neon Orange
    'rgba(16, 185, 129, 0.75)',  // Emerald Green
  ];

  const doughnutBorders = [
    'rgb(37, 99, 235)',
    'rgb(139, 92, 246)',
    'rgb(6, 182, 212)',
    'rgb(236, 72, 153)',
    'rgb(245, 158, 11)',
    'rgb(16, 185, 129)',
  ];

  const doughnutData: ChartData<'doughnut'> = {
    labels: doughnutLabels,
    datasets: [
      {
        data: doughnutDataValues,
        backgroundColor: doughnutColors.slice(0, activeStocks.length),
        borderColor: doughnutBorders.slice(0, activeStocks.length),
        borderWidth: 1.5,
        hoverOffset: 8,
      },
    ],
  };

  const doughnutOptions: ChartOptions<'doughnut'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right',
        labels: {
          color: 'hsl(215, 20%, 70%)',
          font: { family: 'Outfit', size: 12 },
          boxHeight: 2,
          padding: 10,
        },
      },
      tooltip: {
        backgroundColor: 'rgba(10, 15, 30, 0.95)',
        titleColor: '#fff',
        bodyColor: 'hsl(215, 20%, 70%)',
        borderColor: 'rgba(255,255,255,0.08)',
        borderWidth: 1,
        padding: 12,
        callbacks: {
          label: (context) => {
            const val = context.parsed;
            const pct = totalValue > 0 ? ((val / totalValue) * 100).toFixed(1) : '0';
            return ` 市值: NT$ ${val.toLocaleString()} (${pct}%)`;
          },
        },
      },
    },
    cutout: '65%',
  };

  // Prepare line chart data for NAV comparison
  const getNAVLineChartData = () => {
    return {
      labels: historyData.map(h => h.label),
      datasets: [
        {
          label: '您的投資組合收益率 (%)',
          data: historyData.map(h => h.portfolioReturn),
          borderColor: 'rgb(139, 92, 246)', // cyber purple
          backgroundColor: 'rgba(139, 92, 246, 0.05)',
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.15,
          fill: true,
        },
        {
          label: '台股加權指數報酬率 (%)',
          data: historyData.map(h => h.benchmarkReturn),
          borderColor: 'rgba(255, 255, 255, 0.25)', // translucent white/slate
          borderDash: [5, 5],
          borderWidth: 1.5,
          pointRadius: 0,
          tension: 0.15,
        }
      ]
    };
  };

  const navLineChartOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      legend: {
        position: 'top',
        labels: {
          color: 'hsl(215, 20%, 70%)',
          font: { family: 'Outfit', size: 11 },
          boxHeight: 2,
        }
      },
      tooltip: {
        backgroundColor: 'rgba(10, 15, 30, 0.95)',
        titleColor: '#fff',
        bodyColor: 'hsl(215, 20%, 70%)',
        borderColor: 'rgba(255,255,255,0.08)',
        borderWidth: 1,
        padding: 10,
        callbacks: {
          label: (context: any) => ` ${context.dataset.label}: ${context.raw >= 0 ? '+' : ''}${context.raw.toFixed(2)}%`
        }
      }
    },
    scales: {
      x: {
        grid: { color: 'rgba(255, 255, 255, 0.02)' },
        ticks: { color: 'hsl(215, 15%, 50%)', font: { family: 'Outfit', size: 10 } }
      },
      y: {
        position: 'right',
        grid: { color: 'rgba(255, 255, 255, 0.04)' },
        ticks: { 
          color: 'hsl(215, 20%, 70%)', 
          font: { family: 'Outfit', size: 10 },
          callback: (value: any) => `${value >= 0 ? '+' : ''}${value}%`
        }
      }
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>資產總覽</h2>
          <p>即時追蹤您的庫存台股市值與歷年交易損益，回溯演算財富累積曲線</p>
        </div>
      </div>

      {/* Main Asset Metric cards */}
      <div className="grid-cols-3" style={{ marginBottom: '1.5rem' }}>
        <div className="glass-card" style={{ borderLeft: `4px solid ${isDailyProfit ? 'var(--trend-up)' : 'var(--trend-down)'}` }}>
          <div className="card-label">
            <DollarSign size={16} />
            <span>總資產估計市值</span>
          </div>
          <div className="card-value" style={{ fontFamily: 'Outfit' }}>
            NT$ {Math.round(totalValue).toLocaleString()}
          </div>
          <div className={`card-subtext ${isDailyProfit ? 'trend-up' : 'trend-down'}`}>
            {isDailyProfit ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
            <span>
              今日損益：{isDailyProfit ? '+' : ''}{Math.round(dailyGainLoss).toLocaleString()} ({isDailyProfit ? '+' : ''}{dailyGainLossPercent.toFixed(2)}%)
            </span>
          </div>
        </div>

        <div className="glass-card" style={{ borderLeft: `4px solid ${isUnrealizedProfit ? 'var(--trend-up)' : 'var(--trend-down)'}` }}>
          <div className="card-label">
            <Layers size={16} color={isUnrealizedProfit ? 'var(--trend-up)' : 'var(--trend-down)'} />
            <span>累計未實現損益 (帳面)</span>
          </div>
          <div className={`card-value ${isUnrealizedProfit ? 'trend-up' : 'trend-down'}`} style={{ fontFamily: 'Outfit' }}>
            {isUnrealizedProfit ? '+' : ''}NT$ {Math.round(totalUnrealized).toLocaleString()}
          </div>
          <div className="card-subtext" style={{ color: 'var(--text-secondary)' }}>
            平均成本持有報酬率：**{totalCost > 0 ? `${isUnrealizedProfit ? '+' : ''}${((totalUnrealized / totalCost) * 100).toFixed(2)}%` : '0.00%' }**
          </div>
        </div>

        <div className="glass-card" style={{ borderLeft: `4px solid ${isRealizedProfit ? 'var(--trend-up)' : 'var(--trend-down)'}` }}>
          <div className="card-label">
            <Award size={16} color="var(--accent-purple)" />
            <span>累計已實現損益 (落袋)</span>
          </div>
          <div className="card-value" style={{ fontFamily: 'Outfit', color: 'var(--accent-purple)' }}>
            {isRealizedProfit ? '+' : ''}NT$ {Math.round(totalRealized).toLocaleString()}
          </div>
          <div className="card-subtext" style={{ color: 'var(--text-secondary)' }}>
            歷史已結算股票交易淨獲利
          </div>
        </div>
      </div>

      {/* NAV comparative line chart */}
      <div className="glass-card" style={{ marginBottom: '1.5rem', padding: '1.5rem', height: '320px', display: 'flex', flexDirection: 'column' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <BarChart2 size={18} color="var(--accent-primary)" />
          <span>1年期資產淨值歷史增長曲線 vs 台股大盤報酬率 (^TWII)</span>
        </h3>
        
        <div style={{ position: 'relative', flexGrow: 1 }}>
          {loadingHistory ? (
            <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
              <RefreshCw size={18} style={{ animation: 'spin 1.5s linear infinite', marginRight: '0.5rem' }} />
              <span>回溯計算資產淨值中...</span>
            </div>
          ) : historyData.length > 0 ? (
            <Line data={getNAVLineChartData()} options={navLineChartOptions} />
          ) : (
            <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
              歷史數據不足。請先在「交易帳本」中新增您的股票交易明細，以利反推歷史資產價值！
            </div>
          )}
        </div>
      </div>

      {/* Charts & Statistics */}
      <div className="grid-cols-2">
        {/* Left Side: Asset Allocation Chart */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '1.5rem' }}>資產分配佔比</h3>
          {activeStocks.length > 0 ? (
            <div style={{ position: 'relative', height: '240px', flexGrow: 1 }}>
              <Doughnut data={doughnutData} options={doughnutOptions} />
            </div>
          ) : (
            <div style={{ display: 'flex', flexGrow: 1, alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
              無持股資料，請至「持股管理」或「交易帳本」新增買入。
            </div>
          )}
        </div>

        {/* Right Side: Quick portfolio overview table */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="flex-header" style={{ marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>持股現況簡介</h3>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>庫存：{activeStocks.length} 檔</span>
          </div>
          
          <div className="table-container" style={{ flexGrow: 1 }}>
            {activeStocks.length > 0 ? (
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>個股</th>
                    <th style={{ textAlign: 'right' }}>現價</th>
                    <th style={{ textAlign: 'right' }}>均價/未實現</th>
                    <th style={{ textAlign: 'right' }}>庫存市值</th>
                  </tr>
                </thead>
                <tbody>
                  {activeStocks.map((item) => {
                    const quote = quotes[item.symbol];
                    const val = item.currentValue || 0;
                    const unrealized = item.unrealizedProfit || 0;
                    const isUnrealizedUp = unrealized >= 0;

                    return (
                      <tr key={item.symbol}>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span className="stock-code">{item.symbol.split('.')[0]}</span>
                            <span className="stock-name" style={{ fontSize: '0.75rem' }}>{item.name}</span>
                          </div>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'Outfit, sans-serif' }}>
                          {quote ? `NT$ ${quote.price.toLocaleString()}` : '-'}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'end' }}>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>均價: NT$ {Math.round(item.avgCost || 0)}</span>
                            <span style={{ fontWeight: 600, fontSize: '0.85rem' }} className={isUnrealizedUp ? 'trend-indicator-up' : 'trend-indicator-down'}>
                              {isUnrealizedUp ? '+' : ''}{Math.round(unrealized).toLocaleString()}
                            </span>
                          </div>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'Outfit, sans-serif' }}>
                          <button 
                            onClick={() => navigateToAnalysis(item.symbol)}
                            className="btn-icon" 
                            style={{ float: 'right', marginLeft: '0.5rem' }} 
                            title="技術分析"
                          >
                            <ArrowUpRight size={16} />
                          </button>
                          NT$ {Math.round(val).toLocaleString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', minHeight: '180px' }}>
                目前無持股。請前往「交易帳本」分頁登錄您的股票交易明細！
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardTab;
