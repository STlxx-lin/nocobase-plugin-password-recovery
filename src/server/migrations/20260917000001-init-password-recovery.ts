import { Migration } from '@nocobase/server';

export default class extends Migration {
  on = 'afterLoad';
  appVersion = '<2.3.0';

  async up() {
    const collectionsRepo = this.db.getRepository('collections');
    const fieldsRepo = this.db.getRepository('fields');

    if (!collectionsRepo || !fieldsRepo) return;

    const existing = await collectionsRepo.findOne({
      filter: { name: 'password_recovery_requests' },
    });

    if (!existing) {
      await collectionsRepo.create({
        values: {
          key: 'password_recovery_requests',
          name: 'password_recovery_requests',
          title: '密码找回请求',
          inherit: 0,
          hidden: 0,
          options: {
            origin: '@nocobase/plugin-password-recovery',
            autoGenId: true,
            titleField: 'account',
            logging: true,
            createdAt: true,
            updatedAt: true,
            createdBy: false,
            updatedBy: false,
          },
        },
      });

      const fieldList = [
        { name: 'account', type: 'string', interface: 'input', title: '请求账号' },
        { name: 'code', type: 'string', interface: 'input', title: '数字验证码' },
        { name: 'userId', type: 'integer', interface: 'integer', title: '关联用户ID' },
        { name: 'username', type: 'string', interface: 'input', title: '员工用户名' },
        { name: 'email', type: 'string', interface: 'email', title: '企业邮箱' },
        { name: 'phone', type: 'string', interface: 'phone', title: '手机号' },
        { name: 'nickname', type: 'string', interface: 'input', title: '员工姓名' },
        { name: 'status', type: 'string', interface: 'input', title: '请求状态' },
        { name: 'expiresInMinutes', type: 'integer', interface: 'integer', title: '有效分钟数' },
        { name: 'expiresAt', type: 'date', interface: 'datetime', title: '失效时间' },
        { name: 'token', type: 'string', interface: 'input', title: '会话Token' },
        { name: 'ip', type: 'string', interface: 'input', title: '客户端IP' },
      ];

      for (const f of fieldList) {
        try {
          await fieldsRepo.create({
            values: {
              key: `password_recovery_requests.${f.name}`,
              name: f.name,
              type: f.type,
              interface: f.interface,
              collectionName: 'password_recovery_requests',
              options: {
                uiSchema: {
                  type: f.type === 'integer' ? 'number' : f.type === 'date' ? 'datetime' : 'string',
                  title: f.title,
                  'x-component': f.type === 'integer' ? 'InputNumber' : f.type === 'date' ? 'DatePicker' : 'Input',
                },
              },
            },
          });
        } catch (errField) {}
      }
    }
  }
}
