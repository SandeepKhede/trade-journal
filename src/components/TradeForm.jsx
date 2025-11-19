import React, { useState } from 'react'
import { Form, Input, InputNumber, Button, Select, DatePicker, message, Space, Progress, Upload, Spin, Modal, Popconfirm } from 'antd'
import { UploadOutlined, SyncOutlined, DeleteOutlined } from '@ant-design/icons'
import { addTrade, clearAllTrades } from '../firebase'
import TradeRules from './TradeRules'
import { DeltaExchangeAPI } from '../delta-api'

const { TextArea } = Input

export default function TradeForm() {
  const [form] = Form.useForm()
  const [rulesCompliance, setRulesCompliance] = useState(0)
  const [rulesChecked, setRulesChecked] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [isResetting, setIsResetting] = useState(false)
  const [showApiConfig, setShowApiConfig] = useState(false)
  const [apiConfig, setApiConfig] = useState({
    apiKey: localStorage.getItem('deltaApiKey') || '',
    apiSecret: localStorage.getItem('deltaApiSecret') || ''
  })

  const onFinish = async (values) => {
    if (isSubmitting) return
    setIsSubmitting(true)
    let hide = null
    try {
      const entry = parseFloat(values.entry)
      const exit = parseFloat(values.exit)
      const stopLoss = parseFloat(values.stopLoss)
      const takeProfit = parseFloat(values.takeProfit)
      const size = parseFloat(values.size)

      // Convert screenshots to base64 if present
    const screenshots = []
    if (values.screenshots?.length) {
      try {
        for (const file of values.screenshots) {
          const reader = new FileReader()
          const base64 = await new Promise((resolve) => {
            reader.onload = (e) => resolve(e.target.result)
            reader.readAsDataURL(file.originFileObj)
          })
          screenshots.push(base64)
        }
      } catch (error) {
        message.error('Error processing screenshots: ' + error.message)
      }
    }

    // Calculate R:R ratio and actual R multiple
    const riskPerShare = Math.abs(entry - stopLoss)
    const rewardPerShare = Math.abs(takeProfit - entry)
    const riskRewardRatio = rewardPerShare / riskPerShare

    // Calculate actual R multiple achieved
    const actualPnL = (exit - entry) * size
    const initialRisk = values.riskAmount
    const rMultiple = actualPnL / initialRisk

      // Clean up the rulesChecked object by removing undefined values
      const cleanedRulesChecked = {}
      Object.entries(rulesChecked).forEach(([key, value]) => {
        if (value !== undefined) {
          cleanedRulesChecked[key] = value
        }
      })

      // Prepare trade data with proper type conversions and default values
      const trade = {
        date: values.date ? values.date.toISOString() : new Date().toISOString(),
        instrument: values.instrument || '',
        direction: values.direction || 'long',
        strategy: values.strategy || [],
        entry: parseFloat(values.entry) || 0,
        exit: parseFloat(values.exit) || 0,
        stopLoss: parseFloat(values.stopLoss) || 0,
        takeProfit: parseFloat(values.takeProfit) || 0,
        size: parseFloat(values.size) || 0,
        pnl: actualPnL || 0,
        riskAmount: parseFloat(values.riskAmount) || 0,
        riskRewardRatio: parseFloat(riskRewardRatio) || 0,
        rMultiple: parseFloat(rMultiple) || 0,
        tags: Array.isArray(values.tags) ? values.tags : [],
        psychology: values.psychology || null,
        remarks: values.remarks || '',
        rulesCompliance: rulesCompliance || 0,
        rulesChecked: cleanedRulesChecked, // Use the cleaned version
        screenshots: screenshots || [],
        timestamp: new Date().getTime()
      }
      try {
        // Show loading message
        hide = message.loading('Saving trade...', 0)
        
        // Save the trade
        await addTrade(trade)
        
        // Clear loading message and show success
        if (hide) hide()
        message.success({
          content: 'Trade successfully saved! 🎯',
          duration: 3,
        })

        // Reset all states and form
        form.resetFields()
        setRulesCompliance(0)
        setRulesChecked({})
        
        // Scroll to top of form
        window.scrollTo({ top: 0, behavior: 'smooth' })

        // Clear any previous error messages
        form.setFields([])
      } catch (error) {
        message.error({
          content: 'Error saving trade: ' + error.message,
          duration: 5,
        })
      }
    } catch (error) {
      message.error({
        content: 'Error processing trade data: ' + error.message,
        duration: 5,
      })
    } finally {
      setIsSubmitting(false)
      if (hide) hide()
    }
  }

  const resetAndResync = async () => {
    setIsResetting(true);
    try {
      await clearAllTrades();
      message.success('Database cleared successfully');
      // Trigger resync
      await syncDeltaTrades();
    } catch (error) {
      message.error('Failed to reset database: ' + error.message);
    } finally {
      setIsResetting(false);
    }
  };

  const syncDeltaTrades = async () => {
    if (!apiConfig.apiKey || !apiConfig.apiSecret) {
      setShowApiConfig(true);
      return;
    }

    // Log the API key length for debugging (not the actual key)
    console.log('API Key length:', apiConfig.apiKey.length);
    console.log('API Secret length:', apiConfig.apiSecret.length);

    setIsSyncing(true);
    try {
      const deltaApi = new DeltaExchangeAPI(apiConfig.apiKey, apiConfig.apiSecret);
        const endTime = Math.floor(Date.now() / 1000);
        const startTime = endTime - (7 * 24 * 60 * 60); // Last 7 days

      const fills = await deltaApi.getFills(startTime, endTime);
      console.debug('[Delta Sync] Got fills:', { count: fills.length });
      const trades = fills.map(fill => deltaApi.convertTradeFormat(fill));

      // Save each trade
      let successCount = 0;
      for (const trade of trades) {
        try {
          await addTrade(trade);
          successCount++;
        } catch (error) {
          console.error('Error saving trade:', error);
        }
      }

      message.success(`Successfully synced ${successCount} trades from Delta Exchange`);
    } catch (error) {
      message.error('Failed to sync trades: ' + error.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleApiConfigSubmit = () => {
    localStorage.setItem('deltaApiKey', apiConfig.apiKey);
    localStorage.setItem('deltaApiSecret', apiConfig.apiSecret);
    setShowApiConfig(false);
    message.success('API configuration saved');
  };

  return (
    <>
      <Modal
        title="Delta Exchange API Configuration"
        open={showApiConfig}
        onOk={handleApiConfigSubmit}
        onCancel={() => setShowApiConfig(false)}
      >
        <Form layout="vertical">
          <Form.Item label="API Key">
            <Input
              value={apiConfig.apiKey}
              onChange={e => setApiConfig(prev => ({ ...prev, apiKey: e.target.value }))}
              placeholder="Enter your Delta Exchange API Key"
            />
          </Form.Item>
          <Form.Item label="API Secret">
            <Input.Password
              value={apiConfig.apiSecret}
              onChange={e => setApiConfig(prev => ({ ...prev, apiSecret: e.target.value }))}
              placeholder="Enter your Delta Exchange API Secret"
            />
          </Form.Item>
        </Form>
      </Modal>

      <Form layout="vertical" form={form} onFinish={onFinish} style={{ maxWidth: 800 }}>
        <div style={{ 
          marginBottom: 16, 
          display: 'flex', 
          justifyContent: 'flex-end',
          gap: '8px'
        }}>
          <Popconfirm
            title="Reset Database"
            description="This will delete all trades and resync from Delta Exchange. Are you sure?"
            onConfirm={resetAndResync}
            okText="Yes"
            cancelText="No"
          >
            <Button
              danger
              icon={<DeleteOutlined spin={isResetting} />}
              loading={isResetting}
              style={{ minWidth: 'fit-content' }}
            >
              Reset & Resync
            </Button>
          </Popconfirm>
          <Button
            type="primary"
            icon={<SyncOutlined spin={isSyncing} />}
            onClick={syncDeltaTrades}
            loading={isSyncing}
            style={{ minWidth: 'fit-content' }}
          >
            Sync Delta Exchange Trades
          </Button>
        </div>
        <TradeRules 
        onChange={(compliance, checkedRules) => {
          // Clean up the rules object before setting it
          const cleanRules = {}
          Object.entries(checkedRules).forEach(([key, value]) => {
            if (value !== undefined) {
              cleanRules[key] = Boolean(value) // Convert to boolean to ensure valid data
            }
          })
          setRulesCompliance(compliance)
          setRulesChecked(cleanRules)
        }}
      />

      <div style={{ marginBottom: 16 }}>
        <div>Rules Compliance:</div>
        <Progress
          percent={Math.round(rulesCompliance)}
          status={rulesCompliance >= 80 ? "success" : rulesCompliance >= 60 ? "normal" : "exception"}
        />
      </div>

      <Form.Item name="date" label="Date & time" rules={[{ required: false }]}>
        <DatePicker showTime style={{ width: '100%' }} />
      </Form.Item>

      <Form.Item name="instrument" label="Instrument" rules={[{ required: true }]}> 
        <Input placeholder="e.g., AAPL, BTCUSD" />
      </Form.Item>

      <Form.Item name="direction" label="Direction" rules={[{ required: true }]}>
        <Select>
          <Select.Option value="long">Long</Select.Option>
          <Select.Option value="short">Short</Select.Option>
        </Select>
      </Form.Item>

      <Form.Item name="strategy" label="Strategy" rules={[{ required: true }]}>
        <Select
          placeholder="Select a strategy"
          allowClear
          mode="tags"
        >
          <Select.Option value="breakout">Breakout</Select.Option>
          <Select.Option value="pullback">Pullback</Select.Option>
          <Select.Option value="trend-following">Trend Following</Select.Option>
          <Select.Option value="mean-reversion">Mean Reversion</Select.Option>
          <Select.Option value="momentum">Momentum</Select.Option>
        </Select>
      </Form.Item>

      <Form.Item name="entry" label="Entry Price" rules={[{ required: true }]}>
        <InputNumber style={{ width: '100%' }} min={0} />
      </Form.Item>

      <Form.Item name="stopLoss" label="Stop Loss" rules={[{ required: true }]}>
        <InputNumber style={{ width: '100%' }} min={0} />
      </Form.Item>

      <Form.Item name="takeProfit" label="Take Profit" rules={[{ required: true }]}>
        <InputNumber style={{ width: '100%' }} min={0} />
      </Form.Item>

      <Form.Item name="exit" label="Exit Price" rules={[{ required: true }]}>
        <InputNumber style={{ width: '100%' }} min={0} />
      </Form.Item>

      <Form.Item name="size" label="Position Size" rules={[{ required: true }]}>
        <InputNumber style={{ width: '100%' }} min={0} />
      </Form.Item>

      <Form.Item name="riskAmount" label="Risk Amount ($)" rules={[{ required: true }]}>
        <InputNumber style={{ width: '100%' }} min={0} />
      </Form.Item>

      <Form.Item name="tags" label="Trade Tags">
        <Select
          mode="tags"
          placeholder="Add trade tags"
          style={{ width: '100%' }}
        />
      </Form.Item>

      <Form.Item 
        name="screenshots" 
        label={
          <span>
            Trade Screenshots
            <span style={{ color: '#ff9800', fontSize: '12px', marginLeft: 8 }}>
              (Images will be compressed to fit Firestore 1MB limit)
            </span>
          </span>
        }
        valuePropName="fileList"
        getValueFromEvent={e => {
          if (Array.isArray(e)) {
            return e;
          }
          return e?.fileList;
        }}
      >
        <Upload
          listType="picture"
          maxCount={3}
          beforeUpload={(file) => {
            const isImage = file.type.startsWith('image/');
            if (!isImage) {
              message.error('You can only upload image files!');
              return false;
            }
            const isLt5M = file.size / 1024 / 1024 < 5;
            if (!isLt5M) {
              message.warning('Large images will be compressed automatically. Original size: ' + (file.size / 1024 / 1024).toFixed(2) + 'MB');
            }
            // Return false to stop auto upload
            return false;
          }}
        >
          <Button icon={<UploadOutlined />}>Upload Setup/Trade Screenshots</Button>
        </Upload>
        <div style={{ fontSize: '12px', color: '#8c8c8c', marginTop: 4 }}>
          Note: Screenshots are stored in Firestore (1MB limit per trade). Images are automatically compressed.
        </div>
      </Form.Item>

      <Form.Item name="psychology" label="Trading Psychology">
        <Select placeholder="How did you feel during the trade?">
          <Select.Option value="confident">Confident</Select.Option>
          <Select.Option value="fearful">Fearful</Select.Option>
          <Select.Option value="greedy">Greedy</Select.Option>
          <Select.Option value="patient">Patient</Select.Option>
          <Select.Option value="impulsive">Impulsive</Select.Option>
          <Select.Option value="frustrated">Frustrated</Select.Option>
        </Select>
      </Form.Item>

      <Form.Item name="journalTemplate" label="Journal Entry Template">
        <Select
          style={{ width: '100%' }}
          placeholder="Select a template for your trade journal entry"
          onChange={(value) => {
            const templates = {
              basic: "Trade Setup:\n- Market conditions:\n- Key support/resistance levels:\n- Trigger for entry:\n\nTrade Execution:\n- Entry timing:\n- Position sizing rationale:\n- Initial stop placement:\n\nTrade Management:\n- Exit reasoning:\n- Adjustments made:\n- Emotions during trade:",
              detailed: "Pre-Trade Analysis:\n- Market context and bias:\n- Key price levels:\n- Risk/reward calculation:\n- Expected scenario:\n\nTrade Execution:\n- Entry trigger details:\n- Initial stop reasoning:\n- Position size calculation:\n- Take profit levels:\n\nTrade Management:\n- Adjustments made:\n- Reason for adjustments:\n- Psychology during trade:\n- Challenges faced:\n\nPost-Trade Review:\n- What worked well:\n- What could improve:\n- Lessons learned:\n- Action items for next trade:",
              psychology: "Emotional State:\n- Before trade:\n- During trade:\n- After trade:\n\nMindset Check:\n- FOMO present?\n- Revenge trading urges?\n- Patience level:\n- Confidence level:\n\nLessons & Growth:\n- Emotional challenges:\n- How I handled them:\n- What to improve:"
            }
            form.setFieldsValue({ remarks: templates[value] })
          }}
        >
          <Select.Option value="basic">Basic Template</Select.Option>
          <Select.Option value="detailed">Detailed Analysis</Select.Option>
          <Select.Option value="psychology">Psychology Focus</Select.Option>
        </Select>
      </Form.Item>

      <Form.Item name="remarks" label="Trade Journal Entry">
        <TextArea 
          rows={12} 
          placeholder="Select a template above or write your own trade analysis..."
        />
      </Form.Item>

      <Form.Item>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Space>
            <Button 
              type="primary" 
              htmlType="submit" 
              loading={isSubmitting}
              disabled={isSubmitting || rulesCompliance < 50}
            >
              {isSubmitting ? 'Saving Trade...' : 'Save Trade'}
            </Button>
            <Button 
              onClick={() => {
                form.resetFields()
                setRulesCompliance(0)
                setRulesChecked({})
              }} 
              disabled={isSubmitting}
            >
              Clear Form
            </Button>
          </Space>
          {rulesCompliance < 50 && (
            <div style={{ color: '#ff4d4f' }}>
              Please complete at least 50% of the trading rules checklist before submitting.
            </div>
          )}
        </Space>
      </Form.Item>
    </Form>
  </>
  )
}
