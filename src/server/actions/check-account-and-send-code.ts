import { Context } from '@nocobase/actions';
import crypto from 'crypto';

// 内存速率限制器（防止短时间内高频暴力请求）
class RequestRateLimiter {
  private cache = new Map<string, number[]>();
  private readonly windowMs = 60000; // 1 分钟窗口

  public isAllowed(key: string, limit: number): boolean {
    const now = Date.now();
    const list = (this.cache.get(key) || []).filter((t) => now - t < this.windowMs);
    if (list.length >= limit) {
      return false;
    }
    list.push(now);
    this.cache.set(key, list);
    return true;
  }
}

const rateLimiter = new RequestRateLimiter();

// 账号脱敏工具函数
export function maskAccountString(val: string): string {
  if (!val || typeof val !== 'string') return '';
  // 邮箱脱敏：te***st@domain.com
  if (val.includes('@')) {
    const [name, domain] = val.split('@');
    if (name.length <= 2) return `${name.charAt(0)}***@${domain}`;
    return `${name.slice(0, 2)}***${name.slice(-1)}@${domain}`;
  }
  // 手机号脱敏：138****1234
  if (/^1[3-9]\d{9}$/.test(val)) {
    return `${val.slice(0, 3)}****${val.slice(7)}`;
  }
  // 普通用户名：保留首尾字符
  if (val.length <= 2) return `${val.charAt(0)}*`;
  return `${val.slice(0, 1)}***${val.slice(-1)}`;
}

