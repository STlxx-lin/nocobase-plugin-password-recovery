import { defineCollection } from '@nocobase/database';

export default defineCollection({
  name: 'password_recovery_records',
  title: 'Password Recovery Records',
  autoGenId: true,
  timestamps: true,
  fields: [
    {
      type: 'integer',
      name: 'userId',
      comment: '关联的用户ID',
    },
    {
      type: 'string',
      name: 'account',
      comment: '请求密码找回时输入的账号标识',
    },
    {
      type: 'string',
      name: 'code',
      length: 16,
      comment: '一次性安全数字验证码',
    },
    {
      type: 'string',
      name: 'token',
      unique: true,
      length: 128,
      comment: '本次密码找回的会话唯一凭证UUID',
    },
    {
      type: 'string',
      name: 'status',
      defaultValue: 'pending',
      length: 32,
      comment: '状态: pending(待核验), verified(已核验通过), used(已完成重置), expired(已失效)',
    },
    {
      type: 'integer',
      name: 'failedAttempts',
      defaultValue: 0,
      comment: '验证码输错重试次数',
    },
    {
      type: 'date',
      name: 'expiresAt',
      comment: '验证码有效截止时间',
    },
    {
      type: 'string',
      name: 'ip',
      length: 64,
      comment: '发起找回请求的客户端IP',
    },
    {
      type: 'belongsTo',
      name: 'user',
      target: 'users',
      foreignKey: 'userId',
    },
  ],
});
