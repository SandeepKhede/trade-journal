import React, { useMemo, useState } from 'react'
import { Row, Col, Card, Statistic, Tag, DatePicker, Space, Select, Tooltip as AntTooltip } from 'antd'
import { InfoCircleOutlined } from '@ant-design/icons'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts'
import StrategyAnalysis from './StrategyAnalysis'
import StrategyInsights from './StrategyInsights'
import { formatCurrency, getCommonCurrency } from '../utils/format'

const { RangePicker } = DatePicker

function computeMetrics(trades) {
  const total = trades.reduce((s, t) => s + (t.pnl || 0), 0)
  const wins = trades.filter((t) => (t.pnl || 0) > 0)
  const totalTrades = trades.length
  const winRate = totalTrades ? Math.round((wins.length / totalTrades) * 100) : 0
  const avg = totalTrades ? total / totalTrades : 0
  const losses = trades.filter((t) => (t.pnl || 0) < 0)
  const avgWin = wins.length ? wins.reduce((s, t) => s + (t.pnl || 0), 0) / wins.length : 0
  const avgLoss = losses.length ? losses.reduce((s, t) => s + (t.pnl || 0), 0) / losses.length : 0
  const totalFees = trades.reduce((s, t) => s + (t.commission || 0), 0)
  const best = trades.reduce((b, t) => (t.pnl > (b.pnl || -Infinity) ? t : b), {})
  const worst = trades.reduce((w, t) => (t.pnl < (w.pnl || Infinity) ? t : w), {})
  
  // Calculate max drawdown
  let peak = 0
  let maxDrawdown = 0
  let currentDrawdown = 0
  let cumulativePnL = 0
  
  trades.forEach(trade => {
    cumulativePnL += trade.pnl || 0
    if (cumulativePnL > peak) {
      peak = cumulativePnL
      currentDrawdown = 0
    } else {
      currentDrawdown = peak - cumulativePnL
      if (currentDrawdown > maxDrawdown) {
        maxDrawdown = currentDrawdown
      }
    }
  })

  // Calculate profit factor
  const grossProfit = trades.reduce((sum, t) => sum + (t.pnl > 0 ? t.pnl : 0), 0)
  const grossLoss = Math.abs(trades.reduce((sum, t) => sum + (t.pnl < 0 ? t.pnl : 0), 0))
  const profitFactor = grossLoss === 0 ? grossProfit : grossProfit / grossLoss

  // Calculate average R multiple
  const avgRMultiple = totalTrades ? trades.reduce((sum, t) => sum + (t.rMultiple || 0), 0) / totalTrades : 0

  return { 
    total, 
    winRate, 
    totalTrades, 
    avg, 
    best, 
    worst,
    maxDrawdown,
    profitFactor: profitFactor.toFixed(2),
    avgRMultiple: avgRMultiple.toFixed(2)
    ,
    avgWin,
    avgLoss,
    totalFees
  }
}

