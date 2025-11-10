import React from 'react';
import { Card, Row, Col, Table, Progress, Tag } from 'antd';
import { formatCurrency } from '../utils/format';

// Helper to compute strategy metrics
function computeStrategyMetrics(trades) {
  const strategyStats = trades.reduce((acc, trade) => {
    if (!trade.strategy || !trade.strategy.length) return acc;
    
    trade.strategy.forEach(strategy => {
      if (!acc[strategy]) {
        acc[strategy] = {
          total: 0,
          wins: 0,
          losses: 0,
          totalPnL: 0,
          totalRMultiple: 0,
          bestTrade: null,
          worstTrade: null,
          avgWinSize: 0,
          avgLossSize: 0,
          totalRisk: 0,
          trades: []
        };
      }
      
      acc[strategy].total++;
      acc[strategy].trades.push(trade);
      acc[strategy].totalPnL += trade.pnl || 0;
      acc[strategy].totalRMultiple += trade.rMultiple || 0;
      acc[strategy].totalRisk += trade.riskAmount || 0;
      
      if (trade.pnl > 0) {
        acc[strategy].wins++;
        if (!acc[strategy].bestTrade || trade.pnl > acc[strategy].bestTrade.pnl) {
          acc[strategy].bestTrade = trade;
        }
      } else if (trade.pnl < 0) {
        acc[strategy].losses++;
        if (!acc[strategy].worstTrade || trade.pnl < acc[strategy].worstTrade.pnl) {
          acc[strategy].worstTrade = trade;
        }
      }
    });
    return acc;
  }, {});

  // Calculate derived metrics
  return Object.entries(strategyStats).map(([strategy, stats]) => {
    const winRate = (stats.wins / stats.total) * 100;
    const avgPnL = stats.totalPnL / stats.total;
    const avgRMultiple = stats.totalRMultiple / stats.total;
    const winningTrades = stats.trades.filter(t => t.pnl > 0);
    const losingTrades = stats.trades.filter(t => t.pnl < 0);
    
    return {
      strategy,
      total: stats.total,
      wins: stats.wins,
      losses: stats.losses,
      winRate,
      totalPnL: stats.totalPnL,
      avgPnL,
      avgRMultiple,
      riskRewardRatio: Math.abs((avgPnL / stats.total) / (stats.totalRisk / stats.total)),
      avgWinSize: winningTrades.length ? 
        winningTrades.reduce((sum, t) => sum + (t.pnl || 0), 0) / winningTrades.length : 0,
      avgLossSize: losingTrades.length ? 
        losingTrades.reduce((sum, t) => sum + (t.pnl || 0), 0) / losingTrades.length : 0,
      bestTrade: stats.bestTrade,
      worstTrade: stats.worstTrade,
      profitFactor: Math.abs(
        winningTrades.reduce((sum, t) => sum + (t.pnl || 0), 0) /
        losingTrades.reduce((sum, t) => sum + Math.abs(t.pnl || 0), 1)
      ),
      expectancy: winRate/100 * (stats.avgWinSize || 0) - (1-winRate/100) * Math.abs(stats.avgLossSize || 0)
    };
  }).sort((a, b) => b.profitFactor - a.profitFactor); // Sort by profit factor
}

