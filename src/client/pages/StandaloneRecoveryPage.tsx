import React from 'react';
import { Card, Button } from 'antd';
import { useNavigate } from 'react-router-dom';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { PasswordRecoveryModal } from '../components/PasswordRecoveryModal';

export const StandaloneRecoveryPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f0f2f5',
        padding: '24px',
      }}
    >
      <Card
        style={{
          width: 480,
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
          borderRadius: 12,
        }}
        extra={
          <Button
            type="link"
            size="small"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/signin')}
          >
            返回登录
          </Button>
        }
      >
        <PasswordRecoveryModal
          open={true}
          onCancel={() => navigate('/signin')}
          onSuccess={() => {
            setTimeout(() => {
              navigate('/signin');
            }, 2000);
          }}
        />
      </Card>
    </div>
  );
};

export default StandaloneRecoveryPage;
