import React, { useState } from 'react';
import { Form, Input, Button, Card, Alert, Layout, Typography } from 'antd';
import { UserOutlined, LockOutlined, LineChartOutlined } from '@ant-design/icons';
import { loginWithEmail } from '../auth';

const { Content } = Layout;
const { Title } = Typography;

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const onFinish = async ({ email, password }) => {
    setLoading(true);
    setError(null);
    
    const { user, error } = await loginWithEmail(email, password);
    
    if (error) {
      setError(error);
    }
    
    setLoading(false);
  };

  return (
    <div className="login-page">
      <div className="fade-in" style={{ width: '100%', maxWidth: '400px', position: 'relative', zIndex: 1 }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <LineChartOutlined 
            style={{ 
              fontSize: '64px', 
              color: 'rgba(255, 255, 255, 0.9)',
              filter: 'drop-shadow(0 0 10px rgba(41, 196, 255, 0.3))'
            }} 
            className="icon-hover" 
          />
          <Title level={2} style={{ 
            color: 'rgba(255, 255, 255, 0.9)', 
            margin: '16px 0 0', 
            fontWeight: '600',
            textShadow: '0 2px 10px rgba(0, 0, 0, 0.3)'
          }}>
            Trading Journal
          </Title>
        </div>
        
        <Card 
          className="login-card"
          style={{ width: '100%', padding: '8px' }}
        >
          <Form
            name="login"
            onFinish={onFinish}
            layout="vertical"
            style={{ width: '100%' }}
          >
            {error && (
              <Form.Item>
                <Alert
                  message={error}
                  type="error"
                  showIcon
                  className="login-alert fade-in"
                  style={{
                    background: 'rgba(255, 85, 85, 0.15)',
                    border: '1px solid rgba(255, 85, 85, 0.3)',
                    color: 'rgba(255, 255, 255, 0.9)'
                  }}
                />
              </Form.Item>
            )}

            <Form.Item
              name="email"
              className="login-form-item"
              rules={[
                { 
                  required: true,
                  message: 'Please enter your email' 
                },
                {
                  type: 'email',
                  message: 'Please enter a valid email'
                }
              ]}
            >
              <Input 
                className="login-input"
                prefix={
                  <UserOutlined 
                    className="icon-hover" 
                    style={{ color: 'rgba(255, 255, 255, 0.6)' }}
                  />
                }
                placeholder="Email"
                size="large"
              />
            </Form.Item>

            <Form.Item
              name="password"
              className="login-form-item"
              rules={[
                { 
                  required: true,
                  message: 'Please enter your password'
                }
              ]}
            >
              <Input.Password
                className="login-input"
                prefix={
                  <LockOutlined 
                    className="icon-hover" 
                    style={{ color: 'rgba(255, 255, 255, 0.6)' }}
                  />
                }
                placeholder="Password"
                size="large"
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                }}
              />
            </Form.Item>

            <Form.Item>
              <Button
                className="login-button"
                type="primary"
                htmlType="submit"
                loading={loading}
                style={{ width: '100%' }}
                size="large"
              >
                Log in
              </Button>
            </Form.Item>
          </Form>
        </Card>
      </div>
    </div>
  );
}