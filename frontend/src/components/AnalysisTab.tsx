import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Chart as ChartJS, registerables } from 'chart.js';
import { Chart } from 'react-chartjs-2';
import 'chartjs-adapter-date-fns';
import { createChart, IChartApi } from 'lightweight-charts';
import { BookOpen, Newspaper, Calendar, RefreshCw, BarChart2, CalendarDays } from 'lucide-react';
import { StockItem, StockQuote } from '../App';

ChartJS.register(...registerables);

interface AnalysisTabProps {
  stocks: StockItem[];
  quotes: Record<string, StockQuote>;
  selectedSymbol: string;
  setSelectedSymbol: (symbol: string) => void;
}

interface ChartHistoryItem {
  time: number; // millisecond timestamp
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface NewsItem {
  title: string;
  link: string;
  date: string;
  source: string;
}

const AnalysisTab: React.FC<AnalysisTabProps> = ({
  stocks,
  quotes,
  selectedSymbol,
  setSelectedSymbol,
}) => {
  const [chartData, setChartData] = useState<ChartHistoryItem[]>([]);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loadingChart, setLoadingChart] = useState<boolean>(false);
  const [loadingNews, setLoadingNews] = useState<boolean>(false);
  const [instData, setInstData] = useState<any[]>([]);
  const [loadingInst, setLoadingInst] = useState<boolean>(false);

  // Technical Indicators Toggles
  const [showMA5, setShowMA5] = useState(true);
  const [showMA10, setShowMA10] = useState(true);
  const [showMA20, setShowMA20] = useState(true);
  const [showMA60, setShowMA60] = useState(false);
  const [activeIndicator, setActiveIndicator] = useState<'rsi' | 'macd' | 'kd'>('rsi');

  // K-Line Type State (Daily, Weekly, Monthly, Custom-N-Days)
  const [kLineType, setKLineType] = useState<'day' | 'week' | 'month' | 'custom'>('day');
  const [customDays, setCustomDays] = useState<number>(5); // Default to 5-day K

  // TradingView chart ref
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartApiRef = useRef<IChartApi | null>(null);

  // Load stock list symbols
  const stockSymbols = stocks.map(s => s.symbol);
  
  // Make sure selected symbol is valid, or default to TSMC
  useEffect(() => {
    if (stocks.length > 0 && !stockSymbols.includes(selectedSymbol)) {
      setSelectedSymbol(stocks[0].symbol);
    } else if (stocks.length === 0) {
      setSelectedSymbol('2330.TW');
    }
  }, [stocks]);

  // Fetch individual stock's K-Line chart data (1-year history for smooth zoom & aggregation) and News
  useEffect(() => {
    const fetchChartAndNews = async () => {
      if (!selectedSymbol) return;
      
      // 1. Fetch Chart Data (Always fetch 1y to have plenty of historical bars for Weekly/Monthly aggregation)
      setLoadingChart(true);
      try {
        const response = await fetch(`/api/stock/chart/${selectedSymbol}?range=1y`);
        if (response.ok) {
          const data = await response.json();
          setChartData(data.history || []);
        }
      } catch (err) {
        console.error('Error fetching stock chart history:', err);
      } finally {
        setLoadingChart(false);
      }

      // 2. Fetch Stock News
      setLoadingNews(true);
      try {
        const response = await fetch(`/api/stock/news/${selectedSymbol}`);
        if (response.ok) {
          const newsData = await response.json();
          setNews(newsData || []);
        }
      } catch (err) {
        console.error('Error fetching news:', err);
      } finally {
        setLoadingNews(false);
      }

      // 3. Fetch Stock Institutional Flow
      setLoadingInst(true);
      try {
        const response = await fetch(`/api/stock/institutions/${selectedSymbol}`);
        if (response.ok) {
          const data = await response.json();
          setInstData(data || []);
        }
      } catch (err) {
        console.error('Error fetching institutional flow:', err);
      } finally {
        setLoadingInst(false);
      }
    };

    fetchChartAndNews();
  }, [selectedSymbol]);

  const quote = quotes[selectedSymbol];

