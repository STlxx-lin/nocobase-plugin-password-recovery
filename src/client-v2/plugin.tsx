import React from 'react';
import { Plugin, Application } from '@nocobase/client-v2';

export class PluginPasswordRecoveryClient extends Plugin<any, Application> {
  async load() {
    // 1. 注册系统设置中心管理菜单与页面
    if (this.pluginSettingsManager) {
      const title = this.t('Enterprise Password Recovery');
      const menuKey = 'password-recovery';
      const pageName = `${menuKey}.index`;

      if (
        typeof this.pluginSettingsManager.addMenuItem === 'function' &&
        typeof this.pluginSettingsManager.addPageTabItem === 'function'
      ) {
        this.pluginSettingsManager.addMenuItem({
          key: menuKey,
          title,
          icon: 'SafetyCertificateOutlined',
          aclSnippet: 'pm',
        });

        this.pluginSettingsManager.addPageTabItem({
          menuKey,
          key: 'index',
          title: this.t('Password recovery settings'),
          icon: 'SafetyCertificateOutlined',
          aclSnippet: 'pm',
          componentLoader: () => import('./pages/PasswordRecoverySettings'),
        });

        const pluginNames = [
          this.options?.name,
          this.options?.packageName,
          'password-recovery',
          '@nocobase/plugin-password-recovery',
        ].filter(Boolean);

        [...new Set(pluginNames)].forEach((pName) => {
          this.pluginSettingsManager.setPluginSettingsLink?.(pName, pageName);
        });
      }
    }

    // 2. 注册独立的密码找回路由 (/v/password-recovery)
    this.router.add('password-recovery', {
      path: '/password-recovery',
      skipAuthCheck: true,
      componentLoader: () => import('./pages/StandaloneRecoveryPage'),
    });

    // 3. 拦截并增强系统登录路由 (/signin)，在登录下方注入找回密码入口
    try {
      const authRoute: any = this.router.get('auth.signin');
      if (authRoute) {
        if (typeof authRoute.componentLoader === 'function') {
          const rawLoader = authRoute.componentLoader;
          authRoute.componentLoader = async () => {
            const originalModule = await rawLoader();
            const RawComponent = (originalModule && originalModule.default) || originalModule;
            const { SignInPageEnhancer } = await import('./components/SignInPageEnhancer');
            return {
              default: () => <SignInPageEnhancer originalSignInPage={RawComponent} />,
            };
          };
        } else if (authRoute.Component) {
          const RawComponent = authRoute.Component;
          const { SignInPageEnhancer } = await import('./components/SignInPageEnhancer');
          authRoute.Component = () => <SignInPageEnhancer originalSignInPage={RawComponent} />;
        }
      }
    } catch (err) {
      console.warn('[PasswordRecovery] 增强登录路由异常:', err);
    }
  }
}

export default PluginPasswordRecoveryClient;
