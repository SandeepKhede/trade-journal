import React, { useMemo } from 'react';
import { Card, Table, Tag, Progress } from 'antd';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

function computeStrategyMetrics(trades) {
  const strategyMap = trades.reduce((acc, trade) => {
    const strategies = Array.isArray(trade.strategy) ? trade.strategy : [trade.strategy];
    
    strategies.forEach(strategy => {
      if (!strategy) return;
      
      if (!acc[strategy]) {
        acc[strategy] = {
          name: strategy,
          totalTrades: 0,
          winCount: 0,
          totalPnL: 0,
          avgRMultiple: 0,
          rMultiples: [],
        };
      }

      acc[strategy].totalTrades += 1;
      acc[strategy].totalPnL += trade.pnl || 0;
      if (trade.pnl > 0) acc[strategy].winCount += 1;
      if (trade.rMultiple) {
        acc[strategy].rMultiples.push(trade.rMultiple);
      }
    });

    return acc;
  }, {});

  return Object.values(strategyMap).map(strategy => ({
    ...strategy,
    winRate: (strategy.winCount / strategy.totalTrades * 100).toFixed(1),
    avgPnL: (strategy.totalPnL / strategy.totalTrades).toFixed(2),
    avgRMultiple: (strategy.rMultiples.reduce((a, b) => a + b, 0) / strategy.rMultiples.length).toFixed(2),
  }));
}

export default function StrategyAnalysis({ trades = [] }) {
  const strategyMetrics = useMemo(() => computeStrategyMetrics(trades), [trades]);

  const columns = [
    {
      title: 'Strategy',
      dataIndex: 'name',
      key: 'name',
      render: (text) => <Tag color="blue">{text}</Tag>,
    },
    {
      title: 'Win Rate',
      dataIndex: 'winRate',
      key: 'winRate',
      render: (value) => (
        <Progress 
          percent={parseFloat(value)} 
          size="small" 
          status={parseFloat(value) >= 50 ? "success" : "exception"}
        />
      ),
      sorter: (a, b) => parseFloat(a.winRate) - parseFloat(b.winRate),
    },
    {
      title: 'Total Trades',
      dataIndex: 'totalTrades',
      key: 'totalTrades',
      sorter: (a, b) => a.totalTrades - b.totalTrades,
    },
    {
      title: 'Total P&L',
      dataIndex: 'totalPnL',
      key: 'totalPnL',
      render: (value) => (
        <span style={{ color: value >= 0 ? '#52c41a' : '#f5222d' }}>
          {value.toFixed(2)}
        </span>
      ),
      sorter: (a, b) => a.totalPnL - b.totalPnL,
    },
    {
      title: 'Avg R Multiple',
      dataIndex: 'avgRMultiple',
      key: 'avgRMultiple',
      render: (value) => (
        <span style={{ color: value >= 0 ? '#52c41a' : '#f5222d' }}>
          {value}R
        </span>
      ),
      sorter: (a, b) => parseFloat(a.avgRMultiple) - parseFloat(b.avgRMultiple),
    },
  ];

  return (
    <Card title="Strategy Performance Analysis">
      <div style={{ marginBottom: 24, height: 300 }}>
        <ResponsiveContainer>
          <BarChart data={strategyMetrics}>
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="totalPnL" fill="#1890ff" name="Total P&L" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <Table
        columns={columns}
        dataSource={strategyMetrics}
        rowKey="name"
        pagination={false}
        scroll={{ x: true }}
      />
    </Card>
  );
}