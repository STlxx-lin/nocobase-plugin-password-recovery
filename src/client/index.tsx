import React, { useState, useEffect } from 'react';
import { Plugin } from '@nocobase/client';
import { PasswordRecoveryModal } from './components/PasswordRecoveryModal';
import { StandaloneRecoveryPage } from './pages/StandaloneRecoveryPage';

// 全局找回密码 Context / 状态管理器与 DOM 智能挂载组件
const GlobalPasswordRecoveryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [buttonText, setButtonText] = useState('忘记密码？');

  // 1. 挂载全局控制函数
  useEffect(() => {
    (window as any).__openPasswordRecoveryModal = () => setModalOpen(true);
    (window as any).__closePasswordRecoveryModal = () => setModalOpen(false);

    // 尝试拉取服务端配置
    fetch('/api/passwordRecovery:getPublicConfig')
      .then((res) => res.json())
      .then((data) => {
        const conf = data?.data || data;
        if (conf?.buttonText) {
          setButtonText(conf.buttonText);
        }
      })
      .catch(() => {});

    return () => {
      delete (window as any).__openPasswordRecoveryModal;
      delete (window as any).__closePasswordRecoveryModal;
    };
  }, []);

  // 2. 全局点击捕获代理
  useEffect(() => {
    const handleDocumentClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target) return;

      const isRecoveryAction =
        target.getAttribute('data-action') === 'forgot-password' ||
        target.closest('[data-action="forgot-password"]') ||
        target.innerText?.trim() === '忘记密码？' ||
        target.innerText?.trim() === '忘记密码' ||
        target.innerText?.trim() === '找回密码';

      if (isRecoveryAction) {
        e.preventDefault();
        e.stopPropagation();
        setModalOpen(true);
      }
    };

    document.addEventListener('click', handleDocumentClick, true);
    return () => {
      document.removeEventListener('click', handleDocumentClick, true);
    };
  }, []);

  // 3. 智能 DOM 观察器：确保在各类登录页（无论是原生还是第三方）均能稳定注入按钮
  useEffect(() => {
    const injectTriggerButton = () => {
      const isSignInRoute =
        window.location.pathname.includes('/signin') ||
        window.location.pathname.endsWith('/signin') ||
        document.querySelector('input[type="password"]');

      if (!isSignInRoute) return;

      // 如果已经注入过，则不再重复
      if (document.getElementById('nocobase-password-recovery-trigger')) return;

      // 寻找“注册账号”链接或登录提交按钮所在的行/容器
      const links = Array.from(document.querySelectorAll('a'));
      const signUpLink = links.find(
        (a) =>
          a.getAttribute('href')?.includes('/signup') ||
          a.innerText?.trim() === '注册账号' ||
          a.innerText?.trim() === 'Sign up',
      );

      if (signUpLink && signUpLink.parentElement) {
        const parent = signUpLink.parentElement;

        // 如果父元素是 flex 容器，将其对齐方式调整为两端对齐
        parent.style.display = 'flex';
        parent.style.justifyContent = 'space-between';
        parent.style.alignItems = 'center';

        const trigger = document.createElement('a');
        trigger.id = 'nocobase-password-recovery-trigger';
        trigger.setAttribute('data-action', 'forgot-password');
        trigger.innerText = buttonText;
        trigger.style.color = '#1677ff';
        trigger.style.cursor = 'pointer';
        trigger.style.fontSize = '14px';
        trigger.style.textDecoration = 'none';
        trigger.style.transition = 'color 0.2s';
        trigger.onmouseover = () => (trigger.style.color = '#4096ff');
        trigger.onmouseout = () => (trigger.style.color = '#1677ff');

        parent.appendChild(trigger);
        return;
      }

      // 兜底策略：如果未开启注册（无注册链接），则在登录按钮下方或者密码输入框后注入
      const submitBtn = document.querySelector('button[type="submit"]');
      if (submitBtn && submitBtn.parentElement) {
        const container = document.createElement('div');
        container.id = 'nocobase-password-recovery-trigger-wrap';
        container.style.textAlign = 'right';
        container.style.marginTop = '12px';

        const trigger = document.createElement('a');
        trigger.id = 'nocobase-password-recovery-trigger';
        trigger.setAttribute('data-action', 'forgot-password');
        trigger.innerText = buttonText;
        trigger.style.color = '#1677ff';
        trigger.style.cursor = 'pointer';
        trigger.style.fontSize = '14px';
        trigger.style.textDecoration = 'none';
        trigger.onmouseover = () => (trigger.style.color = '#4096ff');
        trigger.onmouseout = () => (trigger.style.color = '#1677ff');

        container.appendChild(trigger);
        submitBtn.parentElement.appendChild(container);
      }
    };

    // 初始执行一次
    injectTriggerButton();

    // 观察 DOM 树动态变化（React 异步挂载时）
    const observer = new MutationObserver(() => {
      injectTriggerButton();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // 轮询几次防止初次加载竞争
    const timer = setInterval(injectTriggerButton, 300);
    const stopTimer = setTimeout(() => clearInterval(timer), 3000);

    return () => {
      observer.disconnect();
      clearInterval(timer);
      clearTimeout(stopTimer);
    };
  }, [buttonText]);

  return (
    <>
      {children}
      <PasswordRecoveryModal
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
      />
    </>
  );
};

export class PluginPasswordRecoveryClient extends Plugin {
  async load() {
    // 1. 注册全局 Provider，承载全局模态框和 DOM 智能注入
    this.app.providers.push([GlobalPasswordRecoveryProvider, {}]);

    // 2. 注册独立访问路由 /password-recovery
    this.router.add('auth.passwordRecovery', {
      path: '/password-recovery',
      skipAuthCheck: true,
      Component: StandaloneRecoveryPage,
    });

    // 3. 注册组件到 NocoBase 组件注册表
    this.app.addComponents({
      PasswordRecoveryModal,
      StandaloneRecoveryPage,
    });
  }
}

export default PluginPasswordRecoveryClient;
