import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, Button, Alert, Space, Typography, Result, Steps } from 'antd';
import {
  UserOutlined,
  LockOutlined,
  SafetyCertificateOutlined,
  CheckCircleFilled,
  ArrowLeftOutlined,
} from '@ant-design/icons';
import { useApp } from '@nocobase/client-v2';
import { useT } from '../locale';

const { Text, Paragraph } = Typography;

interface PasswordRecoveryModalProps {
  open: boolean;
  onCancel: () => void;
  onSuccess?: () => void;
  codeLength?: number;
}

export const PasswordRecoveryModal: React.FC<PasswordRecoveryModalProps> = ({
  open,
  onCancel,
  onSuccess,
  codeLength = 6,
}) => {
  const t = useT();
  const app = useApp();

  const [currentStep, setCurrentStep] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  // 状态数据
  const [account, setAccount] = useState<string>('');
  const [maskedAccount, setMaskedAccount] = useState<string>('');
  const [token, setToken] = useState<string>('');
  const [countdown, setCountdown] = useState<number>(0);
  const [pwdValue, setPwdValue] = useState<string>('');

  const [step1Form] = Form.useForm();
  const [step2Form] = Form.useForm();

  // 密码强度评估计算
  const getPasswordStrength = (pwd: string) => {
    if (!pwd) return null;
    let score = 0;
    if (pwd.length >= 6) score += 1;
    if (pwd.length >= 8) score += 1;
    if (/[a-zA-Z]/.test(pwd) && /\d/.test(pwd)) score += 1;
    if (/[^a-zA-Z0-9]/.test(pwd)) score += 1;

    if (score <= 1) return { level: 'weak', text: t('Weak'), color: '#ff4d4f', percent: 33 };
    if (score <= 3) return { level: 'medium', text: t('Medium'), color: '#1677ff', percent: 66 };
    return { level: 'strong', text: t('Strong'), color: '#52c41a', percent: 100 };
  };

  // 重置对话框状态
  useEffect(() => {
    if (open) {
      setCurrentStep(0);
      setErrorMessage('');
      setLoading(false);
      setAccount('');
      setMaskedAccount('');
      setToken('');
      setCountdown(0);
      setPwdValue('');
      step1Form.resetFields();
      step2Form.resetFields();
    }
  }, [open, step1Form, step2Form]);

  // 倒计时计时器
  useEffect(() => {
    let timer: any = null;
    if (countdown > 0) {
      timer = setTimeout(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [countdown]);

  // 步骤 1：核验账号并发送验证码
  const handleSendCode = async (values: { account: string }) => {
    setErrorMessage('');
    setLoading(true);
    const targetAccount = values.account.trim();

    try {
      let resData: any = null;
      if (app?.apiClient) {
        const res = await app.apiClient.request({
          url: 'passwordRecovery:checkAccountAndSendCode',
          method: 'post',
          skipAuth: true,
          data: { account: targetAccount },
        });
        resData = res?.data?.data || res?.data;
      } else {
        const resp = await fetch('/api/passwordRecovery:checkAccountAndSendCode', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ account: targetAccount }),
        });
        const json = await resp.json();
        if (!resp.ok) {
          throw new Error(json?.message || json?.errors?.[0]?.message || '请求失败');
        }
        resData = json?.data || json;
      }

      if (resData?.success) {
        setAccount(targetAccount);
        setToken(resData.token);
        setMaskedAccount(resData.maskedAccount || targetAccount);
        setCountdown(60); // 开启 60 秒冷却
        setCurrentStep(1);
      } else {
        setErrorMessage(resData?.message || '验证码发送失败');
      }
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.errors?.[0]?.message ||
        err?.message ||
        '账号核验失败，请重试';
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  // 步骤 2 重新获取验证码
  const handleResendCode = async () => {
    if (countdown > 0 || !account || loading) return;
    setErrorMessage('');
    setLoading(true);

    try {
      let resData: any = null;
      if (app?.apiClient) {
        const res = await app.apiClient.request({
          url: 'passwordRecovery:checkAccountAndSendCode',
          method: 'post',
          skipAuth: true,
          data: { account },
        });
        resData = res?.data?.data || res?.data;
      } else {
        const resp = await fetch('/api/passwordRecovery:checkAccountAndSendCode', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ account }),
        });
        const json = await resp.json();
        if (!resp.ok) {
          throw new Error(json?.message || json?.errors?.[0]?.message || '重新获取失败');
        }
        resData = json?.data || json;
      }

      if (resData?.success) {
        setToken(resData.token);
        setCountdown(60);
      } else {
        setErrorMessage(resData?.message || '重新获取验证码失败');
      }
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.errors?.[0]?.message ||
        err?.message ||
        '重新获取验证码失败';
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  // 步骤 2：重置密码
  const handleResetPassword = async (values: any) => {
    setErrorMessage('');
    setLoading(true);

    try {
      let resData: any = null;
      const payload = {
        token,
        code: values.code?.trim(),
        newPassword: values.newPassword,
        confirmPassword: values.confirmPassword,
      };

      if (app?.apiClient) {
        const res = await app.apiClient.request({
          url: 'passwordRecovery:resetPassword',
          method: 'post',
          skipAuth: true,
          data: payload,
        });
        resData = res?.data?.data || res?.data;
      } else {
        const resp = await fetch('/api/passwordRecovery:resetPassword', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const json = await resp.json();
        if (!resp.ok) {
          throw new Error(json?.message || json?.errors?.[0]?.message || '密码重置失败');
        }
        resData = json?.data || json;
      }

      if (resData?.success) {
        setCurrentStep(2);
        if (onSuccess) onSuccess();
        // 2.5 秒后自动关闭弹窗
        setTimeout(() => {
          onCancel();
        }, 2500);
      } else {
        setErrorMessage(resData?.message || '重置失败');
      }
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.errors?.[0]?.message ||
        err?.message ||
        '重置密码失败，请重试';
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onCancel={onCancel}
      footer={null}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 16 }}>
          <SafetyCertificateOutlined style={{ color: '#1677ff' }} />
          <span>{t('Reset password')}</span>
        </div>
      }
      width={460}
      destroyOnClose
      centered
      bodyStyle={{ paddingTop: 16 }}
    >
      <Steps
        current={currentStep}
        size="small"
        style={{ marginBottom: 24 }}
        items={[
          { title: t('Step 1: Verify Account') },
          { title: t('Step 2: Reset Password') },
        ]}
      />

      {errorMessage && (
        <Alert
          type="error"
          message={errorMessage}
          showIcon
          closable
          onClose={() => setErrorMessage('')}
          style={{ marginBottom: 20 }}
        />
      )}

      {/* 步骤 1：输入账号 */}
      {currentStep === 0 && (
        <Form
          form={step1Form}
          layout="vertical"
          onFinish={handleSendCode}
          requiredMark={false}
          size="large"
        >
          <Form.Item
            label={t('Account (Username / Email / Phone)')}
            name="account"
            rules={[
              { required: true, message: t('Please enter your account') },
              { min: 2, message: '账号长度至少 2 位' },
            ]}
          >
            <Input
              prefix={<UserOutlined style={{ color: '#bfbfbf' }} />}
              placeholder={t('Please enter your account')}
              autoFocus
              autoComplete="username"
              onPressEnter={() => step1Form.submit()}
            />
          </Form.Item>

          <Paragraph type="secondary" style={{ fontSize: 12, marginBottom: 24, lineHeight: 1.6 }}>
            提示：核验账号成功后，系统将自动向您在企业内绑定的通知渠道（如企业微信、钉钉、邮箱或短信）发送一次性数字验证码。
          </Paragraph>

          <Form.Item style={{ marginBottom: 8 }}>
            <Button type="primary" htmlType="submit" block loading={loading} style={{ height: 42, borderRadius: 8 }}>
              {t('Get verification code')}
            </Button>
          </Form.Item>
        </Form>
      )}

      {/* 步骤 2：输入验证码与新密码 */}
      {currentStep === 1 && (
        <Form
          form={step2Form}
          layout="vertical"
          onFinish={handleResetPassword}
          requiredMark={false}
          size="large"
        >
          <div
            style={{
              padding: '10px 14px',
              backgroundColor: '#f6f8fa',
              borderRadius: 8,
              marginBottom: 18,
              fontSize: 13,
            }}
          >
            <Text type="secondary">验证账号：</Text>
            <Text strong style={{ color: '#1677ff' }}>
              {maskedAccount}
            </Text>
          </div>

          <Form.Item
            label={t('Verification code')}
            name="code"
            rules={[
              { required: true, message: t('Please enter 6-digit verification code') },
              { len: codeLength, message: `请输入 ${codeLength} 位数字验证码` },
            ]}
          >
            <Space.Compact style={{ width: '100%' }}>
              <Input
                prefix={<SafetyCertificateOutlined style={{ color: '#bfbfbf' }} />}
                placeholder={`请输入 ${codeLength} 位验证码`}
                maxLength={codeLength}
                autoFocus
                onPressEnter={() => step2Form.submit()}
              />
              <Button
                disabled={countdown > 0 || loading}
                onClick={handleResendCode}
                style={{ width: 120, height: 40 }}
              >
                {countdown > 0 ? `${countdown}s` : t('Resend')}
              </Button>
            </Space.Compact>
          </Form.Item>

          <Form.Item
            label={t('New password')}
            name="newPassword"
            rules={[
              { required: true, message: t('Please enter new password') },
              { min: 6, message: '新密码长度至少需要 6 位' },
            ]}
          >
            <Input.Password
              prefix={<LockOutlined style={{ color: '#bfbfbf' }} />}
              placeholder={t('Please enter new password')}
              autoComplete="new-password"
              onChange={(e) => setPwdValue(e.target.value)}
              onPressEnter={() => step2Form.submit()}
            />
          </Form.Item>

          {(() => {
            const strength = getPasswordStrength(pwdValue);
            if (!strength) return null;
            return (
              <div style={{ marginTop: -16, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ flex: 1, height: 4, backgroundColor: '#f0f0f0', borderRadius: 2, overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${strength.percent}%`,
                      height: '100%',
                      backgroundColor: strength.color,
                      transition: 'all 0.3s ease',
                    }}
                  />
                </div>
                <span style={{ fontSize: 12, color: strength.color, fontWeight: 500 }}>
                  {t('Password strength')}: {strength.text}
                </span>
              </div>
            );
          })()}

          <Form.Item
            label={t('Confirm new password')}
            name="confirmPassword"
            dependencies={['newPassword']}
            rules={[
              { required: true, message: t('Please confirm new password') },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('newPassword') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error(t('The two passwords do not match')));
                },
              }),
            ]}
          >
            <Input.Password
              prefix={<LockOutlined style={{ color: '#bfbfbf' }} />}
              placeholder={t('Please confirm new password')}
              autoComplete="new-password"
              onPressEnter={() => step2Form.submit()}
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 12 }}>
            <Button type="primary" htmlType="submit" block loading={loading} style={{ height: 42, borderRadius: 8 }}>
              {t('Confirm reset')}
            </Button>
          </Form.Item>

          <div style={{ textAlign: 'center' }}>
            <Button
              type="link"
              size="small"
              icon={<ArrowLeftOutlined />}
              onClick={() => {
                setCurrentStep(0);
                setErrorMessage('');
              }}
            >
              返回重新填写账号
            </Button>
          </div>
        </Form>
      )}

      {/* 步骤 3：重置成功 */}
      {currentStep === 2 && (
        <Result
          status="success"
          title={t('Password reset successfully, please login')}
          subTitle="您的密码已成功更新，稍后将自动返回登录界面。"
          extra={[
            <Button type="primary" key="login" onClick={onCancel} style={{ borderRadius: 8 }}>
              立即去登录
            </Button>,
          ]}
        />
      )}
    </Modal>
  );
};

export default PasswordRecoveryModal;