  // Helper to format millisecond timestamps to YYYY-MM-DD calendar string (highly stable for daily charts)
  function formatToDateString(timestamp: number): string {
    if (!timestamp || isNaN(timestamp)) return '';
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // --- K-LINE DYNAMIC AGGREGATION MATHEMATICS ---

  // Helper to get ISO Week String (safeguarded)
  function getYearWeekString(timestamp: number) {
    if (!timestamp || isNaN(timestamp)) return '';
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return '';
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
    const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1)/7);
    return `${d.getUTCFullYear()}-W${weekNo}`;
  }

  // Helper to get Year Month String (safeguarded)
  function getYearMonthString(timestamp: number) {
    if (!timestamp || isNaN(timestamp)) return '';
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return '';
    return `${date.getFullYear()}-${date.getMonth()}`;
  }

  // Aggregate single group of days into a K-bar (safeguarded against NaN and missing fields)
  function aggregateGroup(group: ChartHistoryItem[]): ChartHistoryItem {
    const sorted = [...group].sort((a, b) => a.time - b.time);
    const open = sorted[0].open || sorted[0].close || 0;
    const close = sorted[sorted.length - 1].close || sorted[sorted.length - 1].open || 0;
    
    const highs = sorted.map(s => s.high).filter(h => h !== null && h !== undefined && !isNaN(h));
    const lows = sorted.map(s => s.low).filter(l => l !== null && l !== undefined && !isNaN(l));
    
    const high = highs.length > 0 ? Math.max(...highs) : Math.max(open, close);
    const low = lows.length > 0 ? Math.min(...lows) : Math.min(open, close);
    const volume = sorted.reduce((acc, curr) => acc + (curr.volume || 0), 0);
    
    return {
      time: sorted[0].time, // first trading day time represents the group
      open,
      high,
      low,
      close,
      volume
    };
  }

  // Master Aggregator based on type (with strict deduplication and chronological ordering)
  const getAggregatedData = (): ChartHistoryItem[] => {
    if (chartData.length === 0) return [];
    
    const sortedData = [...chartData].sort((a, b) => a.time - b.time);
    let aggregated: ChartHistoryItem[] = [];

    if (kLineType === 'day') {
      aggregated = sortedData;
    } else if (kLineType === 'week') {
      const weekly: ChartHistoryItem[] = [];
      let currentWeekKey = '';
      let currentWeekGroup: ChartHistoryItem[] = [];

      sortedData.forEach(day => {
        const weekKey = getYearWeekString(day.time);
        if (!weekKey) return;
        if (weekKey !== currentWeekKey) {
          if (currentWeekGroup.length > 0) {
            weekly.push(aggregateGroup(currentWeekGroup));
          }
          currentWeekKey = weekKey;
          currentWeekGroup = [day];
        } else {
          currentWeekGroup.push(day);
        }
      });
      if (currentWeekGroup.length > 0) {
        weekly.push(aggregateGroup(currentWeekGroup));
      }
      aggregated = weekly;
    } else if (kLineType === 'month') {
      const monthly: ChartHistoryItem[] = [];
      let currentMonthKey = '';
      let currentMonthGroup: ChartHistoryItem[] = [];

      sortedData.forEach(day => {
        const monthKey = getYearMonthString(day.time);
        if (!monthKey) return;
        if (monthKey !== currentMonthKey) {
          if (currentMonthGroup.length > 0) {
            monthly.push(aggregateGroup(currentMonthGroup));
          }
          currentMonthKey = monthKey;
          currentMonthGroup = [day];
        } else {
          currentMonthGroup.push(day);
        }
      });
      if (currentMonthGroup.length > 0) {
        monthly.push(aggregateGroup(currentMonthGroup));
      }
      aggregated = monthly;
    } else if (kLineType === 'custom') {
      const custom: ChartHistoryItem[] = [];
      const days = customDays || 5;
      for (let i = 0; i < sortedData.length; i += days) {
        const slice = sortedData.slice(i, i + days);
        custom.push(aggregateGroup(slice));
      }
      aggregated = custom;
    } else {
      aggregated = sortedData;
    }

    // Deduplicate and round to daily boundaries to prevent ANY duplicate time keys in lightweight-charts
    const uniqueMap: Record<number, ChartHistoryItem> = {};
    aggregated.forEach(item => {
      const dayTimestamp = Math.floor(item.time / 86400000) * 86400000;
      uniqueMap[dayTimestamp] = {
        ...item,
        time: dayTimestamp
      };
    });

    return Object.values(uniqueMap).sort((a, b) => a.time - b.time);
  };

  // Obtain aggregated dataset (memoized to prevent reference changes and infinite canvas re-draw loops)
  const activeKData = useMemo(() => {
    return getAggregatedData();
  }, [chartData, kLineType, customDays]);

  // --- MATHEMATICAL HELPERS TO CALCULATE TECHNICAL INDICATORS (ON ACTIVE K DATA) ---

  const calcMA = (period: number) => {
    const ma: (number | null)[] = [];
    for (let i = 0; i < activeKData.length; i++) {
      if (i < period - 1) {
        ma.push(null);
      } else {
        const slice = activeKData.slice(i - period + 1, i + 1);
        const sum = slice.reduce((acc, curr) => acc + curr.close, 0);
        ma.push(sum / period);
      }
    }
    return ma;
  };

  const calcRSI = (period: number = 14) => {
    const rsi: (number | null)[] = [];
    if (activeKData.length < period) return Array(activeKData.length).fill(null);

    let avgGain = 0;
    let avgLoss = 0;

    for (let i = 1; i <= period; i++) {
      const change = activeKData[i].close - activeKData[i - 1].close;
      if (change > 0) {
        avgGain += change;
      } else {
        avgLoss += Math.abs(change);
      }
    }

    avgGain /= period;
    avgLoss /= period;
    
    for (let i = 0; i < period; i++) {
      rsi.push(null);
    }
    
    rsi.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss));

    for (let i = period + 1; i < activeKData.length; i++) {
      const change = activeKData[i].close - activeKData[i - 1].close;
      const gain = change > 0 ? change : 0;
      const loss = change < 0 ? Math.abs(change) : 0;

      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;

      rsi.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss));
    }

    return rsi;
  };

  const calcMACD = () => {
    const macd: (number | null)[] = [];
    const signal: (number | null)[] = [];
    const histogram: (number | null)[] = [];

    if (activeKData.length < 26) {
      return {
        macd: Array(activeKData.length).fill(null),
        signal: Array(activeKData.length).fill(null),
        histogram: Array(activeKData.length).fill(null),
      };
    }

    const calcEMA = (period: number) => {
      const ema: number[] = [];
      const k = 2 / (period + 1);
      
      const seedSlice = activeKData.slice(0, period);
      const sma = seedSlice.reduce((acc, c) => acc + c.close, 0) / period;
      
      for (let i = 0; i < activeKData.length; i++) {
        if (i < period - 1) {
          ema.push(0);
        } else if (i === period - 1) {
          ema.push(sma);
        } else {
          ema.push(activeKData[i].close * k + ema[i - 1] * (1 - k));
        }
      }
      return ema;
    };

    const ema12 = calcEMA(12);
    const ema26 = calcEMA(26);

    for (let i = 0; i < activeKData.length; i++) {
      if (i < 25) {
        macd.push(null);
      } else {
        macd.push(ema12[i] - ema26[i]);
      }
    }

    const kSignal = 2 / (9 + 1);
    let macdSumForSeed = 0;
    let firstSignalIndex = 25 + 8;

    for (let i = 25; i <= firstSignalIndex; i++) {
      macdSumForSeed += macd[i] as number;
    }
    const seedSignal = macdSumForSeed / 9;

    for (let i = 0; i < activeKData.length; i++) {
      if (i < firstSignalIndex) {
        signal.push(null);
      } else if (i === firstSignalIndex) {
        signal.push(seedSignal);
      } else {
        signal.push((macd[i] as number) * kSignal + (signal[i - 1] as number) * (1 - kSignal));
      }
    }

    for (let i = 0; i < activeKData.length; i++) {
      const m = macd[i];
      const s = signal[i];
      if (m === null || s === null) {
        histogram.push(null);
      } else {
        histogram.push(m - s);
      }
    }

    return { macd, signal, histogram };
  };

  const calcKD = () => {
    const K: (number | null)[] = [];
    const D: (number | null)[] = [];
    const period = 9;

    if (activeKData.length < period) {
      return {
        k: Array(activeKData.length).fill(null),
        d: Array(activeKData.length).fill(null),
      };
    }

    let prevK = 50;
    let prevD = 50;

    for (let i = 0; i < activeKData.length; i++) {
      if (i < period - 1) {
        K.push(null);
        D.push(null);
      } else {
        const slice = activeKData.slice(i - period + 1, i + 1);
        const highestHigh = Math.max(...slice.map(s => s.high));
        const lowestLow = Math.min(...slice.map(s => s.low));
        
        const close = activeKData[i].close;
        const denominator = highestHigh - lowestLow;
        const RSV = denominator === 0 ? 50 : ((close - lowestLow) / denominator) * 100;

        const currentK = (2/3) * prevK + (1/3) * RSV;
        const currentD = (2/3) * prevD + (1/3) * currentK;

        K.push(currentK);
        D.push(currentD);

        prevK = currentK;
        prevD = currentD;
      }
    }

    return { k: K, d: D };
  };

  // Compute Technical Indicators on Active K Data
  const timestamps = activeKData.map(d => d.time);
  const rsiValues = calcRSI(14);
  const macdData = calcMACD();
  const kdData = calcKD();

  // --- TRADINGVIEW LIGHTWEIGHT CHARTS CANDLESTICK RENDER HOOK ---
  useEffect(() => {
    const container = chartContainerRef.current;
    if (!container || activeKData.length === 0) return;

    // 1. Clear previous chart DOM elements (keeps it 100% responsive and avoids duplication bugs)
    container.innerHTML = '';

    // 2. Initialize TradingView Chart (with clientWidth fallback to avoid 0px sizing crashes)
    const width = container.clientWidth || 800;
    const chart = createChart(container, {
      width: width,
      height: 380,
      layout: {
        background: { color: 'transparent' },
        textColor: '#9ca3af',
        fontSize: 12,
        fontFamily: 'Outfit, sans-serif'
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.03)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.03)' },
      },
      crosshair: {
        mode: 1, // Magnet crosshair
      },
      rightPriceScale: {
        borderColor: 'rgba(255, 255, 255, 0.08)',
      },
      timeScale: {
        borderColor: 'rgba(255, 255, 255, 0.08)',
        timeVisible: true,
      },
    });

    chartApiRef.current = chart;

    // 3. Format aggregated data to Lightweight Charts standard (using YYYY-MM-DD date strings for timezone safety)
    const formattedCandles = activeKData.map(d => ({
      time: formatToDateString(d.time),
      open: d.open || d.close || 0,
      high: d.high || Math.max(d.open || 0, d.close || 0),
      low: d.low || Math.min(d.open || 0, d.close || 0),
      close: d.close || d.open || 0
    })).filter(c => c.time && !isNaN(c.open) && !isNaN(c.high) && !isNaN(c.low) && !isNaN(c.close));

    // 4. Add Candlestick Series (respects Taiwan Red rise, Green fall tradition!)
    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#eb2a35',       // Taiwan vivid Red
      downColor: '#1ebe52',     // Taiwan vivid Green
      borderUpColor: '#eb2a35',
      borderDownColor: '#1ebe52',
      wickUpColor: '#eb2a35',
      wickDownColor: '#1ebe52',
    });
    candlestickSeries.setData(formattedCandles as any[]);

    // 5. Add Volume Overlay Series
    const formattedVolume = activeKData.map(d => ({
      time: formatToDateString(d.time),
      value: d.volume,
      color: d.close >= d.open ? 'rgba(239, 68, 68, 0.15)' : 'rgba(34, 197, 94, 0.15)' // translucent red/green matching candle
    })).filter(v => v.time);

    const volumeSeries = chart.addHistogramSeries({
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume', // Named Y-axis scale to prevent empty ID failures
    });
    
    // Scale volume to only occupy the bottom 18% of the chart
    chart.priceScale('volume').applyOptions({
      scaleMargins: {
        top: 0.82,
        bottom: 0,
      },
    });
    volumeSeries.setData(formattedVolume as any[]);

    // 6. Add active Moving Average (MA) Lines (safeguarded against NaN)
    if (showMA5) {
      const ma5 = calcMA(5);
      const ma5Data = formattedCandles.map((c, i) => ({ time: c.time, value: ma5[i] })).filter(d => d.value !== null && d.value !== undefined && !isNaN(d.value)) as any[];
      const ma5Series = chart.addLineSeries({ color: 'rgba(239, 68, 68, 0.85)', lineWidth: 1, title: '5MA' });
      ma5Series.setData(ma5Data);
    }

    if (showMA10) {
      const ma10 = calcMA(10);
      const ma10Data = formattedCandles.map((c, i) => ({ time: c.time, value: ma10[i] })).filter(d => d.value !== null && d.value !== undefined && !isNaN(d.value)) as any[];
      const ma10Series = chart.addLineSeries({ color: 'rgba(245, 158, 11, 0.85)', lineWidth: 1, title: '10MA' });
      ma10Series.setData(ma10Data);
    }

    if (showMA20) {
      const ma20 = calcMA(20);
      const ma20Data = formattedCandles.map((c, i) => ({ time: c.time, value: ma20[i] })).filter(d => d.value !== null && d.value !== undefined && !isNaN(d.value)) as any[];
      const ma20Series = chart.addLineSeries({ color: 'rgba(34, 197, 94, 0.85)', lineWidth: 1, title: '20MA' });
      ma20Series.setData(ma20Data);
    }

    if (showMA60) {
      const ma60 = calcMA(60);
      const ma60Data = formattedCandles.map((c, i) => ({ time: c.time, value: ma60[i] })).filter(d => d.value !== null && d.value !== undefined && !isNaN(d.value)) as any[];
      const ma60Series = chart.addLineSeries({ color: 'rgba(59, 130, 246, 0.85)', lineWidth: 1, title: '60MA' });
      ma60Series.setData(ma60Data);
    }

    // 7. Auto fit all content inside timescale
    chart.timeScale().fitContent();

    // Resize listener
    const handleResize = () => {
      chart.applyOptions({ width: container.clientWidth });
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
      chartApiRef.current = null;
    };
  }, [activeKData, showMA5, showMA10, showMA20, showMA60, kLineType, customDays]);

  // --- SECONDARY INDICATORS CONFIGURATION (CHART.JS) ---
  const getIndicatorChartData = (): any => {
    if (activeIndicator === 'rsi') {
      return {
        labels: timestamps,
        datasets: [
          {
            label: 'RSI(14)',
            data: rsiValues as number[],
            borderColor: 'rgb(139, 92, 246)',
            borderWidth: 1.5,
            pointRadius: 0,
            tension: 0.15,
          },
          {
            label: '超買線 (70)',
            data: Array(timestamps.length).fill(70),
            borderColor: 'rgba(239, 68, 68, 0.25)',
            borderDash: [5, 5],
            borderWidth: 1,
            pointRadius: 0,
          },
          {
            label: '超賣線 (30)',
            data: Array(timestamps.length).fill(30),
            borderColor: 'rgba(34, 197, 94, 0.25)',
            borderDash: [5, 5],
            borderWidth: 1,
            pointRadius: 0,
          }
        ],
      };
    } else if (activeIndicator === 'macd') {
      return {
        labels: timestamps,
        datasets: [
          {
            label: 'DIF (MACD)',
            data: macdData.macd as number[],
            borderColor: 'rgb(59, 130, 246)',
            borderWidth: 1.5,
            pointRadius: 0,
            tension: 0.1,
          },
          {
            label: 'DEM (Signal)',
            data: macdData.signal as number[],
            borderColor: 'rgb(236, 72, 153)',
            borderWidth: 1.2,
            pointRadius: 0,
            tension: 0.1,
          },
          {
            type: 'bar' as const,
            label: 'Histogram',
            data: macdData.histogram as number[],
            backgroundColor: (context: any) => {
              const val = context.raw as number;
              return val >= 0 ? 'rgba(239, 68, 68, 0.6)' : 'rgba(34, 197, 94, 0.6)';
            },
            borderWidth: 0,
            barThickness: 'flex',
          }
        ],
      };
    } else {
      return {
        labels: timestamps,
        datasets: [
          {
            label: 'K線',
            data: kdData.k as number[],
            borderColor: 'rgb(6, 182, 212)',
            borderWidth: 1.5,
            pointRadius: 0,
            tension: 0.1,
          },
          {
            label: 'D線',
            data: kdData.d as number[],
            borderColor: 'rgb(245, 158, 11)',
            borderWidth: 1.5,
            pointRadius: 0,
            tension: 0.1,
          },
          {
            label: '高檔超買 (80)',
            data: Array(timestamps.length).fill(80),
            borderColor: 'rgba(239, 68, 68, 0.25)',
            borderDash: [5, 5],
            borderWidth: 1,
            pointRadius: 0,
          },
          {
            label: '低檔超賣 (20)',
            data: Array(timestamps.length).fill(20),
            borderColor: 'rgba(34, 197, 94, 0.25)',
            borderDash: [5, 5],
            borderWidth: 1,
            pointRadius: 0,
          }
        ],
      };
    }
  };

  const indicatorChartOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      legend: {
        labels: {
          color: 'hsl(215, 20%, 70%)',
          font: { family: 'Outfit', size: 11 },
          boxHeight: 2,
        },
      },
      tooltip: {
        backgroundColor: 'rgba(10, 15, 30, 0.95)',
        titleColor: '#fff',
        bodyColor: 'hsl(215, 20%, 70%)',
        borderColor: 'rgba(255,255,255,0.08)',
        borderWidth: 1,
        padding: 10,
        callbacks: {
          title: (context: any) => {
            const date = new Date(context[0].parsed.x as number);
            return date.toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' });
          },
          label: (context: any) => {
            const y = context.parsed.y;
            return ` ${context.dataset.label}: ${y !== null && y !== undefined ? y.toFixed(2) : '-'}`;
          }
        }
      }
    },
    scales: {
      x: {
        type: 'time',
        time: {
          unit: 'month',
          displayFormats: { month: 'yy/MM' },
        },
        grid: { color: 'rgba(255, 255, 255, 0.03)' },
        ticks: { color: 'hsl(215, 15%, 50%)', font: { family: 'Outfit' } },
      },
      y: {
        position: 'right',
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        ticks: { color: 'hsl(215, 20%, 70%)', font: { family: 'Outfit' } },
        min: activeIndicator === 'macd' ? undefined : 0,
        max: activeIndicator === 'macd' ? undefined : 100,
      },
    },
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>技術與基本面個股分析</h2>
          <p>整合歷史蠟燭 K 線圖、均線指標、熱門技術指標及個股財經資訊</p>
        </div>
      </div>

      {/* Select Stock & K-Line Range toolbar */}
      <div className="glass-card" style={{ marginBottom: '1.5rem', padding: '1.25rem 1.75rem' }}>
        <div className="analysis-header" style={{ justifyContent: 'space-between' }}>
          
          {/* Stock Ticker Dropdown Selector */}
          <div className="search-select-group" style={{ flexGrow: 0, minWidth: '260px' }}>
            <select
              className="form-input"
              value={selectedSymbol}
              onChange={(e) => setSelectedSymbol(e.target.value)}
              style={{ padding: '0.7rem 1rem' }}
            >
              {stockSymbols.length > 0 ? (
                stocks.map(s => (
                  <option key={s.symbol} value={s.symbol}>
                    {s.symbol.split('.')[0]} - {quotes[s.symbol]?.name || s.symbol}
                  </option>
                ))
              ) : (
                <option value="2330.TW">2330 - 台積電 (預設)</option>
              )}
            </select>
          </div>

          {/* K-Line Type selection (Day, Week, Month, Custom-N-Days) */}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <CalendarDays size={14} />
              <span>K線週期：</span>
            </span>

            <div style={{ display: 'flex', gap: '0.25rem', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', padding: '0.25rem' }}>
              {[
                { type: 'day', label: '日K' },
                { type: 'week', label: '周K' },
                { type: 'month', label: '月K' },
                { type: 'custom', label: `${customDays}日K` }
              ].map(item => (
                <button
                  key={item.type}
                  onClick={() => setKLineType(item.type as any)}
                  className="btn"
                  style={{
                    padding: '0.45rem 0.95rem',
                    background: kLineType === item.type ? 'var(--accent-primary)' : 'transparent',
                    boxShadow: kLineType === item.type ? '0 2px 8px rgba(37,99,235,0.3)' : 'none',
                    color: kLineType === item.type ? '#fff' : 'var(--text-secondary)',
                    borderRadius: '10px',
                    fontSize: '0.85rem'
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {/* Custom Days Input */}
            {kLineType === 'custom' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginLeft: '0.5rem' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>自訂：</span>
                <input
                  type="number"
                  min="2"
                  max="120"
                  value={customDays}
                  onChange={(e) => setCustomDays(parseInt(e.target.value) || 5)}
                  className="form-input"
                  style={{ width: '65px', padding: '0.35rem 0.5rem', textAlign: 'center' }}
                />
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>日</span>
              </div>
            )}
          </div>

          {/* MA overlays toggler */}
          <div className="indicator-toggles">
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', alignSelf: 'center', marginRight: '0.25rem' }}>技術均線：</span>
            <button className={`badge-toggle ${showMA5 ? 'active' : ''}`} onClick={() => setShowMA5(!showMA5)}>5MA</button>
            <button className={`badge-toggle ${showMA10 ? 'active' : ''}`} onClick={() => setShowMA10(!showMA10)}>10MA</button>
            <button className={`badge-toggle ${showMA20 ? 'active' : ''}`} onClick={() => setShowMA20(!showMA20)}>20MA</button>
            <button className={`badge-toggle ${showMA60 ? 'active' : ''}`} onClick={() => setShowMA60(!showMA60)}>60MA</button>
          </div>
        </div>
      </div>

      {/* TradingView Candlestick price chart */}
      <div className="glass-card" style={{ marginBottom: '1.5rem', height: '430px', display: 'flex', flexDirection: 'column' }}>
        <div className="flex-header" style={{ marginBottom: '1rem' }}>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, display: 'flex', alignContent: 'center', gap: '0.5rem' }}>
            <BarChart2 size={20} color="var(--accent-primary)" />
            <span>TradingView 專業蠟燭 K 線圖</span>
          </h3>
          {quote && (
            <div style={{ display: 'flex', gap: '1.25rem', fontFamily: 'Outfit, sans-serif' }}>
              <div>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>現價：</span>
                <span style={{ fontSize: '1.1rem', fontWeight: 800 }}>NT$ {quote.price.toLocaleString()}</span>
              </div>
              <div>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>漲跌：</span>
                <span style={{ fontSize: '1.1rem', fontWeight: 800 }} className={quote.changePercent >= 0 ? 'trend-indicator-up' : 'trend-indicator-down'}>
                  {quote.changePercent >= 0 ? '+' : ''}{quote.changePercent.toFixed(2)}%
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Chart Canvas mount point */}
        <div style={{ position: 'relative', flexGrow: 1, minHeight: '380px' }}>
          {loadingChart && (
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', background: 'rgba(10,15,30,0.6)', zIndex: 10 }}>
              正在載入歷史 K 線行情資料...
            </div>
          )}
          {/* Dedicated empty DOM node for TradingView canvas to prevent virtual DOM collision crashes */}
          <div ref={chartContainerRef} style={{ width: '100%', height: '380px' }} />
        </div>
      </div>

      {/* Secondary Indicators Toggle Layout (RSI, MACD, KD) */}
      <div className="glass-card" style={{ marginBottom: '2rem', height: '280px', display: 'flex', flexDirection: 'column' }}>
        <div className="flex-header" style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'flex', gap: '0.25rem', background: 'rgba(255,255,255,0.03)', borderRadius: '10px', padding: '0.25rem' }}>
            {['rsi', 'macd', 'kd'].map((ind) => (
              <button
                key={ind}
                onClick={() => setActiveIndicator(ind as any)}
                className="btn"
                style={{
                  padding: '0.4rem 0.85rem',
                  background: activeIndicator === ind ? 'rgba(139, 92, 246, 0.2)' : 'transparent',
                  color: activeIndicator === ind ? 'var(--accent-purple)' : 'var(--text-secondary)',
                  border: activeIndicator === ind ? '1px solid rgba(139, 92, 246, 0.4)' : '1px solid transparent',
                  borderRadius: '8px',
                  fontSize: '0.8rem',
                  fontWeight: 700
                }}
              >
                {ind === 'rsi' ? 'RSI (相對強弱)' : ind === 'macd' ? 'MACD (平滑異同)' : 'KD (隨機隨時)'}
              </button>
            ))}
          </div>
        </div>

        <div style={{ position: 'relative', flexGrow: 1 }}>
          {loadingChart ? (
            <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
              計算指標中...
            </div>
          ) : chartData.length > 0 ? (
            <Chart type="line" data={getIndicatorChartData()} options={indicatorChartOptions} />
          ) : (
            <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
              無法計算技術指標。
            </div>
          )}
        </div>
      </div>

      {/* 三大法人籌碼分析 (Institutional Flow) */}
      <div className="glass-card" style={{ marginBottom: '2rem', height: '280px', display: 'flex', flexDirection: 'column' }}>
        <div className="flex-header" style={{ marginBottom: '1rem' }}>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <BarChart2 size={18} color="var(--accent-primary)" />
            <span>近 15 日三大法人買賣超金額流向圖 (單位：張)</span>
          </h3>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>盤後更新 | 藍外資、紫投信、綠自營商</span>
        </div>
        
        <div style={{ position: 'relative', flexGrow: 1 }}>
          {loadingInst ? (
            <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
              <RefreshCw size={18} style={{ animation: 'spin 1.5s linear infinite', marginRight: '0.5rem' }} />
              <span>載入法人交易籌碼中...</span>
            </div>
          ) : instData.length > 0 ? (
            <Chart 
              type="bar" 
              data={{
                labels: instData.map(d => d.date),
                datasets: [
                  {
                    label: '外資及陸資 (張)',
                    data: instData.map(d => d.foreignNet),
                    backgroundColor: 'rgba(37, 99, 235, 0.65)', // Electric Blue
                    borderColor: 'rgb(37, 99, 235)',
                    borderWidth: 1.2,
                    borderRadius: 4,
                  },
                  {
                    label: '投信 (張)',
                    data: instData.map(d => d.trustNet),
                    backgroundColor: 'rgba(139, 92, 246, 0.65)', // Cyber Purple
                    borderColor: 'rgb(139, 92, 246)',
                    borderWidth: 1.2,
                    borderRadius: 4,
                  },
                  {
                    label: '自營商 (張)',
                    data: instData.map(d => d.dealerNet),
                    backgroundColor: 'rgba(16, 185, 129, 0.65)', // Emerald Green
                    borderColor: 'rgb(16, 185, 129)',
                    borderWidth: 1.2,
                    borderRadius: 4,
                  }
                ]
              }} 
              options={{
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                  mode: 'index',
                  intersect: false,
                },
                plugins: {
                  legend: {
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
                      label: (context: any) => ` ${context.dataset.label}: ${context.raw >= 0 ? '+' : ''}${context.raw.toLocaleString()} 張`
                    }
                  }
                },
                scales: {
                  x: {
                    stacked: true,
                    grid: { color: 'rgba(255, 255, 255, 0.02)' },
                    ticks: { color: 'hsl(215, 15%, 50%)', font: { family: 'Outfit', size: 10 } }
                  },
                  y: {
                    stacked: true,
                    position: 'right',
                    grid: { color: 'rgba(255, 255, 255, 0.04)' },
                    ticks: { 
                      color: 'hsl(215, 20%, 70%)', 
                      font: { family: 'Outfit', size: 10 },
                      callback: (value: any) => `${value >= 0 ? '+' : ''}${value.toLocaleString()}`
                    }
                  }
                }
              }} 
            />
          ) : (
            <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
              無籌碼流向資料。
            </div>
          )}
        </div>
      </div>

      {/* Fundamentals & News columns */}
      <div className="grid-cols-2">
        {/* Left Side: Fundamental Data */}
        <div className="glass-card">
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <BookOpen size={20} color="var(--accent-neon)" />
            <span>個股基本面分析</span>
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>由財報揭露之核心估值指標</p>

          <div className="fundamental-grid">
            <div className="fundamental-card">
              <div className="fundamental-label">每股盈餘 (EPS)</div>
              <div className="fundamental-value">
                {quote && quote.eps ? `${quote.eps.toFixed(2)} 元` : '-'}
              </div>
            </div>

            <div className="fundamental-card">
              <div className="fundamental-label">本益比 (P/E Ratio)</div>
              <div className="fundamental-value">
                {quote && quote.pe && quote.pe > 0 ? `${quote.pe.toFixed(2)} 倍` : '-'}
              </div>
            </div>

            <div className="fundamental-card">
              <div className="fundamental-label">股價淨值比 (P/B Ratio)</div>
              <div className="fundamental-value">
                {quote && quote.pb && quote.pb > 0 ? `${quote.pb.toFixed(2)} 倍` : '-'}
              </div>
            </div>

            <div className="fundamental-card">
              <div className="fundamental-label">現金股利殖利率</div>
              <div className="fundamental-value">
                {quote && quote.dividendYield && quote.dividendYield > 0 ? `${quote.dividendYield.toFixed(2)} %` : '0.00 %'}
              </div>
            </div>
          </div>

          {quote && quote.marketCap && (
            <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--glass-border)', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>估計發行總市值：</span>
              <span style={{ fontWeight: 700, color: '#fff', fontSize: '1.1rem', fontFamily: 'Outfit' }}>
                NT$ {Math.round(quote.marketCap).toLocaleString()} 元
              </span>
            </div>
          )}
        </div>

        {/* Right Side: News cards list */}
        <div className="glass-card">
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <Newspaper size={20} color="var(--accent-purple)" />
            <span>個股即時焦點新聞</span>
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>串接 Google 新聞 RSS 爬梳之個股焦點</p>

          {loadingNews ? (
            <div style={{ display: 'flex', height: '240px', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
              <RefreshCw size={20} style={{ animation: 'spin 1.5s linear infinite', marginRight: '0.5rem' }} />
              <span>抓取財經新聞中...</span>
            </div>
          ) : news.length > 0 ? (
            <div className="news-list">
              {news.map((item, idx) => (
                <a
                  key={idx}
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="news-card"
                >
                  <div className="news-title">{item.title}</div>
                  <div className="news-meta">
                    <span className="news-source">{item.source || '財經新聞'}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <Calendar size={12} />
                      {item.date}
                    </span>
                  </div>
                </a>
              ))}
            </div>
          ) : (
            <div style={{ display: 'flex', height: '240px', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
              目前暫無此股票之新聞。
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AnalysisTab;
