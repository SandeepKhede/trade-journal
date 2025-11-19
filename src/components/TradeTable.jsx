import React, { useState, useEffect } from 'react'
import { Table, Tag, Image, Modal, Space, Button, Typography, Card, Statistic, Upload, Progress, message } from 'antd'
import { ExpandAltOutlined, EditOutlined, SaveOutlined, CloseOutlined, UploadOutlined } from '@ant-design/icons'
import TradeRules from './TradeRules'
import { updateTrade } from '../firebase'

export default function TradeTable({ trades = [], onTradeUpdate }) {
  const [selectedTrade, setSelectedTrade] = useState(null)
  const [isEditMode, setIsEditMode] = useState(false)
  const [rulesCompliance, setRulesCompliance] = useState(0)
  const [rulesChecked, setRulesChecked] = useState({})
  const [screenshotFileList, setScreenshotFileList] = useState([])
  const [isSaving, setIsSaving] = useState(false)

  // Function to open trade details modal
  const showTradeDetails = (trade) => {
    setSelectedTrade(trade)
    setIsEditMode(false)
    // Initialize rules from trade data
    if (trade.rulesChecked) {
      setRulesChecked(trade.rulesChecked)
      setRulesCompliance(trade.rulesCompliance || 0)
    } else {
      setRulesChecked({})
      setRulesCompliance(0)
    }
    // Initialize screenshot file list from existing screenshots
    if (trade.screenshotUrls && trade.screenshotUrls.length > 0) {
      setScreenshotFileList(
        trade.screenshotUrls.map((url, index) => ({
          uid: `existing-${index}`,
          name: `screenshot-${index + 1}.jpg`,
          status: 'done',
          url: url,
        }))
      )
    } else if (trade.screenshots && trade.screenshots.length > 0) {
      // Handle base64 screenshots
      setScreenshotFileList(
        trade.screenshots.map((screenshot, index) => ({
          uid: `existing-${index}`,
          name: `screenshot-${index + 1}.jpg`,
          status: 'done',
          url: screenshot,
        }))
      )
    } else {
      setScreenshotFileList([])
    }
  }

  // Reset edit mode when modal closes
  useEffect(() => {
    if (!selectedTrade) {
      setIsEditMode(false)
      setRulesChecked({})
      setRulesCompliance(0)
      setScreenshotFileList([])
    }
  }, [selectedTrade])

  const handleSave = async () => {
    if (!selectedTrade || !selectedTrade.id) {
      message.error('Cannot save: Trade ID is missing')
      return
    }

    setIsSaving(true)
    try {
      // Convert new screenshots to base64
      const newScreenshots = []
      const existingScreenshotUrls = []
      
      for (const file of screenshotFileList) {
        if (file.status === 'done' && file.url) {
          // Existing screenshot - keep base64 data URLs
          if (file.url.startsWith('data:')) {
            // Base64 data URL from existing screenshot - keep as is
            existingScreenshotUrls.push(file.url)
          } else if (file.url.startsWith('http')) {
            // Old Storage URL - we'll skip these as we can't convert them to base64
            // But we'll keep them for backward compatibility display
            console.warn('Skipping Storage URL (cannot convert to base64):', file.url)
          }
        } else if (file.originFileObj) {
          // New file to upload - convert to base64
          try {
            const reader = new FileReader()
            const base64 = await new Promise((resolve, reject) => {
              reader.onload = (e) => resolve(e.target.result)
              reader.onerror = reject
              reader.readAsDataURL(file.originFileObj)
            })
            newScreenshots.push(base64)
          } catch (fileError) {
            console.error('Error reading file:', fileError)
            message.warning(`Failed to process one screenshot file: ${file.name || 'unknown'}`)
          }
        }
      }

      // Clean up the rulesChecked object
      const cleanedRulesChecked = {}
      Object.entries(rulesChecked).forEach(([key, value]) => {
        if (value !== undefined) {
          cleanedRulesChecked[key] = Boolean(value)
        }
      })

      // Prepare update data - combine existing and new screenshots
      const allScreenshots = [...existingScreenshotUrls, ...newScreenshots]
      const updates = {
        rulesCompliance: rulesCompliance || 0,
        rulesChecked: cleanedRulesChecked,
        screenshots: allScreenshots.length > 0 ? allScreenshots : null,
        existingScreenshotUrls: existingScreenshotUrls, // For processing in updateTrade
      }

      // Update the trade
      await updateTrade(selectedTrade.id, updates)
      
      message.success('Trade updated successfully!')
      setIsEditMode(false)
      
      // Notify parent component to refresh trades
      if (onTradeUpdate) {
        onTradeUpdate()
      }
      
      // Update local state with new data
      setSelectedTrade({
        ...selectedTrade,
        ...updates,
        screenshots: allScreenshots, // Update with all screenshots (base64)
      })
    } catch (error) {
      console.error('Error updating trade:', error)
      let errorMessage = 'Failed to update trade: ' + (error.message || 'Unknown error')
      
      // Provide helpful error messages for common issues
      if (error.message && error.message.includes('Storage')) {
        errorMessage = error.message + ' Please ensure you are logged in and Firebase Storage rules allow uploads.'
      } else if (error.message && error.message.includes('CORS')) {
        errorMessage = 'CORS error: Please check Firebase Storage configuration and security rules.'
      }
      
      message.error({
        content: errorMessage,
        duration: 6,
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancelEdit = () => {
    setIsEditMode(false)
    // Reset to original trade data
    if (selectedTrade) {
      showTradeDetails(selectedTrade)
    }
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
      render: (screenshots, record) => {
        const allScreenshots = record.screenshotUrls || screenshots || []
        return allScreenshots.length > 0 ? (
          <Image.PreviewGroup>
            <Space>
              {allScreenshots.map((url, index) => (
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
        ) : '-'
      },
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
        open={!!selectedTrade}
        onCancel={() => {
          setSelectedTrade(null)
          setIsEditMode(false)
        }}
        width={900}
        footer={
          isEditMode ? (
            <Space>
              <Button onClick={handleCancelEdit} disabled={isSaving}>
                Cancel
              </Button>
              <Button
                type="primary"
                icon={<SaveOutlined />}
                onClick={handleSave}
                loading={isSaving}
              >
                Save Changes
              </Button>
            </Space>
          ) : (
            <Button
              icon={<EditOutlined />}
              onClick={() => setIsEditMode(true)}
              type="primary"
            >
              Edit Trade
            </Button>
          )
        }
      >
        {selectedTrade && (
          <div style={{ maxHeight: '80vh', overflow: 'auto' }}>
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
              {/* Trade Rules - Show in edit mode */}
              {isEditMode && (
                <>
                  <TradeRules
                    onChange={(compliance, checkedRules) => {
                      const cleanRules = {}
                      Object.entries(checkedRules).forEach(([key, value]) => {
                        if (value !== undefined) {
                          cleanRules[key] = Boolean(value)
                        }
                      })
                      setRulesCompliance(compliance)
                      setRulesChecked(cleanRules)
                    }}
                    initialValues={selectedTrade.rulesChecked || {}}
                  />
                  <div style={{ marginBottom: 16 }}>
                    <div>Rules Compliance:</div>
                    <Progress
                      percent={Math.round(rulesCompliance)}
                      status={rulesCompliance >= 80 ? "success" : rulesCompliance >= 60 ? "normal" : "exception"}
                    />
                  </div>
                </>
              )}

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
                    value={isEditMode ? rulesCompliance : (selectedTrade.rulesCompliance || 0)}
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
              <Card 
                title="Trade Screenshots"
                extra={isEditMode && (
                  <span style={{ fontSize: '12px', color: '#8c8c8c' }}>
                    Images auto-compressed (1MB limit)
                  </span>
                )}
              >
                {isEditMode ? (
                  <>
                    <Upload
                      listType="picture-card"
                      fileList={screenshotFileList}
                      onChange={({ fileList }) => setScreenshotFileList(fileList)}
                      beforeUpload={(file) => {
                        const isImage = file.type.startsWith('image/')
                        if (!isImage) {
                          message.error('You can only upload image files!')
                          return false
                        }
                        const fileSizeMB = file.size / 1024 / 1024
                        if (fileSizeMB > 5) {
                          message.warning(`Large image (${fileSizeMB.toFixed(2)}MB) will be compressed automatically`)
                        }
                        return false // Prevent auto upload
                      }}
                      maxCount={5}
                    >
                      {screenshotFileList.length < 5 && (
                        <div>
                          <UploadOutlined />
                          <div style={{ marginTop: 8 }}>Upload</div>
                        </div>
                      )}
                    </Upload>
                    <div style={{ fontSize: '12px', color: '#8c8c8c', marginTop: 8 }}>
                      Screenshots stored in Firestore (1MB limit per trade). Images are automatically compressed.
                    </div>
                  </>
                ) : (
                  <>
                    {(selectedTrade.screenshotUrls?.length > 0 || selectedTrade.screenshots?.length > 0) ? (
                      <Image.PreviewGroup>
                        <Space wrap>
                          {(selectedTrade.screenshotUrls || selectedTrade.screenshots || []).map((url, index) => (
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
                    ) : (
                      <Typography.Text type="secondary">No screenshots added yet</Typography.Text>
                    )}
                  </>
                )}
              </Card>

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
