import React, { useState, useEffect } from 'react';
import { useApp } from '@nocobase/client-v2';
import { PasswordRecoveryModal } from './PasswordRecoveryModal';
import { PasswordRecoveryPublicConfig } from '../types';

export const SignInPageEnhancer: React.FC<{ originalSignInPage: React.ComponentType }> = ({
  originalSignInPage: OriginalSignInPage,
}) => {
  const app = useApp();
  const [modalOpen, setModalOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [hasInjectedToSignUpRow, setHasInjectedToSignUpRow] = useState(false);
  const [config, setConfig] = useState<PasswordRecoveryPublicConfig>({
    enabled: true,
    buttonText: '忘记密码？',
    codeLength: 6,
    codeExpiresInMinutes: 5,
  });

  // 1. 挂载全局方法
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__openPasswordRecoveryModal = () => setModalOpen(true);
      (window as any).__closePasswordRecoveryModal = () => setModalOpen(false);
    }
    return () => {
      if (typeof window !== 'undefined') {
        delete (window as any).__openPasswordRecoveryModal;
        delete (window as any).__closePasswordRecoveryModal;
      }
    };
  }, []);

  // 2. 加载公共配置
  useEffect(() => {
    let mounted = true;
    const fetchConfig = async () => {
      try {
        let data: any = null;
        if (app?.apiClient) {
          const res = await app.apiClient.request({
            url: 'passwordRecovery:getPublicConfig',
            skipAuth: true,
            skipNotify: true,
          });
          data = res?.data?.data || res?.data;
        } else {
          const resp = await fetch('/api/passwordRecovery:getPublicConfig');
          if (resp.ok) {
            const json = await resp.json();
            data = json?.data || json;
          }
        }
        if (mounted && data) {
          setConfig({
            enabled: data.enabled ?? true,
            buttonText: data.buttonText || '忘记密码？',
            codeLength: data.codeLength || 6,
            codeExpiresInMinutes: data.codeExpiresInMinutes || 5,
          });
        }
      } catch (e) {}
    };

    fetchConfig();
    return () => {
      mounted = false;
    };
  }, [app]);

  // 3. 全局事件捕获：点击任意“忘记密码”文字均能呼起弹窗
  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target) return;
      const text = target.innerText?.trim();
      if (
        text === '忘记密码？' ||
        text === '忘记密码' ||
        text === '找回密码' ||
        target.getAttribute('data-action') === 'forgot-password' ||
        target.closest('[data-action="forgot-password"]')
      ) {
        e.preventDefault();
        e.stopPropagation();
        setModalOpen(true);
      }
    };

    document.addEventListener('click', handleGlobalClick, true);
    return () => {
      document.removeEventListener('click', handleGlobalClick, true);
    };
  }, []);

  // 4. 智能排版融合：检测“注册账号”链接容器并实现 V1 风格的两端对称对齐
  useEffect(() => {
    if (!config.enabled) return;

    const alignWithSignUpRow = () => {
      if (document.getElementById('nocobase-v2-password-recovery-trigger')) return;

      const links = Array.from(document.querySelectorAll('a'));
      const signUpLink = links.find(
        (a) =>
          a.getAttribute('href')?.includes('/signup') ||
          a.innerText?.trim() === '注册账号' ||
          a.innerText?.trim() === 'Sign up',
      );

      if (signUpLink && signUpLink.parentElement) {
        const parent = signUpLink.parentElement;

        // 设置与 V1 完全一致的两端对齐布局
        parent.style.display = 'flex';
        parent.style.justifyContent = 'space-between';
        parent.style.alignItems = 'center';

        const trigger = document.createElement('a');
        trigger.id = 'nocobase-v2-password-recovery-trigger';
        trigger.setAttribute('data-action', 'forgot-password');
        trigger.innerText = config.buttonText || '忘记密码？';
        // 参考 V1 的文本样式设计
        trigger.style.color = '#1677ff';
        trigger.style.cursor = 'pointer';
        trigger.style.fontSize = '14px';
        trigger.style.fontWeight = 'normal';
        trigger.style.textDecoration = 'none';
        trigger.style.transition = 'color 0.2s';
        trigger.onmouseover = () => (trigger.style.color = '#4096ff');
        trigger.onmouseout = () => (trigger.style.color = '#1677ff');

        parent.appendChild(trigger);
        setHasInjectedToSignUpRow(true);
      }
    };

    alignWithSignUpRow();
    const timer = setInterval(alignWithSignUpRow, 300);
    const stopTimer = setTimeout(() => clearInterval(timer), 3000);

    return () => {
      clearInterval(timer);
      clearTimeout(stopTimer);
    };
  }, [config.enabled, config.buttonText]);

  return (
    <div className="nocobase-signin-enhanced-wrapper" style={{ width: '100%', minHeight: '100%' }}>
      <OriginalSignInPage />

      {/* 当未能直接注入到注册链接行时，通过 React 容器兜底呈现：同样采用 14px、右对齐的纯文字样式 */}
      {config.enabled && !hasInjectedToSignUpRow && (
        <div
          className="nocobase-password-recovery-fallback-entry"
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            marginTop: 8,
            padding: '0 2px',
          }}
        >
          <a
            data-action="forgot-password"
            onClick={(e) => {
              e.preventDefault();
              setModalOpen(true);
            }}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
              fontSize: '14px',
              fontWeight: 'normal',
              color: hovered ? '#4096ff' : '#1677ff',
              textDecoration: 'none',
              cursor: 'pointer',
              lineHeight: 1.5714,
              transition: 'color 0.2s ease',
            }}
          >
            {config.buttonText || '忘记密码？'}
          </a>
        </div>
      )}

      <PasswordRecoveryModal
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        codeLength={config.codeLength || 6}
      />
    </div>
  );
};

export default SignInPageEnhancer;
