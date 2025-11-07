import React, { useState } from 'react'
import { Table, Tag, Image, Modal, Space, Button, Typography, Card, Statistic } from 'antd'
import { ExpandAltOutlined } from '@ant-design/icons'

export default function TradeTable({ trades = [] }) {
  const [selectedTrade, setSelectedTrade] = useState(null)

  // Function to open trade details modal
  const showTradeDetails = (trade) => {
    setSelectedTrade(trade)
  }
  const columns = [
    {
      title: 'Date',
      dataIndex: 'date',
      key: 'date',
      render: (d) => new Date(d).toLocaleString(),
      sorter: (a, b) => new Date(a.date) - new Date(b.date),
      width: 160,
    },
      {
        title: 'Source',
        dataIndex: ['deltaMetadata', 'source'],
        key: 'source',
        render: (source) => source ? (
          <Tag color="cyan">{source}</Tag>
        ) : '-',
        width: 100,
      },
    { 
      title: 'Instrument', 
      dataIndex: 'instrument', 
      key: 'instrument',
      width: 100,
    },
    { 
      title: 'Direction', 
      dataIndex: 'direction', 
      key: 'direction',
      render: (direction) => (
        <Tag color={direction === 'long' ? 'blue' : 'orange'}>
          {direction.toUpperCase()}
        </Tag>
      ),
      width: 90,
    },
      {
        title: 'Role',
        dataIndex: ['deltaMetadata', 'role'],
        key: 'role',
        render: (role) => role ? (
          <Tag color={role === 'maker' ? 'green' : 'volcano'}>{role}</Tag>
        ) : '-',
        width: 80,
      },
    { 
      title: 'Entry', 
      dataIndex: 'entry', 
      key: 'entry',
      render: (val) => Number(val).toLocaleString(),
      width: 100,
    },
    { 
      title: 'Exit', 
      dataIndex: 'exit', 
      key: 'exit',
      render: (val) => Number(val).toLocaleString(),
      width: 100,
    },
    { 
      title: 'Size', 
      dataIndex: 'size', 
      key: 'size',
      width: 80,
    },
      {
        title: 'Notional',
        dataIndex: 'notional',
        key: 'notional',
        render: (val, record) => val ? `${Number(val).toLocaleString()} ${record.deltaMetadata?.settlingAsset || 'USD'}` : '-',
        width: 100,
      },
    {
      title: 'P&L',
      dataIndex: 'pnl',
      key: 'pnl',
      render: (val, record) => (
        <Tag color={val >= 0 ? 'green' : 'red'}>
          {Number(val || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {record.deltaMetadata?.settlingAsset || 'USD'}
        </Tag>
      ),
      sorter: (a, b) => (a.pnl || 0) - (b.pnl || 0),
      width: 100,
    },
      {
        title: 'Commission',
        dataIndex: 'commission',
        key: 'commission',
        render: (val, record) => val ? `${Number(val).toFixed(2)} ${record.deltaMetadata?.settlingAsset || 'USD'}` : '-',
        width: 90,
      },
    {
      title: 'R Multiple',
      dataIndex: 'rMultiple',
      key: 'rMultiple',
      render: (val) => val ? `${val.toFixed(2)}R` : '-',
      width: 90,
    },
    { 
      title: 'Strategy', 
      dataIndex: 'strategy', 
      key: 'strategy',
      render: (strategies) => (
        <Space wrap>
          {Array.isArray(strategies) ? strategies.map(strategy => (
            <Tag key={strategy} color="purple">{strategy}</Tag>
          )) : strategies}
        </Space>
      ),
      width: 150,
    },
    {
      title: 'Screenshots',
      dataIndex: 'screenshots',
      key: 'screenshots',
      render: (screenshots) => screenshots?.length ? (
        <Image.PreviewGroup>
          <Space>
            {screenshots.map((url, index) => (
              <Image
                key={index}
                src={url}
                width={50}
                height={50}
                style={{ objectFit: 'cover' }}
                alt={`Trade screenshot ${index + 1}`}
              />
            ))}
          </Space>
        </Image.PreviewGroup>
      ) : '-',
      width: 120,
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Button 
          icon={<ExpandAltOutlined />} 
          onClick={() => showTradeDetails(record)}
          type="link"
        >
          Details
        </Button>
      ),
      width: 80,
    },
  ]

  return (
    <>
      <Table 
        dataSource={trades} 
        columns={columns} 
        rowKey={(r) => r.id || Math.random()}
        scroll={{ x: 1300 }}
        pagination={{
          pageSize: 10,
          showSizeChanger: true,
          showTotal: (total) => `Total ${total} trades`
        }}
      />

      <Modal
        title={`Trade Details - ${selectedTrade?.instrument}`}
        visible={!!selectedTrade}
        onCancel={() => setSelectedTrade(null)}
        width={800}
        footer={null}
      >
        {selectedTrade && (
          <div style={{ maxHeight: '80vh', overflow: 'auto' }}>
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
              {/* Trade Statistics */}
              <Card>
                <Space wrap>
                  <Statistic
                    title="P&L"
                    value={selectedTrade.pnl}
                    precision={2}
                    suffix={selectedTrade.deltaMetadata?.settlingAsset || 'USD'}
                    valueStyle={{ color: selectedTrade.pnl >= 0 ? '#3f8600' : '#cf1322' }}
                  />
                  <Statistic
                    title="R Multiple"
                    value={selectedTrade.rMultiple}
                    precision={2}
                    suffix="R"
                  />
                  <Statistic
                    title="Risk/Reward"
                    value={selectedTrade.riskRewardRatio}
                    precision={2}
                  />
                  <Statistic
                    title="Rules Compliance"
                    value={selectedTrade.rulesCompliance}
                    suffix="%"
                  />
                </Space>
              </Card>

              {/* Trade Details */}
              <Card title="Trade Information">
                <Typography.Paragraph>
                  <strong>Date:</strong> {new Date(selectedTrade.date).toLocaleString()}
                </Typography.Paragraph>
                <Typography.Paragraph>
                  <strong>Order Type:</strong> {selectedTrade.deltaMetadata?.orderType?.replace('_', ' ') || 'Unknown'} ({selectedTrade.deltaMetadata?.role || 'unknown'})
                </Typography.Paragraph>
                <Typography.Paragraph>
                  <strong>Direction:</strong> {selectedTrade.direction.toUpperCase()}
                </Typography.Paragraph>
                <Typography.Paragraph>
                  <strong>Entry:</strong> {selectedTrade.entry} | <strong>Exit:</strong> {selectedTrade.exit}
                </Typography.Paragraph>
                <Typography.Paragraph>
                  <strong>Stop Loss:</strong> {selectedTrade.stopLoss} | <strong>Take Profit:</strong> {selectedTrade.takeProfit}
                </Typography.Paragraph>
                <Typography.Paragraph>
                  <strong>Size:</strong> {selectedTrade.size} | <strong>Risk Amount:</strong> {selectedTrade.riskAmount} {selectedTrade.deltaMetadata?.settlingAsset || 'USD'}
                </Typography.Paragraph>
                <Typography.Paragraph>
                  <strong>Commission:</strong> {selectedTrade.commission?.toFixed(2)} {selectedTrade.deltaMetadata?.settlingAsset || 'USD'} ({(selectedTrade.effectiveCommissionRate * 100).toFixed(3)}%)
                </Typography.Paragraph>
                <Typography.Paragraph>
                  <strong>Mark Price:</strong> {selectedTrade.deltaMetadata?.markPrice} | <strong>Spot Price:</strong> {selectedTrade.deltaMetadata?.spotPrice}
                </Typography.Paragraph>
                <Typography.Paragraph>
                  <strong>Psychology:</strong> {selectedTrade.psychology || 'Not recorded'}
                </Typography.Paragraph>
                <Typography.Paragraph>
                  <strong>Order ID:</strong> {selectedTrade.deltaMetadata?.orderId} | <strong>Trade ID:</strong> {selectedTrade.deltaMetadata?.tradeId}
                </Typography.Paragraph>
              </Card>

              {/* Screenshots */}
              {selectedTrade.screenshots?.length > 0 && (
                <Card title="Trade Screenshots">
                  <Image.PreviewGroup>
                    <Space wrap>
                      {selectedTrade.screenshots.map((url, index) => (
                        <Image
                          key={index}
                          src={url}
                          width={200}
                          style={{ objectFit: 'cover' }}
                          alt={`Trade screenshot ${index + 1}`}
                        />
                      ))}
                    </Space>
                  </Image.PreviewGroup>
                </Card>
              )}

              {/* Trade Notes */}
              <Card title="Trade Notes">
                <Typography.Text style={{ whiteSpace: 'pre-wrap' }}>
                  {selectedTrade.remarks || 'No notes recorded'}
                </Typography.Text>
              </Card>
            </Space>
          </div>
        )}
      </Modal>
    </>
  )
}
