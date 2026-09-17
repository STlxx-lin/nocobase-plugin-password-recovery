import { defineCollection } from '@nocobase/database';

export default defineCollection({
  name: 'password_recovery_requests',
  title: '密码找回请求',
  uiManageable: true,
  filterTargetKey: 'id',
  autoGenId: true,
  timestamps: true,
  fields: [
    {
      type: 'string',
      name: 'account',
      comment: '请求密码找回时填写的账号',
      uiSchema: {
        type: 'string',
        title: '请求账号',
        'x-component': 'Input',
      },
    },
    {
      type: 'string',
      name: 'code',
      length: 16,
      comment: '一次性动态验证码',
      uiSchema: {
        type: 'string',
        title: '数字验证码',
        'x-component': 'Input',
      },
    },
    {
      type: 'integer',
      name: 'userId',
      comment: '关联的用户系统ID',
      uiSchema: {
        type: 'number',
        title: '关联用户ID',
        'x-component': 'InputNumber',
      },
    },
    {
      type: 'string',
      name: 'username',
      comment: '员工用户名',
      uiSchema: {
        type: 'string',
        title: '员工用户名',
        'x-component': 'Input',
      },
    },
    {
      type: 'string',
      name: 'email',
      comment: '员工企业邮箱',
      uiSchema: {
        type: 'string',
        title: '企业邮箱',
        'x-component': 'Input',
      },
    },
    {
      type: 'string',
      name: 'phone',
      comment: '员工手机号',
      uiSchema: {
        type: 'string',
        title: '手机号',
        'x-component': 'Input',
      },
    },
    {
      type: 'string',
      name: 'nickname',
      comment: '员工姓名/昵称',
      uiSchema: {
        type: 'string',
        title: '员工姓名',
        'x-component': 'Input',
      },
    },
    {
      type: 'string',
      name: 'status',
      defaultValue: 'pending',
      comment: '状态: pending(待核验), verified(已核验通过), used(已重置密码), expired(已失效)',
      uiSchema: {
        type: 'string',
        title: '请求状态',
        'x-component': 'Select',
      },
    },
    {
      type: 'integer',
      name: 'expiresInMinutes',
      defaultValue: 5,
      comment: '验证码有效时间（分钟）',
      uiSchema: {
        type: 'number',
        title: '有效分钟数',
        'x-component': 'InputNumber',
      },
    },
    {
      type: 'date',
      name: 'expiresAt',
      comment: '验证码失效时间',
      uiSchema: {
        type: 'datetime',
        title: '失效时间',
        'x-component': 'DatePicker',
      },
    },
    {
      type: 'string',
      name: 'token',
      unique: true,
      length: 128,
      comment: '本次密码找回的会话唯一凭证',
      uiSchema: {
        type: 'string',
        title: '会话Token',
        'x-component': 'Input',
      },
    },
    {
      type: 'string',
      name: 'ip',
      length: 64,
      comment: '发起请求的客户端IP',
      uiSchema: {
        type: 'string',
        title: '客户端IP',
        'x-component': 'Input',
      },
    },
    {
      type: 'belongsTo',
      name: 'user',
      target: 'users',
      foreignKey: 'userId',
    },
  ],
});
