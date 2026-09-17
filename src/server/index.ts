import { Plugin } from '@nocobase/server';
import path from 'path';
import { checkAccountAndSendCodeAction } from './actions/check-account-and-send-code';
import { resetPasswordAction } from './actions/reset-password';

export const DEFAULT_PASSWORD_RECOVERY_CONFIG = {
  key: 'default',
  enabled: true,
  buttonText: '忘记密码？',
  workflowKey: '',
  codeExpiresInMinutes: 5,
  rateLimitPerMinute: 5,
  maxFailedAttempts: 5,
  codeLength: 6,
  dailyLimitPerAccount: 10,
  passwordPolicy: 'standard',
};

export class PluginPasswordRecoveryServer extends Plugin {
  private cleanupTimer: any = null;

  async afterAdd() {}

  async beforeLoad() {
    this.db.import({
      directory: path.resolve(__dirname, 'collections'),
    });
  }

  // 自动确保物理数据表同步建立，并在 Collection Manager (collections & fields 表) 中自动注册与字段自愈
  async ensureWorkflowCollection() {
    try {
      // 1. 物理表强制同步：确保底层数据库（MySQL / PostgreSQL / SQLite）真实建立这 3 张物理表
      const collectionNames = [
        'password_recovery_requests',
        'password_recovery_records',
        'password_recovery_configs',
      ];
      for (const name of collectionNames) {
        try {
          const col = this.db.getCollection(name);
          if (col) {
            await col.sync({ alter: { drop: false } });
          }
        } catch (syncErr: any) {
          this.app.logger?.warn?.(`[PasswordRecovery] 同步物理表 ${name} 提示: ${syncErr.message}`);
        }
      }

        // 2. 检查 Collection Manager 中是否存在表以及现有字段数量
        const collectionsRepo = this.db.getRepository('collections') as any;
        const fieldsRepo = this.db.getRepository('fields') as any;

        if (collectionsRepo) {
          let existingCol = await collectionsRepo.findOne({
            filter: { name: 'password_recovery_requests' },
          });

          // 如果旧表 options 中残留了 uiManageable: true，主动更新为 false，彻底消除 "Cannot remove a UI manageable collection" 异常
          if (existingCol?.options?.uiManageable) {
            try {
              const currentOptions = { ...(existingCol.options || {}), uiManageable: false };
              await collectionsRepo.update({
                filter: { name: 'password_recovery_requests' },
                values: { options: currentOptions },
              });
              this.app.logger?.info?.(
                `[PasswordRecovery] 已安全解除 'password_recovery_requests' 的 uiManageable 锁定`,
              );
            } catch (uErr: any) {}
          }

          // 优先使用官方 db2cm 进行标准关联同步（仅在未注册时执行，绝不执行危险的 destroy）
          if (!existingCol && typeof collectionsRepo.db2cm === 'function') {
            try {
              await collectionsRepo.db2cm('password_recovery_requests');
              this.app.logger?.info?.(
                `[PasswordRecovery] db2cm 自动同步 'password_recovery_requests' 到 Collection Manager 成功`,
              );
            } catch (db2cmErr: any) {
              this.app.logger?.warn?.(`[PasswordRecovery] db2cm 自动同步提示: ${db2cmErr.message}`);
            }
          }

          // 重新获取或创建 collection 记录
          existingCol = await collectionsRepo.findOne({
            filter: { name: 'password_recovery_requests' },
          });

          if (!existingCol) {
            existingCol = await collectionsRepo.create({
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
                  uiManageable: false,
                },
              },
            });
          }

          // 3. 字段级别强制核验与补齐（含主键 id 在内的 13 个关键字段）
          if (fieldsRepo) {
            const fieldList = [
              {
                name: 'id',
                type: 'bigInt',
                interface: 'integer',
                title: 'ID',
                uiSchema: { type: 'number', title: 'ID', 'x-component': 'InputNumber', 'x-read-pretty': true },
              },
              {
                name: 'account',
                type: 'string',
                interface: 'input',
                title: '请求账号',
                uiSchema: { type: 'string', title: '请求账号', 'x-component': 'Input' },
              },
              {
                name: 'code',
                type: 'string',
                interface: 'input',
                title: '数字验证码',
                uiSchema: { type: 'string', title: '数字验证码', 'x-component': 'Input' },
              },
              {
                name: 'userId',
                type: 'integer',
                interface: 'integer',
                title: '关联用户ID',
                uiSchema: { type: 'number', title: '关联用户ID', 'x-component': 'InputNumber' },
              },
              {
                name: 'username',
                type: 'string',
                interface: 'input',
                title: '员工用户名',
                uiSchema: { type: 'string', title: '员工用户名', 'x-component': 'Input' },
              },
              {
                name: 'email',
                type: 'string',
                interface: 'email',
                title: '企业邮箱',
                uiSchema: { type: 'string', title: '企业邮箱', 'x-component': 'Input' },
              },
              {
                name: 'phone',
                type: 'string',
                interface: 'phone',
                title: '手机号',
                uiSchema: { type: 'string', title: '手机号', 'x-component': 'Input' },
              },
              {
                name: 'nickname',
                type: 'string',
                interface: 'input',
                title: '员工姓名',
                uiSchema: { type: 'string', title: '员工姓名', 'x-component': 'Input' },
              },
              {
                name: 'status',
                type: 'string',
                interface: 'select',
                title: '请求状态',
                uiSchema: {
                  type: 'string',
                  title: '请求状态',
                  'x-component': 'Select',
                  enum: [
                    { label: '待核验', value: 'pending' },
                    { label: '已重置', value: 'used' },
                    { label: '已过期', value: 'expired' },
                    { label: '模拟测试', value: 'test' },
                  ],
                },
              },
              {
                name: 'expiresInMinutes',
                type: 'integer',
                interface: 'integer',
                title: '有效分钟数',
                uiSchema: { type: 'number', title: '有效分钟数', 'x-component': 'InputNumber' },
              },
              {
                name: 'expiresAt',
                type: 'date',
                interface: 'datetime',
                title: '失效时间',
                uiSchema: { type: 'datetime', title: '失效时间', 'x-component': 'DatePicker' },
              },
              {
                name: 'token',
                type: 'string',
                interface: 'input',
                title: '会话Token',
                uiSchema: { type: 'string', title: '会话Token', 'x-component': 'Input' },
              },
              {
                name: 'ip',
                type: 'string',
                interface: 'input',
                title: '客户端IP',
                uiSchema: { type: 'string', title: '客户端IP', 'x-component': 'Input' },
              },
            ];

            let addedCount = 0;
            for (let i = 0; i < fieldList.length; i++) {
              const f = fieldList[i];
              try {
                const hasField = await fieldsRepo.findOne({
                  filter: {
                    collectionName: 'password_recovery_requests',
                    name: f.name,
                  },
                });

                if (!hasField) {
                  const randomKey = `prr_${f.name}_${Math.random().toString(36).substring(2, 9)}`;
                  await fieldsRepo.create({
                    values: {
                      key: randomKey,
                      name: f.name,
                      type: f.type,
                      interface: f.interface,
                      collectionName: 'password_recovery_requests',
                      sort: i + 1,
                      uiSchema: f.uiSchema,
                      options: {
                        uiSchema: f.uiSchema,
                        title: f.title,
                      },
                    },
                  });
                  addedCount++;
                } else {
                  // 原地无损补齐 interface 与 uiSchema
                  const updateValues: any = {};
                  if (!hasField.interface && f.interface) {
                    updateValues.interface = f.interface;
                  }
                  if (!hasField.uiSchema && f.uiSchema) {
                    updateValues.uiSchema = f.uiSchema;
                  }
                  if (Object.keys(updateValues).length > 0) {
                    await fieldsRepo.update({
                      filter: { key: hasField.key },
                      values: updateValues,
                    });
                  }
                }
              } catch (errField: any) {
                this.app.logger?.warn?.(
                  `[PasswordRecovery] 注册字段 ${f.name} 提示: ${errField.message}`,
                );
              }
            }

            const finalCount = await fieldsRepo.count({
              filter: { collectionName: 'password_recovery_requests' },
            });

            this.app.logger?.info?.(
              `[PasswordRecovery] 成功确保 'password_recovery_requests' 表就绪，当前 Collection Manager 注册字段数: ${finalCount} (本次补齐: ${addedCount})`,
            );
          }
        }
    } catch (err: any) {
      this.app.logger?.error?.(`[PasswordRecovery] 表初始化与字段自愈异常: ${err.message}`);
    }
  }

  async install() {
    await this.ensureWorkflowCollection();

    try {
      const repo = this.db.getRepository('password_recovery_configs');
      if (repo) {
        const existing = await repo.findOne({ filter: { key: 'default' } });
        if (!existing) {
          await repo.create({ values: DEFAULT_PASSWORD_RECOVERY_CONFIG });
        }
      }
    } catch (err: any) {
      this.app.logger?.warn?.(`[PasswordRecovery] Failed to seed default configuration: ${err.message}`);
    }
  }

  async load() {
    // 注册 passwordRecovery REST 资源及其操作
    this.app.resource({
      name: 'passwordRecovery',
      actions: {
        // 1. 公开前台配置获取（未登录可用）
        getPublicConfig: async (ctx, next) => {
          let record: any = null;
          try {
            const repo = ctx.db.getRepository('password_recovery_configs');
            if (repo) {
              record = await repo.findOne({ filter: { key: 'default' } });
            }
          } catch (e) {}

          const data = (record?.toJSON ? record.toJSON() : record) || DEFAULT_PASSWORD_RECOVERY_CONFIG;
          ctx.body = {
            enabled: data.enabled ?? true,
            buttonText: data.buttonText || '忘记密码？',
            codeLength: data.codeLength || 6,
            codeExpiresInMinutes: data.codeExpiresInMinutes || 5,
          };
          await next();
        },

        // 2. 校验账号并触发工作流发送验证码（公开接口）
        checkAccountAndSendCode: checkAccountAndSendCodeAction,

        // 3. 校验验证码并完成重置密码（公开接口，带新旧密码比对）
        resetPassword: resetPasswordAction,

        // 4. 管理后台获取完整配置（需管理员权限）
        getConfig: async (ctx, next) => {
          let record: any = null;
          try {
            const repo = ctx.db.getRepository('password_recovery_configs');
            if (repo) {
              record = await repo.findOne({ filter: { key: 'default' } });
            }
          } catch (e) {}

          const data = (record?.toJSON ? record.toJSON() : record) || DEFAULT_PASSWORD_RECOVERY_CONFIG;
          ctx.body = data;
          await next();
        },

        // 5. 管理后台保存配置（需管理员权限）
        saveConfig: async (ctx, next) => {
          const values = ctx.action?.params?.values || ctx.request?.body || {};
          const repo = ctx.db.getRepository('password_recovery_configs');
          let record: any = null;

          if (repo) {
            const existing = await repo.findOne({ filter: { key: 'default' } });
            if (!existing) {
              record = await repo.create({
                values: { ...DEFAULT_PASSWORD_RECOVERY_CONFIG, ...values, key: 'default' },
              });
            } else {
              await repo.update({
                filter: { key: 'default' },
                values: {
                  enabled: values.enabled,
                  buttonText: values.buttonText,
                  workflowKey: values.workflowKey,
                  codeExpiresInMinutes: Number(values.codeExpiresInMinutes) || 5,
                  rateLimitPerMinute: Number(values.rateLimitPerMinute) || 5,
                  maxFailedAttempts: Number(values.maxFailedAttempts) || 5,
                  codeLength: Number(values.codeLength) || 6,
                  dailyLimitPerAccount: Number(values.dailyLimitPerAccount) || 10,
                  passwordPolicy: values.passwordPolicy || 'standard',
                },
              });
              record = await repo.findOne({ filter: { key: 'default' } });
            }
          }

          ctx.body = (record?.toJSON ? record.toJSON() : record) || {
            ...DEFAULT_PASSWORD_RECOVERY_CONFIG,
            ...values,
          };
          await next();
        },

        // 6. 管理后台手动初始化/同步插件数据库表
        initCollection: async (ctx, next) => {
          await this.ensureWorkflowCollection();
          const colRepo = ctx.db.getRepository('collections');
          const fieldsRepo = ctx.db.getRepository('fields');
          const col = await colRepo.findOne({ filter: { name: 'password_recovery_requests' } });
          const count = (await fieldsRepo?.count?.({ filter: { collectionName: 'password_recovery_requests' } })) || 0;

          ctx.body = {
            success: true,
            message: `插件数据库表与 ${count} 个字段已成功就绪！`,
            collection: {
              name: 'password_recovery_requests',
              title: col?.title || '密码找回请求',
              fieldsCount: count,
              ready: !!col && count > 0,
            },
          };
          await next();
        },

        // 7. 管理后台检查插件数据库表状态
        getCollectionStatus: async (ctx, next) => {
          const colRepo = ctx.db.getRepository('collections');
          const fieldsRepo = ctx.db.getRepository('fields');
          let col: any = null;
          let count = 0;
          try {
            col = await colRepo.findOne({ filter: { name: 'password_recovery_requests' } });
            count = (await fieldsRepo?.count?.({ filter: { collectionName: 'password_recovery_requests' } })) || 0;
          } catch (e) {}

          ctx.body = {
            name: 'password_recovery_requests',
            title: col?.title || '密码找回请求',
            ready: !!col && count > 0,
            fieldsCount: count,
          };
          await next();
        },

        // 8. 管理后台获取找回请求审计列表（支持分页与倒序）
        listAuditLogs: async (ctx, next) => {
          const requestsRepo = ctx.db.getRepository('password_recovery_requests');
          const page = Math.max(1, Number(ctx.action?.params?.page || ctx.query?.page || 1));
          const pageSize = Math.min(100, Math.max(1, Number(ctx.action?.params?.pageSize || ctx.query?.pageSize || 15)));

          let rows: any[] = [];
          let count = 0;
          if (requestsRepo) {
            try {
              [rows, count] = await requestsRepo.findAndCount({
                sort: ['-createdAt'],
                page,
                pageSize,
              });
            } catch (err: any) {
              ctx.app.logger?.warn?.(`[PasswordRecovery] 查询审计列表异常: ${err.message}`);
            }
          }

          ctx.body = {
            items: rows,
            count,
            page,
            pageSize,
          };
          await next();
        },

        // 9. 管理后台测试工作流触发（模拟数据写入 password_recovery_requests 表）
        testWorkflow: async (ctx, next) => {
          const body = ctx.action?.params?.values || ctx.request?.body || {};
          const testAccount = String(body.account || 'admin').trim();
          const requestsRepo = ctx.db.getRepository('password_recovery_requests');

          if (!requestsRepo) {
            ctx.throw(500, '密码找回数据表未初始化，请先点击【创建/同步插件数据库表】');
          }

          const mockCode = '888666';
          const now = new Date();
          const testRecord = await requestsRepo.create({
            values: {
              account: testAccount,
              code: mockCode,
              userId: ctx.state?.currentUser?.id || 1,
              username: testAccount,
              email: `${testAccount}@example.com`,
              phone: '13800138000',
              nickname: '测试员工',
              status: 'test',
              expiresInMinutes: 5,
              expiresAt: new Date(now.getTime() + 5 * 60 * 1000),
              token: 'mock-test-token-' + Date.now(),
              ip: String(ctx.ip || '127.0.0.1'),
            },
          });

          // 若配置了 workflowKey，双重触发确保普通工作流也能接收到完整数据
          try {
            const configRepo = ctx.db.getRepository('password_recovery_configs');
            const cfg = await configRepo?.findOne?.({ filter: { key: 'default' } });
            if (cfg?.workflowKey) {
              const workflowPlugin: any = ctx.app.getPlugin('@nocobase/plugin-workflow');
              if (workflowPlugin) {
                const workflowRepo = ctx.db.getRepository('workflows');
                const targetWf = await workflowRepo.findOne({
                  filter: {
                    $or: [{ key: String(cfg.workflowKey) }, { id: String(cfg.workflowKey) }],
                    enabled: true,
                  },
                });
                if (targetWf && typeof workflowPlugin.trigger === 'function') {
                  await workflowPlugin.trigger(targetWf, {
                    data: testRecord?.toJSON ? testRecord.toJSON() : testRecord,
                  });
                }
              }
            }
          } catch (wfErr: any) {}

          ctx.body = {
            success: true,
            message: `已成功向 password_recovery_requests 写入测试记录（账号：${testAccount}，验证码：${mockCode}），已触发工作流事件`,
            data: testRecord,
          };
          await next();
        },
      },
    });

    // 开放公开访问权限（登录前调用）
    this.app.acl.allow('passwordRecovery', ['getPublicConfig', 'checkAccountAndSendCode', 'resetPassword'], 'public');

    // 开放管理员配置权限
    this.app.acl.allow(
      'passwordRecovery',
      [
        'getConfig',
        'saveConfig',
        'initCollection',
        'getCollectionStatus',
        'listAuditLogs',
        'testWorkflow',
      ],
      'allowConfigure',
    );

    // 注册系统权限代码片段
    const pluginName = this.options?.name || this.name || 'password-recovery';
    this.app.acl.registerSnippet({
      name: `pm.${pluginName}`,
      actions: [
        'passwordRecovery:getConfig',
        'passwordRecovery:saveConfig',
        'passwordRecovery:initCollection',
        'passwordRecovery:getCollectionStatus',
        'passwordRecovery:listAuditLogs',
        'passwordRecovery:testWorkflow',
      ],
    });
  }

  // 历史过期与失效记录定时清理（定期数据治理）
  private async cleanupExpiredRecords() {
    try {
      const recordsRepo = this.db.getRepository('password_recovery_records');
      const requestsRepo = this.db.getRepository('password_recovery_requests');
      const retentionDays = 7; // 保留最近 7 天的记录
      const threshold = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

      if (recordsRepo) {
        await recordsRepo.destroy({
          filter: {
            createdAt: { $lt: threshold },
            status: ['used', 'expired'],
          },
        });
      }

      if (requestsRepo) {
        await requestsRepo.destroy({
          filter: {
            createdAt: { $lt: threshold },
            status: ['used', 'expired', 'test'],
          },
        });
      }
    } catch (e: any) {
      this.app.logger?.warn?.(`[PasswordRecovery] 定期清理过期历史记录异常: ${e.message}`);
    }
  }

  async afterEnable() {
    // 每次启用插件时，确保底层物理表和 Collection Manager 元数据完全就绪
    await this.ensureWorkflowCollection();
    // 立即运行一次历史数据清理
    await this.cleanupExpiredRecords();
    // 建立 12 小时间隔定时调度清理
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredRecords();
    }, 12 * 60 * 60 * 1000);
  }

  async afterDisable() {
    // 禁用时清理定时器句柄，防止内存泄露
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }
}

export default PluginPasswordRecoveryServer;
