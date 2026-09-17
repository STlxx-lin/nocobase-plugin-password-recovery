import React, { useState } from 'react';
import { Card, Button } from 'antd';
import { LeftOutlined } from '@ant-design/icons';
import { useApp } from '@nocobase/client-v2';
import { PasswordRecoveryModal } from '../components/PasswordRecoveryModal';

export default function StandaloneRecoveryPage() {
  const app = useApp();
  const [modalOpen, setModalOpen] = useState(true);

  const handleBackToLogin = () => {
    if (app?.router?.navigate) {
      app.router.navigate('/signin');
    } else {
      window.location.href = '/signin';
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f0f2f5',
        padding: 24,
      }}
    >
      <Card
        style={{ width: 440, borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.06)' }}
        bodyStyle={{ padding: 24 }}
      >
        <PasswordRecoveryModal
          open={modalOpen}
          onCancel={handleBackToLogin}
          onSuccess={handleBackToLogin}
        />
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <Button type="link" icon={<LeftOutlined />} onClick={handleBackToLogin}>
            返回登录页面
          </Button>
        </div>
      </Card>
    </div>
  );
}