export default function StrategyInsights({ trades = [] }) {
  const strategyMetrics = computeStrategyMetrics(trades);
  const currency = trades[0]?.deltaMetadata?.settlingAsset || 'USD';

  const columns = [
    {
      title: 'Strategy',
      dataIndex: 'strategy',
      key: 'strategy',
      fixed: 'left', // Pin strategy column to the left
      render: (text) => <Tag color="blue">{text}</Tag>,
      width: 120,
    },
    {
      title: 'Win Rate',
      dataIndex: 'winRate',
      key: 'winRate',
      width: 120,
      render: (value) => (
        <div style={{ minWidth: '100px' }}>
          <Progress 
            percent={Math.round(value)} 
            size="small" 
            status={value >= 50 ? 'success' : 'exception'}
          />
        </div>
      ),
      sorter: (a, b) => a.winRate - b.winRate,
    },
    {
      title: 'Profit Factor',
      dataIndex: 'profitFactor',
      key: 'profitFactor',
      width: 100,
      render: (value) => value.toFixed(2),
      sorter: (a, b) => a.profitFactor - b.profitFactor,
    },
    {
      title: 'Avg R',
      dataIndex: 'avgRMultiple',
      key: 'avgRMultiple',
      width: 80,
      render: (value) => value.toFixed(2) + 'R',
      sorter: (a, b) => a.avgRMultiple - b.avgRMultiple,
    },
    {
      title: 'Total P&L',
      dataIndex: 'totalPnL',
      key: 'totalPnL',
      width: 120,
      render: (value) => (
        <span style={{ 
          color: value >= 0 ? '#3f8600' : '#cf1322',
          whiteSpace: 'nowrap'
        }}>
          {formatCurrency(value, currency)}
        </span>
      ),
      sorter: (a, b) => a.totalPnL - b.totalPnL,
    },
    {
      title: 'Trades',
      dataIndex: 'total',
      key: 'total',
      width: 80,
      sorter: (a, b) => a.total - b.total,
    },
    {
      title: 'R:R',
      dataIndex: 'riskRewardRatio',
      key: 'riskRewardRatio',
      width: 80,
      render: (value) => value.toFixed(2),
      sorter: (a, b) => a.riskRewardRatio - b.riskRewardRatio,
    },
    {
      title: 'Expectancy',
      dataIndex: 'expectancy',
      key: 'expectancy',
      width: 100,
      render: (value) => (
        <span style={{ whiteSpace: 'nowrap' }}>
          {formatCurrency(value, currency)}
        </span>
      ),
      sorter: (a, b) => a.expectancy - b.expectancy,
    },
  ];

  return (
    <Card 
      title="Strategy Performance Analysis"
      bodyStyle={{ 
        padding: '12px',
        overflow: 'auto'
      }}
    >
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <div style={{ overflowX: 'auto', maxWidth: '100%' }}>
            <Table 
              dataSource={strategyMetrics} 
              columns={columns}
              rowKey="strategy"
              pagination={false}
              scroll={{ x: 800 }} // Enable horizontal scrolling
              style={{ minWidth: '800px' }}
            />
          </div>
        </Col>
      </Row>

      {/* Strategy Recommendations */}
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col span={24}>
          <Card 
            title="Strategy Insights" 
            size="small"
            bodyStyle={{ 
              maxHeight: '300px',
              overflowY: 'auto',
              padding: '12px'
            }}
          >
            {strategyMetrics.map(strategy => {
              const insights = [];
              if (strategy.winRate < 40) {
                insights.push(`${strategy.strategy}: Low win rate (${strategy.winRate.toFixed(1)}%). Consider reviewing entry criteria.`);
              }
              if (strategy.avgRMultiple < 1) {
                insights.push(`${strategy.strategy}: Low average R multiple (${strategy.avgRMultiple.toFixed(2)}R). Consider wider targets or tighter stops.`);
              }
              if (strategy.profitFactor < 1) {
                insights.push(`${strategy.strategy}: Unprofitable (PF ${strategy.profitFactor.toFixed(2)}). Review or avoid this setup.`);
              }
              if (strategy.riskRewardRatio < 1.5) {
                insights.push(`${strategy.strategy}: Low R:R ratio (${strategy.riskRewardRatio.toFixed(2)}). Look for better reward opportunities.`);
              }
              return insights.length ? (
                <div key={strategy.strategy} style={{ marginBottom: 8 }}>
                  {insights.map((insight, i) => (
                    <div key={i} style={{ color: '#cf1322' }}>• {insight}</div>
                  ))}
                </div>
              ) : null;
            })}
          </Card>
        </Col>
      </Row>
    </Card>
  );
}