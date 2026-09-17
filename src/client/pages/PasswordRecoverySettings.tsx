import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Form,
  Input,
  InputNumber,
  Select,
  Switch,
  Button,
  message,
  Typography,
  Alert,
  Divider,
  Tag,
  Space,
  Table,
  Tabs,
  Badge,
} from 'antd';
import {
  SafetyCertificateOutlined,
  SaveOutlined,
  DatabaseOutlined,
  ReloadOutlined,
  BranchesOutlined,
  InfoCircleOutlined,
  CheckCircleOutlined,
  HistoryOutlined,
  ThunderboltOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { useAPIClient } from '@nocobase/client';

const { Title, Paragraph, Text } = Typography;

export interface PasswordRecoveryFullConfig {
  key?: string;
  enabled?: boolean;
  buttonText?: string;
  workflowKey?: string;
  codeExpiresInMinutes?: number;
  rateLimitPerMinute?: number;
  maxFailedAttempts?: number;
  codeLength?: number;
  dailyLimitPerAccount?: number;
  passwordPolicy?: string;
}

export interface PasswordRecoveryAuditLog {
  id: number;
  account: string;
  code?: string;
  userId?: number;
  username?: string;
  email?: string;
  phone?: string;
  nickname?: string;
  status: string;
  expiresInMinutes?: number;
  expiresAt?: string;
  ip?: string;
  createdAt: string;
}

export const PasswordRecoverySettings: React.FC = () => {
  const apiClient = useAPIClient();
  const [activeTab, setActiveTab] = useState<string>('settings');
  const [form] = Form.useForm();
  const [testForm] = Form.useForm();

  // 配置状态
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [tableLoading, setTableLoading] = useState<boolean>(false);
  const [tableStatus, setTableStatus] = useState<{
    name: string;
    title: string;
    ready: boolean;
    fieldsCount: number;
  }>({
    name: 'password_recovery_requests',
    title: '密码找回请求',
    ready: true,
    fieldsCount: 12,
  });

  // 审计日志状态
  const [auditLoading, setAuditLoading] = useState<boolean>(false);
  const [auditLogs, setAuditLogs] = useState<PasswordRecoveryAuditLog[]>([]);
  const [auditTotal, setAuditTotal] = useState<number>(0);
  const [auditPage, setAuditPage] = useState<number>(1);
  const [auditPageSize, setAuditPageSize] = useState<number>(10);

  // 连通性测试状态
  const [testing, setTesting] = useState<boolean>(false);

  // 1. 获取当前数据库表状态
  const fetchTableStatus = useCallback(async () => {
    try {
      if (apiClient) {
        const res = await apiClient.request({
          url: 'passwordRecovery:getCollectionStatus',
        });
        const data = res?.data?.data || res?.data;
        if (data) {
          setTableStatus({
            name: data.name || 'password_recovery_requests',
            title: data.title || '密码找回请求',
            ready: !!data.ready,
            fieldsCount: Number(data.fieldsCount) || 12,
          });
        }
      }
    } catch (e) {}
  }, [apiClient]);

  // 2. 获取配置
  const fetchConfig = useCallback(async () => {
    setLoading(true);
    try {
      let configData: PasswordRecoveryFullConfig | null = null;
      if (apiClient) {
        const res = await apiClient.request({
          url: 'passwordRecovery:getConfig',
        });
        configData = res?.data?.data || res?.data;
      }

      if (configData) {
        form.setFieldsValue({
          enabled: configData.enabled ?? true,
          buttonText: configData.buttonText || '忘记密码？',
          codeExpiresInMinutes: configData.codeExpiresInMinutes || 5,
          rateLimitPerMinute: configData.rateLimitPerMinute || 5,
          maxFailedAttempts: configData.maxFailedAttempts || 5,
          codeLength: configData.codeLength || 6,
          dailyLimitPerAccount: configData.dailyLimitPerAccount || 10,
          passwordPolicy: configData.passwordPolicy || 'standard',
        });
      }
    } catch (e) {
      message.error('加载密码找回配置失败');
    } finally {
      setLoading(false);
    }
  }, [apiClient, form]);

  // 3. 获取审计记录
  const fetchAuditLogs = useCallback(
    async (page = 1, pageSize = 10) => {
      setAuditLoading(true);
      try {
        if (apiClient) {
          const res = await apiClient.request({
            url: 'passwordRecovery:listAuditLogs',
            params: { page, pageSize },
          });
          const data = res?.data?.data || res?.data;
          if (data) {
            setAuditLogs(data.items || []);
            setAuditTotal(data.count || 0);
            setAuditPage(page);
            setAuditPageSize(pageSize);
          }
        }
      } catch (err: any) {
        message.error(err?.message || '获取审计日志失败');
      } finally {
        setAuditLoading(false);
      }
    },
    [apiClient],
  );

  useEffect(() => {
    fetchConfig();
    fetchTableStatus();
  }, [fetchConfig, fetchTableStatus]);

  useEffect(() => {
    if (activeTab === 'audit') {
      fetchAuditLogs(1, auditPageSize);
    }
  }, [activeTab, fetchAuditLogs, auditPageSize]);

  // 手动创建 / 同步插件数据库表
  const handleInitTable = async () => {
    setTableLoading(true);
    try {
      if (apiClient) {
        const res = await apiClient.request({
          url: 'passwordRecovery:initCollection',
          method: 'post',
        });
        const data = res?.data?.data || res?.data;
        message.success(data?.message || '插件数据库表创建/同步成功！');
        await fetchTableStatus();
      }
    } catch (err: any) {
      message.error(err?.message || '创建/同步数据库表失败');
    } finally {
      setTableLoading(false);
    }
  };

  // 保存配置
  const handleSave = async (values: any) => {
    setSaving(true);
    try {
      if (apiClient) {
        await apiClient.request({
          url: 'passwordRecovery:saveConfig',
          method: 'post',
          data: values,
        });
      }
      message.success('配置保存成功');
    } catch (err: any) {
      message.error(err?.message || '保存配置失败');
    } finally {
      setSaving(false);
    }
  };

  // 运行工作流测试
  const handleTestWorkflow = async (values: { account: string }) => {
    setTesting(true);
    try {
      if (apiClient) {
        const res = await apiClient.request({
          url: 'passwordRecovery:testWorkflow',
          method: 'post',
          data: values,
        });
        const data = res?.data?.data || res?.data;
        message.success(data?.message || '模拟触发工作流成功');
      }
    } catch (err: any) {
      message.error(err?.message || '测试触发失败');
    } finally {
      setTesting(false);
    }
  };

  const variableDataSource = [
    { key: '1', param: '{{$context.data.code}}', name: 'code', type: 'String', desc: '系统生成的动态安全数字验证码（如 839201）' },
    { key: '2', param: '{{$context.data.account}}', name: 'account', type: 'String', desc: '员工在登录页输入的系统账号标识' },
    { key: '3', param: '{{$context.data.email}}', name: 'email', type: 'String', desc: '员工在系统绑定的企业电子邮箱（用于邮件节点）' },
    { key: '4', param: '{{$context.data.phone}}', name: 'phone', type: 'String', desc: '员工在系统绑定的手机号码（用于短信/企微匹配）' },
    { key: '5', param: '{{$context.data.username}}', name: 'username', type: 'String', desc: '匹配到的系统用户名' },
    { key: '6', param: '{{$context.data.nickname}}', name: 'nickname', type: 'String', desc: '员工姓名/用户昵称' },
    { key: '7', param: '{{$context.data.expiresInMinutes}}', name: 'expiresInMinutes', type: 'Number', desc: '验证码有效分钟数' },
    { key: '8', param: '{{$context.data.expiresAt}}', name: 'expiresAt', type: 'DateTime', desc: '验证码失效截止时间' },
    { key: '9', param: '{{$context.data.ip}}', name: 'ip', type: 'String', desc: '发起找回请求的客户端 IP 地址' },
  ];

  const variableColumns = [
    { title: '工作流变量', dataIndex: 'param', key: 'param', render: (text: string) => <Tag color="blue">{text}</Tag> },
    { title: '数据表字段', dataIndex: 'name', key: 'name', render: (text: string) => <Text code>{text}</Text> },
    { title: '类型', dataIndex: 'type', key: 'type', width: 100 },
    { title: '说明与建议用途', dataIndex: 'desc', key: 'desc' },
  ];

  const auditColumns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 70 },
    {
      title: '找回账号',
      dataIndex: 'account',
      key: 'account',
      render: (acc: string, record: any) => (
        <div>
          <Text strong>{acc}</Text>
          {record.nickname && <Text type="secondary" style={{ marginLeft: 6 }}>({record.nickname})</Text>}
        </div>
      ),
    },
    {
      title: '通知信息',
      key: 'contact',
      render: (_: any, record: any) => (
        <span style={{ fontSize: 13 }}>
          {record.email || record.phone || '-'}
        </span>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => {
        if (status === 'used') return <Tag color="success">已重置</Tag>;
        if (status === 'pending') return <Tag color="processing">待验证</Tag>;
        if (status === 'expired') return <Tag color="default">已过期</Tag>;
        if (status === 'test') return <Tag color="warning">模拟测试</Tag>;
        return <Tag>{status}</Tag>;
      },
    },
    { title: '客户端 IP', dataIndex: 'ip', key: 'ip', width: 130 },
    {
      title: '审计时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (val: string) => (val ? new Date(val).toLocaleString() : '-'),
    },
  ];

  return (
    <div style={{ maxWidth: 1000, margin: '24px auto', padding: '0 16px' }}>
      <Card
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <SafetyCertificateOutlined style={{ color: '#1677ff', fontSize: 20 }} />
            <span style={{ fontSize: 18, fontWeight: 600 }}>企业密码找回管理</span>
          </div>
        }
        loading={loading}
        bordered={false}
        style={{ borderRadius: 12, boxShadow: '0 4px 16px rgba(0,0,0,0.05)' }}
      >
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: 'settings',
              label: (
                <span>
                  <SettingOutlined />
                  基础配置
                </span>
              ),
              children: (
                <div>
                  <Alert
                    type="info"
                    showIcon
                    message="功能说明"
                    description="该插件允许企业员工在登录页面自助找回密码。员工输入账号后，系统核验其真实性，自动在【密码找回请求】表中插入记录并触发所绑定的工作流将验证码推送至企业微信、钉钉、邮箱或短信通道。重置时会自动比对新旧密码，防止设置与当前相同的密码。"
                    style={{ marginBottom: 24, borderRadius: 8 }}
                  />

                  <Form form={form} layout="vertical" onFinish={handleSave}>
                    <Form.Item
                      label="启用密码找回功能"
                      name="enabled"
                      valuePropName="checked"
                      extra="关闭后，登录页将隐藏找回密码入口，并拒绝未登录找回请求。"
                    >
                      <Switch />
                    </Form.Item>

                    <Form.Item
                      label="登录页按钮文案"
                      name="buttonText"
                      rules={[{ required: true, message: '请输入按钮文案' }]}
                      extra="显示在登录页面的文字，例如“忘记密码？”或“企业密码找回”。"
                    >
                      <Input style={{ maxWidth: 360 }} />
                    </Form.Item>

                    {/* 插件数据库表卡片 */}
                    <div
                      style={{
                        backgroundColor: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: 8,
                        padding: '18px 20px',
                        marginBottom: 24,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                            <DatabaseOutlined style={{ color: '#1677ff', fontSize: 16 }} />
                            <Text strong style={{ fontSize: 15 }}>插件数据库表：</Text>
                            <Text code style={{ fontSize: 14 }}>{tableStatus.title} ({tableStatus.name})</Text>
                            {tableStatus.ready ? (
                              <Tag icon={<CheckCircleOutlined />} color="success">
                                已就绪 ({tableStatus.fieldsCount} 个字段)
                              </Tag>
                            ) : (
                              <Tag color="warning">待初始化</Tag>
                            )}
                          </div>
                          <Paragraph type="secondary" style={{ margin: 0, fontSize: 13, lineHeight: 1.6 }}>
                            已支持【数据表事件驱动】：无需手动绑定 Workflow Key，当员工发起找回密码时，系统自动向该表写入记录，并自动触发工作流。
                          </Paragraph>
                        </div>

                        <Space>
                          <Button
                            type="primary"
                            ghost
                            icon={<ReloadOutlined />}
                            loading={tableLoading}
                            onClick={handleInitTable}
                            style={{ borderRadius: 6 }}
                          >
                            创建 / 同步插件数据库表
                          </Button>
                          <Button
                            icon={<BranchesOutlined />}
                            onClick={() => window.open('/admin/settings/workflow', '_blank')}
                            style={{ borderRadius: 6 }}
                          >
                            前往工作流配置
                          </Button>
                        </Space>
                      </div>
                    </div>

                    <Divider orientation="left">安全与策略配置</Divider>

                    <Space size={24} wrap>
                      <Form.Item
                        label="验证码位数"
                        name="codeLength"
                        rules={[{ required: true }]}
                      >
                        <InputNumber min={4} max={8} style={{ width: 140 }} />
                      </Form.Item>

                      <Form.Item
                        label="验证码有效期（分钟）"
                        name="codeExpiresInMinutes"
                        rules={[{ required: true }]}
                      >
                        <InputNumber min={1} max={60} style={{ width: 140 }} />
                      </Form.Item>

                      <Form.Item
                        label="最大输错尝试次数"
                        name="maxFailedAttempts"
                        rules={[{ required: true }]}
                      >
                        <InputNumber min={1} max={10} style={{ width: 140 }} />
                      </Form.Item>

                      <Form.Item
                        label="每分钟请求限频"
                        name="rateLimitPerMinute"
                        rules={[{ required: true }]}
                      >
                        <InputNumber min={1} max={60} style={{ width: 140 }} />
                      </Form.Item>

                      <Form.Item
                        label="单账号每日找回限额"
                        name="dailyLimitPerAccount"
                        rules={[{ required: true }]}
                        tooltip="单账号 24 小时内最大找回次数，防止针对特定员工账号的恶意短信/邮件轰炸"
                      >
                        <InputNumber min={1} max={100} style={{ width: 150 }} />
                      </Form.Item>

                      <Form.Item
                        label="重置密码复杂度策略"
                        name="passwordPolicy"
                        rules={[{ required: true }]}
                        tooltip="重置新密码时的复杂度校验规则"
                      >
                        <Select style={{ width: 220 }}>
                          <Select.Option value="standard">标准（必须包含字母与数字）</Select.Option>
                          <Select.Option value="simple">简单（仅要求长度不少于 6 位）</Select.Option>
                        </Select>
                      </Form.Item>
                    </Space>

                    <Form.Item style={{ marginTop: 24 }}>
                      <Button
                        type="primary"
                        htmlType="submit"
                        icon={<SaveOutlined />}
                        loading={saving}
                        style={{ height: 40, padding: '0 24px', borderRadius: 8 }}
                      >
                        保存设置
                      </Button>
                    </Form.Item>
                  </Form>

                  <Divider style={{ margin: '32px 0 20px 0' }} />

                  <Title level={5} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <InfoCircleOutlined style={{ color: '#1677ff' }} />
                    <span>工作流绑定与参数映射说明</span>
                  </Title>
                  <Paragraph type="secondary">
                    在 NocoBase 后台【工作流】中新建工作流：触发器类型选择<strong>“数据表事件”</strong>，数据表选择<strong>“密码找回请求 (password_recovery_requests)”</strong>，触发时机选择<strong>“创建数据后”</strong>。在后续节点中可直接使用以下字段变量：
                  </Paragraph>
                  <Table
                    dataSource={variableDataSource}
                    columns={variableColumns}
                    pagination={false}
                    size="small"
                    bordered
                  />
                </div>
              ),
            },
            {
              key: 'audit',
              label: (
                <span>
                  <HistoryOutlined />
                  审计日志
                  {auditTotal > 0 && <Badge count={auditTotal} overflowCount={999} style={{ marginLeft: 6, backgroundColor: '#52c41a' }} />}
                </span>
              ),
              children: (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <Paragraph type="secondary" style={{ margin: 0 }}>
                      实时审计系统最近发起的密码找回历史记录，可追踪申请员工、IP 来源、触发时间与验证状态。
                    </Paragraph>
                    <Button
                      icon={<ReloadOutlined />}
                      onClick={() => fetchAuditLogs(auditPage, auditPageSize)}
                      loading={auditLoading}
                    >
                      刷新日志
                    </Button>
                  </div>
                  <Table
                    rowKey="id"
                    columns={auditColumns}
                    dataSource={auditLogs}
                    loading={auditLoading}
                    pagination={{
                      current: auditPage,
                      pageSize: auditPageSize,
                      total: auditTotal,
                      showSizeChanger: true,
                      pageSizeOptions: ['10', '20', '50'],
                      onChange: (page, size) => fetchAuditLogs(page, size),
                    }}
                    bordered
                    size="middle"
                  />
                </div>
              ),
            },
            {
              key: 'diagnostics',
              label: (
                <span>
                  <ThunderboltOutlined />
                  连通性测试诊断
                </span>
              ),
              children: (
                <div style={{ maxWidth: 600 }}>
                  <Alert
                    type="warning"
                    showIcon
                    message="连通性测试诊断"
                    description="在此输入任意测试账号，点击模拟触发后，系统将自动向 password_recovery_requests 表写入一条带有 status: 'test' 的模拟请求，并立即触发对应的数据表工作流事件。您可以通过观察通知通道（企微/邮件/钉钉）是否收到消息来验证工作流配置是否正确，无需反复退出当前管理员账号。"
                    style={{ marginBottom: 24, borderRadius: 8 }}
                  />

                  <Form form={testForm} layout="vertical" onFinish={handleTestWorkflow} initialValues={{ account: 'admin' }}>
                    <Form.Item
                      label="测试账号"
                      name="account"
                      rules={[{ required: true, message: '请输入测试账号' }]}
                      extra="将作为模拟参数传入工作流中（生成 6 位模拟验证码 888666）"
                    >
                      <Input placeholder="输入测试用户名或工号" style={{ maxWidth: 360 }} />
                    </Form.Item>

                    <Form.Item>
                      <Button
                        type="primary"
                        htmlType="submit"
                        icon={<ThunderboltOutlined />}
                        loading={testing}
                        style={{ height: 40, borderRadius: 8 }}
                      >
                        模拟触发测试
                      </Button>
                    </Form.Item>
                  </Form>
                </div>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
};

export default PasswordRecoverySettings;
