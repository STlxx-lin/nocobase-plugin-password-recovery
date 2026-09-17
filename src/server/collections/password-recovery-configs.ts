import { defineCollection } from '@nocobase/database';

export default defineCollection({
  name: 'password_recovery_configs',
  title: 'Password Recovery Configs',
  autoGenId: true,
  timestamps: true,
  fields: [
    {
      type: 'string',
      name: 'key',
      unique: true,
      defaultValue: 'default',
      comment: '配置唯一标识',
    },
    {
      type: 'boolean',
      name: 'enabled',
      defaultValue: true,
      comment: '是否启用密码找回功能',
    },
    {
      type: 'string',
      name: 'buttonText',
      defaultValue: '忘记密码？',
      comment: '登录界面入口按钮展示文案',
    },
    {
      type: 'string',
      name: 'workflowKey',
      comment: '账号验证通过后触发的目标工作流标识 (key 或 id)',
    },
    {
      type: 'integer',
      name: 'codeExpiresInMinutes',
      defaultValue: 5,
      comment: '验证码有效时间（分钟）',
    },
    {
      type: 'integer',
      name: 'rateLimitPerMinute',
      defaultValue: 5,
      comment: '单IP/单账号每分钟允许请求的最大频次',
    },
    {
      type: 'integer',
      name: 'maxFailedAttempts',
      defaultValue: 5,
      comment: '单次会话验证码允许输错的最大重试次数',
    },
    {
      type: 'integer',
      name: 'codeLength',
      defaultValue: 6,
      comment: '验证码位数（默认为6位纯数字）',
    },
    {
      type: 'integer',
      name: 'dailyLimitPerAccount',
      defaultValue: 10,
      comment: '单个账号每日允许发起找回密码的最大次数（防轰炸）',
    },
    {
      type: 'string',
      name: 'passwordPolicy',
      defaultValue: 'standard',
      comment: '新密码复杂度策略（standard: 必须含字母和数字, simple: 仅要求长度>=6）',
    },
  ],
});
