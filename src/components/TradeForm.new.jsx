import React, { useState } from 'react'
import { Form, Input, InputNumber, Button, Select, DatePicker, message, Space, Progress, Upload, Spin } from 'antd'
import { UploadOutlined } from '@ant-design/icons'
import { addTrade } from '../firebase'
import TradeRules from './TradeRules'

const { TextArea } = Input

export default function TradeForm() {
  const [form] = Form.useForm()
  const [rulesCompliance, setRulesCompliance] = useState(0)
  const [rulesChecked, setRulesChecked] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const onFinish = async (values) => {
    if (isSubmitting) return
    setIsSubmitting(true)
    
    const hide = message.loading('Processing trade data...', 0)
    
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
          cleanedRulesChecked[key] = Boolean(value)
        }
      })

      // Prepare trade data with proper type conversions and default values
      const trade = {
        date: values.date ? values.date.toISOString() : new Date().toISOString(),
        instrument: values.instrument?.trim() || '',
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
        remarks: values.remarks?.trim() || '',
        rulesCompliance: rulesCompliance || 0,
        rulesChecked: cleanedRulesChecked,
        screenshots: screenshots,
        timestamp: new Date().getTime()
      }

      // Save the trade
      await addTrade(trade)
      
      // Clear loading message and show success
      hide()
      message.success({
        content: 'Trade successfully saved! 🎯',
        duration: 3,
      })

      // Reset form and states
      form.resetFields()
      setRulesCompliance(0)
      setRulesChecked({})
      
      // Scroll to top of form
      window.scrollTo({ top: 0, behavior: 'smooth' })

      // Clear any previous error messages
      form.setFields([])
    } catch (error) {
      hide()
      message.error({
        content: 'Error saving trade: ' + error.message,
        duration: 5,
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Spin spinning={isSubmitting} tip="Saving trade...">
      <Form layout="vertical" form={form} onFinish={onFinish} style={{ maxWidth: 800 }}>
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

        <Form.Item name="date" label="Date & time" rules={[{ required: true, message: 'Please select the trade date' }]}>
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
          label="Trade Screenshots"
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
              }
              const isLt5M = file.size / 1024 / 1024 < 5;
              if (!isLt5M) {
                message.error('Image must be smaller than 5MB!');
              }
              // Return false to stop auto upload
              return false;
            }}
          >
            <Button icon={<UploadOutlined />} disabled={isSubmitting}>
              Upload Setup/Trade Screenshots
            </Button>
          </Upload>
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
    </Spin>
  )
}