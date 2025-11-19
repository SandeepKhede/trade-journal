import React, { useEffect } from 'react'
import { Form, Checkbox, Card, Alert } from 'antd'

export default function TradeRules({ onChange, initialValues = {} }) {
  const [form] = Form.useForm()

  // Set initial values when they change
  useEffect(() => {
    if (initialValues && Object.keys(initialValues).length > 0) {
      form.setFieldsValue(initialValues)
      // Trigger onChange to calculate compliance
      setTimeout(() => {
        const allValues = form.getFieldsValue()
        const totalRules = rules.reduce((sum, category) => sum + category.items.length, 0)
        const checkedRules = Object.values(allValues).filter(Boolean).length
        const compliance = (checkedRules / totalRules) * 100
        onChange?.(compliance, allValues)
      }, 0)
    } else {
      // Reset form if no initial values
      form.resetFields()
      onChange?.(0, {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(initialValues)])

  const rules = [
    {
      category: 'Pre-Trade',
      items: [
        'Market conditions align with strategy',
        'Trading within designated hours',
        'Position size within risk limits',
        'Clear support/resistance levels identified',
        'Risk:Reward ratio is at least 1:2',
      ],
    },
    {
      category: 'Trade Entry',
      items: [
        'Stop loss placed immediately',
        'Entry price at planned level',
        'Not chasing the market',
        'Trading with the trend',
        'Volume confirms the setup',
      ],
    },
    {
      category: 'Trade Management',
      items: [
        'Following the trading plan',
        'Not moving stop loss to break even too early',
        'Taking partial profits as planned',
        'Monitoring key technical levels',
      ],
    },
  ]

  const onValuesChange = (_, allValues) => {
    const totalRules = rules.reduce((sum, category) => sum + category.items.length, 0)
    const checkedRules = Object.values(allValues).filter(Boolean).length
    const compliance = (checkedRules / totalRules) * 100

    onChange?.(compliance, allValues)
  }

  return (
    <Card title="Trade Rules Checklist" style={{ marginBottom: 16 }}>
      <Alert
        message="Verify all rules before entering a trade"
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />
      
      <Form
        form={form}
        onValuesChange={onValuesChange}
        layout="vertical"
      >
        {rules.map((category, i) => (
          <div key={i} style={{ marginBottom: 16 }}>
            <h4>{category.category}</h4>
            {category.items.map((rule, j) => (
              <Form.Item
                key={`${i}-${j}`}
                name={`rule-${i}-${j}`}
                valuePropName="checked"
              >
                <Checkbox>{rule}</Checkbox>
              </Form.Item>
            ))}
          </div>
        ))}
      </Form>
    </Card>
  )
}