export default function Dashboard({ trades = [] }) {
  const [dateRange, setDateRange] = useState(null)
  const [groupBy, setGroupBy] = useState('day')

  const fmtCurrency = (v, currency = 'USD') => {
    try {
      return new Intl.NumberFormat('en-US', { 
        style: 'currency', 
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 6 // For crypto prices that need more precision
      }).format(v)
    } catch (e) {
      return `${currency} ${v}`
    }
  }

  // Filter trades by date range
  const filteredTrades = useMemo(() => {
    if (!dateRange) return trades
    const [start, end] = dateRange
    return trades.filter(trade => {
      const tradeDate = new Date(trade.date)
      return tradeDate >= start && tradeDate <= end
    })
  }, [trades, dateRange])

  const metrics = useMemo(() => computeMetrics(filteredTrades), [filteredTrades])

  // Group trades by selected period
  const groupedPnlSeries = useMemo(() => {
    const grouped = filteredTrades.reduce((acc, trade) => {
      const date = new Date(trade.date)
      let key
      switch (groupBy) {
        case 'week':
          key = `Week ${Math.ceil(date.getDate() / 7)} - ${date.toLocaleString('default', { month: 'short' })}`
          break
        case 'month':
          key = date.toLocaleString('default', { month: 'long', year: 'numeric' })
          break
        default: // day
          key = date.toLocaleDateString()
      }
      
      if (!acc[key]) {
        acc[key] = { name: key, pnl: 0, trades: 0 }
      }
      acc[key].pnl += trade.pnl || 0
      acc[key].trades += 1
      return acc
    }, {})

    return Object.values(grouped)
  }, [filteredTrades, groupBy])

  const pnlSeries = groupedPnlSeries
    .slice()
    .reverse()
    .map((t, i) => ({ 
      name: new Date(t.date).toLocaleDateString(), 
      pnl: t.pnl,
      cumulative: trades
        .slice()
        .reverse()
        .slice(0, i + 1)
        .reduce((sum, trade) => sum + (trade.pnl || 0), 0)
    }))

  const tradesCountSeries = trades
    .slice()
    .reverse()
    .map((t, i) => ({ name: new Date(t.date).toLocaleDateString(), trades: 1 }))

  const pieData = [
    { name: 'Wins', value: trades.filter((t) => (t.pnl || 0) > 0).length },
    { name: 'Losses', value: trades.filter((t) => (t.pnl || 0) <= 0).length },
  ]

  const COLORS = ['#52c41a', '#ff4d4f']

  // Get the most common currency from trades
  const getTradesCurrency = useMemo(() => {
    if (!filteredTrades.length) return 'USD';
    // Look at commission currency first as it's usually stable
    const feeCurrencies = filteredTrades
      .map(t => t.deltaMetadata?.settlingAsset)
      .filter(Boolean);
    if (feeCurrencies.length) {
      return feeCurrencies[0]; // Use the first one for now
    }
    return 'USD';
  }, [filteredTrades]);

  return (
    <div>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col span={24}>
          <Card>
            <Space>
              <RangePicker 
                onChange={(dates) => setDateRange(dates)}
                allowClear
              />
              <Select value={null} onChange={(val) => {
                const now = new Date()
                let start
                switch (val) {
                  case '7d':
                    start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
                    setDateRange([start, now])
                    break
                  case '30d':
                    start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
                    setDateRange([start, now])
                    break
                  case 'month':
                    start = new Date(now.getFullYear(), now.getMonth(), 1)
                    setDateRange([start, now])
                    break
                  case 'all':
                    setDateRange(null)
                    break
                  default:
                    break
                }
              }} style={{ width: 140 }} placeholder="Quick range">
                <Select.Option value="7d">Last 7 days</Select.Option>
                <Select.Option value="30d">Last 30 days</Select.Option>
                <Select.Option value="month">This month</Select.Option>
                <Select.Option value="all">All</Select.Option>
              </Select>
              <Select 
                value={groupBy}
                onChange={setGroupBy}
                style={{ width: 120 }}
              >
                <Select.Option value="day">Daily</Select.Option>
                <Select.Option value="week">Weekly</Select.Option>
                <Select.Option value="month">Monthly</Select.Option>
              </Select>
            </Space>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card>
            <Statistic 
              title="Total P&L" 
              value={formatCurrency(Math.round(metrics.total), getTradesCurrency)}
 
              valueStyle={{ color: metrics.total >= 0 ? '#3f8600' : '#cf1322' }} 
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card>
            <Statistic title="Win Rate" value={`${metrics.winRate}%`} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card>
            <Statistic title="Total Trades" value={metrics.totalTrades} />
          </Card>
        </Col>
        {/* <Col xs={24} sm={12} md={8} lg={6}>
          <Card>
            <Statistic 
              title="Avg P/L per Trade" 
              value={formatCurrency(metrics.avg, getTradesCurrency)}
            />
          </Card>
        </Col> */}
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card>
            <Statistic 
              title="Avg Win" 
              value={formatCurrency(Math.round(metrics.avgWin), getTradesCurrency)}
              valueStyle={{ color: '#3f8600' }} 
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card>
            <Statistic 
              title="Avg Loss" 
              value={formatCurrency(Math.round(Math.abs(metrics.avgLoss)), getTradesCurrency)}

              valueStyle={{ color: '#cf1322' }} 
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={6}>
          <Card>
            <Statistic 
              title={`Fees Paid`}
              value={formatCurrency(Math.round(metrics.totalFees), getTradesCurrency)}

              precision={4}
            />
          </Card>
        </Col>
          <Col xs={24} sm={12} md={8} lg={6}>
            <Card>
              <Statistic title="Max Drawdown" value={formatCurrency(Math.round(metrics.maxDrawdown) , getTradesCurrency)} valueStyle={{ color: '#cf1322' }} />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={8} lg={6}>
            <Card>
              <Statistic title="Profit Factor" value={metrics.profitFactor} />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={8} lg={6}>
            <Card>
              <Statistic title="Avg R Multiple" value={metrics.avgRMultiple} />
            </Card>
          </Col>
        </Row>      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={16}>
          <Card title="P&L Over Time">
            <div style={{ width: '100%', height: 240 }}>
              <ResponsiveContainer>
                <LineChart data={pnlSeries}>
                  <XAxis dataKey="name" hide />
                  <YAxis />
                  <Tooltip />
                  <Line 
                    type="monotone" 
                    dataKey="pnl" 
                    stroke="#1890ff" 
                    dot={false} 
                    name="Trade P&L"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="cumulative" 
                    stroke="#52c41a" 
                    dot={false}
                    name="Cumulative P&L"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card title="Trades Count" style={{ marginTop: 16 }}>
            <div style={{ width: '100%', height: 180 }}>
              <ResponsiveContainer>
                <BarChart data={tradesCountSeries}>
                  <XAxis dataKey="name" hide />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="trades" fill="#722ed1" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card title="Win / Loss">
            <div style={{ width: '100%', height: 260 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={40} outerRadius={80} label>
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card title="Best / Worst" style={{ marginTop: 16 }}>
            <div>
              <div>
                Best: <Tag color="green">{metrics.best.instrument || '—'}</Tag> {formatCurrency(metrics.best.pnl || 0, getTradesCurrency)}
              </div>
              <div style={{ marginTop: 8 }}>
                Worst: <Tag color="red">{metrics.worst.instrument || '—'}</Tag> {formatCurrency(metrics.worst.pnl || 0, getTradesCurrency)}
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      {/* Strategy Analysis */}
      <Row style={{ marginTop: 16 }}>
        <Col span={24}>
          <StrategyAnalysis trades={trades} />
        </Col>
      </Row>

      {/* New Strategy Insights */}
      <Row style={{ marginTop: 16 }}>
        <Col span={24}>
          <StrategyInsights trades={trades} />
        </Col>
      </Row>

      {/* Help tooltips for metrics */}
      <Row style={{ marginTop: 16 }}>
        <Col span={24}>
          <Card title="Metrics Explanation" size="small">
            <p><strong>Win Rate:</strong> Percentage of trades that are profitable</p>
            <p><strong>Profit Factor:</strong> Gross profit divided by gross loss (above 1.5 is good, above 2.0 is excellent)</p>
            <p><strong>R Multiple:</strong> Actual profit/loss divided by initial risk (measures reward relative to risk)</p>
            <p><strong>Expectancy:</strong> Expected value per trade (Win Rate × Avg Win - Loss Rate × Avg Loss)</p>
            <p><strong>Risk/Reward Ratio:</strong> Average winning trade size divided by average losing trade size</p>
          </Card>
        </Col>
      </Row>
    </div>
  )
}
