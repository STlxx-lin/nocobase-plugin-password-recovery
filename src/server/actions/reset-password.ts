import { Context } from '@nocobase/actions';

export async function resetPasswordAction(ctx: Context, next: () => Promise<any>) {
  const bodyData = ctx.action?.params?.values || ctx.request?.body || {};
  const token = String(bodyData.token || '').trim();
  const code = String(bodyData.code || '').trim();
  const newPassword = String(bodyData.newPassword || '');
  const confirmPassword = String(bodyData.confirmPassword || '');

  if (!token) {
    ctx.throw(400, '缺少找回密码会话凭据 (token)，请重新获取验证码');
  }

  if (!code) {
    ctx.throw(400, '请输入收到的验证码');
  }

  if (!newPassword) {
    ctx.throw(400, '请输入新密码');
  }

  if (newPassword.length < 6) {
    ctx.throw(400, '新密码长度至少需要 6 个字符');
  }

  if (confirmPassword && newPassword !== confirmPassword) {
    ctx.throw(400, '两次输入的新密码不一致，请核对');
  }

  const db = ctx.db;
  const configRepo = db.getRepository('password_recovery_configs');
  const config = (await configRepo.findOne({ filter: { key: 'default' } })) || {
    maxFailedAttempts: 5,
    passwordPolicy: 'standard',
  };

  // 密码复杂度策略校验
  const passwordPolicy = config.passwordPolicy || 'standard';
  if (passwordPolicy === 'standard') {
    const hasLetter = /[a-zA-Z]/.test(newPassword);
    const hasDigit = /\d/.test(newPassword);
    if (!hasLetter || !hasDigit) {
      ctx.throw(400, '新密码必须同时包含英文字母和数字，以保障企业账号安全');
    }
  }

  const recordsRepo = db.getRepository('password_recovery_records');
  const record = await recordsRepo.findOne({
    filter: {
      token,
      status: ['pending', 'verified'],
    },
  });

  if (!record) {
    ctx.throw(400, '找回密码会话不存在或已失效，请重新发起找回请求');
  }

  // 1. 检查有效截止时间
  if (record.expiresAt && new Date(record.expiresAt).getTime() < Date.now()) {
    record.status = 'expired';
    await record.save();
    ctx.throw(400, '验证码已过期，请重新获取验证码');
  }

  // 2. 检查最大失败次数
  const maxAttempts = Number(config.maxFailedAttempts) || 5;
  if ((record.failedAttempts || 0) >= maxAttempts) {
    record.status = 'expired';
    await record.save();
    ctx.throw(400, '验证码错误次数已达上限，该会话已被锁定，请重新发起找回请求');
  }

  // 3. 校验验证码一致性
  if (String(record.code).trim() !== code) {
    const currentFailures = (record.failedAttempts || 0) + 1;
    record.failedAttempts = currentFailures;
    if (currentFailures >= maxAttempts) {
      record.status = 'expired';
    }
    await record.save();
    const remaining = Math.max(0, maxAttempts - currentFailures);
    if (remaining === 0) {
      ctx.throw(400, '验证码错误次数过多，该会话已被强制作废，请重新获取验证码');
    }
    ctx.throw(400, `验证码错误，还剩 ${remaining} 次输入机会`);
  }

  // 4. 检索关联用户
  const userCol = db.getCollection('users');
  const userRepo = db.getRepository('users');
  const user = await userRepo.findOne({
    filter: {
      id: record.userId,
    },
  });

  if (!user) {
    ctx.throw(404, '关联的用户不存在或已被删除');
  }

  // 5. 核心需求：新密码与当前密码比对（如果密码和现在相同就提示密码相同）
  const passwordField: any = userCol.getField('password');
  if (passwordField && typeof passwordField.verify === 'function') {
    const isSamePassword = await passwordField.verify(newPassword, user.password);
    if (isSamePassword) {
      ctx.throw(400, '新密码不能与当前使用的密码相同，请更换新密码');
    }
  }

  // 6. 成功更新密码并标记本次凭证作废
  user.password = newPassword;
  await user.save();

  record.status = 'used';
  record.code = '******'; // 敏感验证码自动打码擦除，防止历史明文泄露
  await record.save();

  try {
    const requestsRepo = db.getRepository('password_recovery_requests');
    if (requestsRepo) {
      await requestsRepo.update({
        filter: { token },
        values: { status: 'used', code: '******' },
      });
    }
  } catch (e) {}

  ctx.app.logger?.info?.(
    `[PasswordRecovery] 用户 ${user.id} (${user.username || user.email || 'unknown'}) 密码通过企业密码找回流程重置成功。`,
  );

  ctx.body = {
    success: true,
    message: '密码重置成功，请使用新密码登录',
    timestamp: new Date().toISOString(),
  };

  await next();
}
