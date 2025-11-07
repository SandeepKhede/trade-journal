import React, { useState } from 'react';
import { Form, Input, Button, Card, Alert, Layout } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { loginWithEmail } from '../auth';

const { Content } = Layout;

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
    <Layout style={{ minHeight: '100vh' }}>
      <Content style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center',
        backgroundColor: '#f0f2f5'
      }}>
        <Card 
          title="Trading Journal Login" 
          style={{ 
            width: 300,
            boxShadow: '0 4px 8px rgba(0,0,0,0.1)'
          }}
        >
          <Form
            name="login"
            onFinish={onFinish}
            layout="vertical"
          >
            {error && (
              <Form.Item>
                <Alert
                  message={error}
                  type="error"
                  showIcon
                />
              </Form.Item>
            )}

            <Form.Item
              name="email"
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
                prefix={<UserOutlined />} 
                placeholder="Email"
                size="large"
              />
            </Form.Item>

            <Form.Item
              name="password"
              rules={[
                { 
                  required: true,
                  message: 'Please enter your password'
                }
              ]}
            >
              <Input.Password
                prefix={<LockOutlined />}
                placeholder="Password"
                size="large"
              />
            </Form.Item>

            <Form.Item>
              <Button
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
      </Content>
    </Layout>
  );
}