export async function checkAccountAndSendCodeAction(ctx: Context, next: () => Promise<any>) {
  const clientIp = String(ctx.ip || (ctx.req && ctx.req.socket && ctx.req.socket.remoteAddress) || 'unknown');
  const bodyData = ctx.action?.params?.values || ctx.request?.body || {};
  const account = String(bodyData.account || '').trim();

  if (!account) {
    ctx.throw(400, '请输入需要找回密码的账号（用户名/邮箱/手机号）');
  }

  const db = ctx.db;
  const configRepo = db.getRepository('password_recovery_configs');
  const config = (await configRepo.findOne({ filter: { key: 'default' } })) || {
    enabled: true,
    workflowKey: '',
    codeExpiresInMinutes: 5,
    rateLimitPerMinute: 5,
    dailyLimitPerAccount: 10,
    codeLength: 6,
    passwordPolicy: 'standard',
  };

  if (!config.enabled) {
    ctx.throw(403, '系统暂未开启自助找回密码功能，请联系系统管理员');
  }

  // 1. 频次限流保护（单 IP 与单账号双维度）
  const limit = Number(config.rateLimitPerMinute) || 5;
  if (!rateLimiter.isAllowed(clientIp, limit) || !rateLimiter.isAllowed(`acc:${account}`, limit)) {
    ctx.status = 429;
    ctx.body = {
      success: false,
      message: '请求过于频繁，请稍后再试（Rate limit exceeded）',
    };
    return;
  }

  // 2. 检查 users 表中账号是否存在
  const userCol = db.getCollection('users');
  const userRepo = db.getRepository('users');
  const availableFields = userCol.fields;
  const orConditions: any[] = [];

  if (availableFields.has('username')) {
    orConditions.push({ username: account });
  }
  if (availableFields.has('email')) {
    orConditions.push({ email: account });
  }
  if (availableFields.has('phone')) {
    orConditions.push({ phone: account });
  }

  const targetUser = await userRepo.findOne({
    filter: {
      $or: orConditions.length > 0 ? orConditions : [{ username: account }],
    },
  });

  if (!targetUser) {
    // 明确按需求提示：如果不存在返回账号不存在
    ctx.throw(400, '该账号不存在，请检查后重新输入');
  }

  const recordsRepo = db.getRepository('password_recovery_records');
  const requestsRepo = db.getRepository('password_recovery_requests');

  // 2.1 防轰炸保护：单账号 24 小时最大找回频次上限
  const dailyLimit = Number(config.dailyLimitPerAccount) || 10;
  if (recordsRepo && dailyLimit > 0) {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    try {
      const dailyCount = await recordsRepo.count({
        filter: {
          userId: targetUser.id,
          createdAt: {
            $gt: oneDayAgo,
          },
        },
      });
      if (dailyCount >= dailyLimit) {
        ctx.throw(429, `该账号今日找回密码次数已达上限（每天最多 ${dailyLimit} 次），请明天再试或联系管理员`);
      }
    } catch (countErr: any) {
      if (countErr.status === 429) throw countErr;
    }
  }

  // 3. 生成安全验证码与会话 Token
  const codeLength = Number(config.codeLength) || 6;
  const min = Math.pow(10, codeLength - 1);
  const max = Math.pow(10, codeLength) - 1;
  const code = String(Math.floor(min + Math.random() * (max - min + 1)));
  const sessionToken = crypto.randomBytes(32).toString('hex');
  const expiresInMinutes = Number(config.codeExpiresInMinutes) || 5;
  const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);

  // 将该用户之前未完成的 pending 记录失效
  try {
    if (recordsRepo) {
      await recordsRepo.update({
        filter: {
          userId: targetUser.id,
          status: 'pending',
        },
        values: {
          status: 'expired',
        },
      });
    }
  } catch (e) {}

  // 4. 创建内部验证记录入库
  if (recordsRepo) {
    await recordsRepo.create({
      values: {
        userId: targetUser.id,
        account,
        code,
        token: sessionToken,
        status: 'pending',
        failedAttempts: 0,
        expiresAt,
        ip: clientIp,
      },
    });
  }

  // 5. 【核心联动】：在业务数据表 password_recovery_requests 中创建记录！
  // 这将原生触发 NocoBase 工作流对该表“数据表事件（创建数据后）”的监听器！
  let collectionTriggerSuccess = false;
  if (requestsRepo) {
    try {
      await requestsRepo.create({
        values: {
          account,
          code,
          userId: targetUser.id,
          username: targetUser.username || '',
          email: targetUser.email || '',
          phone: targetUser.phone || '',
          nickname: targetUser.nickname || '',
          status: 'pending',
          expiresInMinutes,
          expiresAt,
          token: sessionToken,
          ip: clientIp,
        },
      });
      collectionTriggerSuccess = true;
    } catch (createErr: any) {
      ctx.app.logger?.warn?.(`[PasswordRecovery] 创建业务请求记录失败: ${createErr.message}`);
    }
  }

  // 6. 兼容性支持：若管理员还显式配置了 workflowKey，则同时尝试直接触发目标工作流
  let workflowTriggered = collectionTriggerSuccess;
  const workflowKey = config.workflowKey;

  if (workflowKey) {
    try {
      const workflowPlugin: any = ctx.app.getPlugin('@nocobase/plugin-workflow');
      if (workflowPlugin) {
        const workflowRepo = db.getRepository('workflows');
        const targetWorkflow = await workflowRepo.findOne({
          filter: {
            $or: [{ key: String(workflowKey) }, { id: String(workflowKey) }],
            enabled: true,
          },
        });

        if (targetWorkflow && typeof workflowPlugin.trigger === 'function') {
          await workflowPlugin.trigger(targetWorkflow, {
            data: {
              account,
              code,
              userId: targetUser.id,
              username: targetUser.username || '',
              email: targetUser.email || '',
              phone: targetUser.phone || '',
              nickname: targetUser.nickname || '',
              expiresInMinutes,
              expiresAt: expiresAt.toISOString(),
              clientIp,
              requestSource: 'enterprise-password-recovery',
              requestedAt: new Date().toISOString(),
            },
          });
          workflowTriggered = true;
        }
      }
    } catch (wfErr: any) {
      ctx.app.logger?.error?.(`[PasswordRecovery] 显式触发工作流异常: ${wfErr.message}`);
    }
  }

  // 响应前端
  ctx.body = {
    success: true,
    token: sessionToken,
    message: '验证码生成成功，工作流事件已触发',
    workflowTriggered,
    maskedAccount: maskAccountString(account),
    expiresInSeconds: expiresInMinutes * 60,
  };

  await next();
}

export default checkAccountAndSendCodeAction;
