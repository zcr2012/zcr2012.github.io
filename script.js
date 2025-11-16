/**
 * 博客系统 - 深度优化版本
 * 解决了BlogApp初始化失败和按钮无反应的问题
 * 包含现代化JavaScript最佳实践
 */

class BlogAppOptimized {
    constructor() {
        this.articles = [];
        this.users = [];
        this.comments = [];
        this.currentUser = null;
        this.currentFilter = 'all';
        this.searchTerm = '';
        this.editingArticleId = null;
        this.previousActiveElement = null;
        this.isInitialized = false;
        this.eventListeners = new Map(); // 用于管理事件监听器
        
        // 修复：添加首次加载标志，防止自动跳转
        this.isFirstLoad = localStorage.getItem('blogFirstLoad') !== 'false';
        
        // 修复：记录登录屏幕显示时间（用于防抖）
        this.loginScreenShowTime = null;
        this.hideLoginTimer = null;
        
        // 修复：记录当前会话已读文章（防重复计数）
        this.viewedArticles = new Set();
        
        // 使用Promise确保正确的初始化顺序
        this.initPromise = this.initializeApp();
    }

    /**
     * 检查localStorage可用性
     * @returns {boolean}
     */
    checkLocalStorageAvailability() {
        try {
            const test = '__localStorage_test__';
            localStorage.setItem(test, 'test');
            localStorage.removeItem(test);
            console.log('✅ localStorage可用');
            return true;
        } catch (error) {
            console.warn('⚠️ localStorage不可用:', error.message);
            return false;
        }
    }

    /**
     * 安全的异步初始化
     * @returns {Promise<void>}
     */
    async initializeApp() {
        try {
            console.log('=== 开始博客应用初始化 ===');
            
            // 步骤1: 检查localStorage可用性
            const localStorageAvailable = this.checkLocalStorageAvailability();
            if (!localStorageAvailable) {
                console.warn('⚠️ localStorage不可用');
            }
            
            // 步骤2: 等待DOM就绪
            await this.waitForDOM();
            
            // 步骤3: 检查关键DOM元素
            const elementCheckResult = await this.checkCriticalElements();
            if (!elementCheckResult.success) {
                throw new Error(`关键DOM元素缺失: ${elementCheckResult.missingElements.join(', ')}`);
            }

            // 步骤4: 优先初始化管理员账户
            await this.initializeAdminAccount();
            
            // 步骤5: 加载数据
            await this.loadAllDataSafe();
            
            // 步骤6: 验证数据完整性
            await this.validateDataIntegrity();
            
            // 步骤7: 绑定事件
            await this.delay(200);
            await this.bindEventsSafely();
            
            // 步骤8: 更新UI
            this.updateUI();
            
            // 步骤9: 检查登录状态（修复：添加首次加载标志）
            if (this.isFirstLoad) {
                console.log('🔄 首次加载，强制显示登录界面');
                localStorage.setItem('blogFirstLoad', 'false');
                this.showLoginScreen();
            } else {
                // 非首次加载，正常检查登录状态
                await this.checkLoginStatus();
            }
            
            // 步骤10: 初始化示例数据
            this.initializeSampleData();
            
            // 步骤11: 初始化阅读量监控（新增）
            this.initViewSyncEvents();
            
            this.isInitialized = true;
            console.log('=== 博客应用初始化完成 ===');
            
            this.showNotification('博客系统已就绪', 'success', 2000);
            
            // 初始验证阅读量统计
            this.validateViewStats();
            
        } catch (error) {
            console.error('博客应用初始化失败:', error);
            this.handleInitError(error);
        }
    }

    /**
     * 初始化阅读量同步事件和监控
     */
    initViewSyncEvents() {
        console.log('🔄 初始化阅读量监控...');
        
        // 监听 storage 事件（跨标签页同步）
        window.addEventListener('storage', (e) => {
            if (e.key === 'blogArticles') {
                console.log('🔄 检测到文章数据变化，同步阅读量显示...');
                this.loadAllDataSafe().then(() => {
                    this.syncAllViewDisplays();
                });
            }
        });
        
        // 定期验证（每30秒检查一次）
        setInterval(() => {
            this.validateViewStats();
        }, 30000);
        
        // 关键操作后验证 - 包装 syncAllViewDisplays
        const originalSyncAllViewDisplays = this.syncAllViewDisplays.bind(this);
        this.syncAllViewDisplays = async () => {
            await originalSyncAllViewDisplays();
            // 同步后立即验证
            setTimeout(() => {
                this.validateViewStats();
            }, 100);
        };
        
        console.log('✅ 阅读量监控已初始化');
    }
    
    /**
     * 等待DOM完全就绪
     * @returns {Promise<void>}
     */
    waitForDOM() {
        return new Promise((resolve) => {
            if (document.readyState === 'complete') {
                resolve();
            } else if (document.readyState === 'interactive') {
                // 确保所有资源加载完成
                setTimeout(resolve, 100);
            } else {
                document.addEventListener('DOMContentLoaded', resolve);
            }
        });
    }

    /**
     * 延迟函数
     * @param {number} ms 毫秒数
     * @returns {Promise<void>}
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * 安全的数据加载
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    async loadAllDataSafe() {
        try {
            console.log('安全加载数据...');
            
            // 并行加载所有数据
            const [articles, users, comments, currentUser] = await Promise.all([
                this.safeGetLocalStorage('blogArticles', []),
                this.safeGetLocalStorage('blogUsers', []),
                this.safeGetLocalStorage('blogComments', []),
                this.safeGetLocalStorage('blogUser', null)
            ]);

            this.articles = articles;
            this.users = users;
            this.comments = comments;
            this.currentUser = currentUser;
            
            console.log(`数据加载完成: ${articles.length}篇文章, ${users.length}用户, ${comments.length}评论`);
            return { success: true };
            
        } catch (error) {
            console.error('数据加载失败:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * 安全的localStorage操作
     * @param {string} key 
     * @param {*} defaultValue 
     * @returns {Promise<*>}
     */
    safeGetLocalStorage(key, defaultValue) {
        return new Promise((resolve) => {
            try {
                // 检查localStorage是否可用
                if (typeof localStorage === 'undefined' || localStorage === null) {
                    console.warn(`localStorage不可用 (${key}): 返回默认值`);
                    resolve(defaultValue);
                    return;
                }
                
                const stored = localStorage.getItem(key);
                console.log(`🔍 localStorage获取 ${key}:`, stored);
                
                if (stored === null) {
                    console.log(`localStorage中未找到 ${key}，使用默认值`);
                    
                    // 对于用户数据，如果内存中有数据但localStorage没有，恢复数据
                    if (key === 'blogUsers' && this.users && this.users.length > 0) {
                        console.log('⚠️ 检测到blogUsers数据完全丢失，恢复内存中的数据');
                        localStorage.setItem(key, JSON.stringify(this.users));
                        console.log('✅ 已从内存恢复管理员账户数据');
                        resolve(this.users);
                    } else {
                        resolve(defaultValue);
                    }
                } else {
                    try {
                        const parsed = JSON.parse(stored);
                        console.log(`✅ localStorage读取成功 (${key}):`, parsed);
                        
                        // 特殊处理用户数据，进行多层次检查
                        if (key === 'blogUsers') {
                            // 检查1：空数组检查
                            if (parsed.length === 0 && this.users && this.users.length > 0) {
                                console.log('⚠️ 检测到blogUsers数据丢失（空数组），恢复内存中的数据');
                                localStorage.setItem(key, JSON.stringify(this.users));
                                console.log('✅ 已恢复管理员账户数据');
                                return resolve(this.users);
                            }
                            
                            // 检查2：管理员账户存在性检查
                            const hasAdmin = parsed.some(user => user.username === 'zcr');
                            if (!hasAdmin && this.users && this.users.length > 0) {
                                const hasAdminInMemory = this.users.some(user => user.username === 'zcr');
                                if (hasAdminInMemory) {
                                    console.log('⚠️ 检测到管理员账户丢失，恢复内存中的数据');
                                    localStorage.setItem(key, JSON.stringify(this.users));
                                    console.log('✅ 已恢复管理员账户数据');
                                    return resolve(this.users);
                                }
                            }
                            
                            // 检查3：数据结构完整性检查
                            if (Array.isArray(parsed)) {
                                // 确保所有用户对象都有必要字段
                                const validUsers = parsed.filter(user => 
                                    user && 
                                    typeof user === 'object' && 
                                    user.username && 
                                    user.password
                                );
                                
                                if (validUsers.length !== parsed.length) {
                                    console.log('⚠️ 检测到用户数据格式异常，清理无效数据');
                                    localStorage.setItem(key, JSON.stringify(validUsers));
                                    return resolve(validUsers);
                                }
                            } else {
                                console.warn(`⚠️ blogUsers数据格式异常:`, parsed);
                                return resolve(defaultValue);
                            }
                        }
                        
                        resolve(parsed);
                    } catch (parseError) {
                        console.warn(`localStorage数据解析失败 (${key}):`, parseError);
                        console.log('返回默认值:', defaultValue);
                        resolve(defaultValue);
                    }
                }
            } catch (error) {
                console.warn(`localStorage读取失败 (${key}):`, error);
                console.log('返回默认值:', defaultValue);
                resolve(defaultValue);
            }
        });
    }

    /**
     * 检查关键DOM元素
     * @returns {Promise<{success: boolean, missingElements?: string[]}>}
     */
    async checkCriticalElements() {
        // 区分ID选择器和class选择器
        const criticalElements = {
            'id': ['login-screen', 'login-form-screen', 'username-input-screen', 'password-input-screen'],
            'class': ['main-content', 'navbar']
        };

        const missingElements = [];
        
        // 检查ID元素
        for (const elementId of criticalElements.id) {
            await this.delay(10);
            if (!document.getElementById(elementId)) {
                missingElements.push(elementId);
            }
        }
        
        // 检查class元素
        for (const className of criticalElements.class) {
            await this.delay(10);
            if (!document.querySelector(`.${className}`)) {
                missingElements.push(className);
            }
        }

        if (missingElements.length > 0) {
            console.error('缺失的关键元素:', missingElements);
            return { success: false, missingElements };
        }

        console.log('✓ 所有关键元素检查通过');
        return { success: true };
    }

    /**
     * 安全的事件绑定
     */
    async bindEventsSafely() {
        try {
            console.log('开始安全事件绑定...');
            
            // 清理旧的事件监听器
            this.cleanupEventListeners();
            
            // 绑定核心事件
            await Promise.all([
                this.bindNavigationEvents(),
                this.bindSearchEvents(),
                this.bindFilterEvents(),
                this.bindLoginScreenEvents(),
                this.bindUserInterfaceEvents(),
                this.bindCommentEvents()
            ]);
            
            console.log('✓ 所有事件绑定完成');
        } catch (error) {
            console.error('事件绑定失败:', error);
            throw error;
        }
    }

    /**
     * 清理旧的事件监听器
     */
    cleanupEventListeners() {
        for (const [element, listeners] of this.eventListeners) {
            if (element && element.removeEventListener) {
                listeners.forEach(({ event, handler }) => {
                    element.removeEventListener(event, handler);
                });
            }
        }
        this.eventListeners.clear();
    }

    /**
     * 安全地添加事件监听器
     * @param {Element} element 
     * @param {string} event 
     * @param {Function} handler 
     */
    addSafeEventListener(element, event, handler) {
        if (!element) {
            console.warn(`无法添加事件监听器: 元素不存在 (${event})`);
            return;
        }

        element.addEventListener(event, handler, { passive: false });
        
        // 记录事件监听器以便清理
        if (!this.eventListeners.has(element)) {
            this.eventListeners.set(element, []);
        }
        this.eventListeners.get(element).push({ event, handler });
    }

    /**
     * 绑定导航事件
     */
    async bindNavigationEvents() {
        await this.delay(50);
        const navLinks = document.querySelectorAll('.nav-link[data-section]');
        console.log(`找到 ${navLinks.length} 个导航链接`);
        
        navLinks.forEach((link, index) => {
            const handler = (e) => {
                e.preventDefault();
                e.stopPropagation();
                const section = link.dataset.section;
                console.log('导航点击:', section);
                this.showSection(section);
                this.setActiveNavLink(link);
            };
            
            this.addSafeEventListener(link, 'click', handler);
            console.log(`导航链接 ${index + 1} 事件绑定完成`);
        });
    }

    /**
     * 绑定搜索事件
     */
    async bindSearchEvents() {
        await this.delay(50);
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            const handler = (e) => {
                this.searchTerm = e.target.value.toLowerCase();
                this.renderArticles();
            };
            
            this.addSafeEventListener(searchInput, 'input', handler);
            console.log('搜索框事件绑定完成');
        } else {
            console.warn('搜索框未找到');
        }
    }

    /**
     * 绑定过滤器事件
     */
    async bindFilterEvents() {
        await this.delay(50);
        const filterTabs = document.querySelectorAll('.filter-tab');
        console.log(`找到 ${filterTabs.length} 个过滤标签`);
        
        filterTabs.forEach((tab, index) => {
            const handler = (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.setActiveFilterTab(tab);
                this.currentFilter = tab.dataset.filter;
                this.renderArticles();
            };
            
            this.addSafeEventListener(tab, 'click', handler);
            console.log(`过滤标签 ${index + 1} 事件绑定完成`);
        });
    }

    /**
     * 绑定登录屏幕事件
     */
    async bindLoginScreenEvents() {
        await this.delay(50);
        
        // 登录表单
        const loginForm = document.getElementById('login-form-screen');
        if (loginForm) {
            const handler = (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('登录表单提交');
                this.handleLoginScreen();
            };
            
            this.addSafeEventListener(loginForm, 'submit', handler);
            console.log('登录表单事件绑定完成');
        } else {
            console.error('登录表单未找到');
        }

        // 注册表单
        const registerForm = document.getElementById('register-form-screen');
        if (registerForm) {
            const handler = (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('注册表单提交');
                this.handleRegisterScreen();
            };
            
            this.addSafeEventListener(registerForm, 'submit', handler);
            console.log('注册表单事件绑定完成');
        }

        // 切换按钮
        await this.bindToggleButtons();
    }

    /**
     * 绑定切换按钮事件
     */
    async bindToggleButtons() {
        const showRegisterBtn = document.getElementById('show-register-btn');
        const showLoginBtn = document.getElementById('show-login-btn');
        
        if (showRegisterBtn) {
            const handler = (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('显示注册表单');
                this.showRegisterForm();
            };
            
            this.addSafeEventListener(showRegisterBtn, 'click', handler);
            console.log('显示注册按钮事件绑定完成');
        }
        
        if (showLoginBtn) {
            const handler = (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('显示登录表单');
                this.showLoginForm();
            };
            
            this.addSafeEventListener(showLoginBtn, 'click', handler);
            console.log('显示登录按钮事件绑定完成');
        }
    }

    /**
     * 绑定用户界面事件
     */
    async bindUserInterfaceEvents() {
        console.log('开始绑定用户界面事件...');
        
        // 绑定退出登录按钮
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            const handler = (e) => {
                e.preventDefault();
                this.handleLogout();
            };
            
            this.addSafeEventListener(logoutBtn, 'click', handler);
            console.log('✓ 退出登录按钮事件绑定完成');
        } else {
            console.warn('⚠ 退出登录按钮未找到');
        }

        // 绑定文章详情模态框关闭按钮（修复问题2）
        const articleModalCloseBtn = document.getElementById('modal-close');
        if (articleModalCloseBtn) {
            const handler = () => {
                const modal = document.getElementById('article-modal');
                this.closeModal(modal);
            };
            
            this.addSafeEventListener(articleModalCloseBtn, 'click', handler);
            console.log('✓ 文章详情模态框关闭按钮事件绑定完成');
        } else {
            console.warn('⚠ 文章详情模态框关闭按钮未找到');
        }

        // 绑定编辑器模态框关闭按钮
        const editorModalCloseBtn = document.getElementById('editor-modal-close');
        if (editorModalCloseBtn) {
            const handler = () => {
                this.closeEditorModal();
            };
            
            this.addSafeEventListener(editorModalCloseBtn, 'click', handler);
            console.log('✓ 编辑器模态框关闭按钮事件绑定完成');
        } else {
            console.warn('⚠ 编辑器模态框关闭按钮未找到');
        }

        // 添加数据重置功能（调试用）
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.shiftKey && e.key === 'R') {
                e.preventDefault();
                this.resetAllData();
            }
        });

        // 绑定文章表单事件
        await this.bindArticleFormEvents();
        
        // 绑定文章表单提交事件（只绑定一次，防止重复）
        const articleForm = document.getElementById('article-form');
        if (articleForm) {
            articleForm.addEventListener('submit', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.saveArticle();
            });
            console.log('✓ 文章表单提交事件绑定完成（全局单次绑定）');
        }
        
        console.log('✓ 用户界面事件绑定完成');
    }

    /**
     * 验证数据完整性
     */
    async validateDataIntegrity() {
        console.log('🔍 开始数据完整性验证...');
        
        try {
            // 验证用户数据
            const users = await this.safeGetLocalStorage('blogUsers', []);
            console.log('用户数据验证:', users);
            
            // 检查管理员账户
            const hasAdmin = users.some(user => user.username === 'zcr');
            if (!hasAdmin) {
                console.log('⚠️ 数据完整性检查：管理员账户缺失');
                await this.initializeAdminAccount();
            } else {
                console.log('✅ 数据完整性检查：管理员账户存在');
            }
            
            // 验证文章数据
            const articles = await this.safeGetLocalStorage('blogArticles', []);
            console.log('文章数据验证:', articles.length, '篇文章');
            
            // 验证评论数据
            const comments = await this.safeGetLocalStorage('blogComments', []);
            console.log('评论数据验证:', comments.length, '条评论');
            
            // 创建数据备份
            await this.createDataBackup();
            
            console.log('✅ 数据完整性验证完成');
        } catch (error) {
            console.error('❌ 数据完整性验证失败:', error);
        }
    }

    /**
     * 创建数据备份
     */
    async createDataBackup() {
        try {
            const backup = {
                timestamp: new Date().toISOString(),
                users: await this.safeGetLocalStorage('blogUsers', []),
                articles: await this.safeGetLocalStorage('blogArticles', []),
                comments: await this.safeGetLocalStorage('blogComments', []),
                currentUser: await this.safeGetLocalStorage('blogUser', null)
            };
            
            // 保存备份到localStorage
            localStorage.setItem('blogDataBackup', JSON.stringify(backup));
            console.log('✅ 数据备份已创建');
            
            // 清理旧备份（保留最近5个）
            this.cleanupOldBackups();
            
        } catch (error) {
            console.warn('⚠️ 数据备份创建失败:', error);
        }
    }

    /**
     * 清理旧备份
     */
    cleanupOldBackups() {
        try {
            const backupKeys = Object.keys(localStorage).filter(key => key.startsWith('blogDataBackup_'));
            if (backupKeys.length > 5) {
                // 按时间戳排序，删除最旧的
                backupKeys.sort();
                const keysToDelete = backupKeys.slice(0, backupKeys.length - 5);
                keysToDelete.forEach(key => localStorage.removeItem(key));
                console.log(`✅ 清理了 ${keysToDelete.length} 个旧备份`);
            }
        } catch (error) {
            console.warn('⚠️ 清理旧备份失败:', error);
        }
    }

    /**
     * 绑定文章表单事件
     */
    async bindArticleFormEvents() {
        console.log('开始绑定文章表单事件...');
        
        // 绑定新建文章按钮
        const newArticleBtn = document.getElementById('new-article-btn');
        if (newArticleBtn) {
            const handler = (e) => {
                e.preventDefault();
                this.showEditorModal();
            };
            
            this.addSafeEventListener(newArticleBtn, 'click', handler);
            console.log('✓ 新建文章按钮事件绑定完成');
        } else {
            console.warn('⚠ 新建文章按钮未找到');
        }

        console.log('✓ 文章表单事件绑定完成');
    }

    /**
     * 强制显示登录界面（仅用于调试，不要在实际使用中调用）
     */
    forceShowLogin() {
        console.log('⚠️ 强制显示登录界面（调试功能）...');
        console.log('⚠️ 此函数会清除所有用户数据，请在调试时谨慎使用！');
        
        // 备份重要数据
        const userBackup = this.currentUser ? JSON.stringify(this.currentUser) : null;
        
        // 清除所有用户状态
        this.currentUser = null;
        this.users = [];
        this.articles = [];
        this.comments = [];
        this.editingArticleId = null;
        this.previousActiveElement = null;
        
        // 清除所有localStorage
        localStorage.removeItem('blogUser');
        localStorage.removeItem('blogUsers');
        localStorage.removeItem('blogArticles');
        localStorage.removeItem('blogComments');
        
        // 立即显示登录屏幕
        this.showLoginScreen();
        
        console.log('✅ 已强制显示登录界面');
        console.log('🔄 用户数据备份:', userBackup);
    }

    /**
     * 重置所有数据（调试功能）
     */
    async resetAllData() {
        console.log('🔄 开始重置所有数据...');
        
        try {
            // 清除localStorage
            localStorage.removeItem('blogUser');
            localStorage.removeItem('blogUsers');
            localStorage.removeItem('blogArticles');
            localStorage.removeItem('blogComments');
            
            // 重置内存数据
            this.currentUser = null;
            this.users = [];
            this.articles = [];
            this.comments = [];
            
            // 重新初始化
            await this.loadAllDataSafe();
            await this.initializeAdminAccount();
            await this.checkLoginStatus();
            
            this.showNotification('数据已重置，请重新登录', 'info', 4000); // 重要信息，显示4秒
            console.log('✅ 数据重置完成');
        } catch (error) {
            console.error('数据重置失败:', error);
            this.showNotification('数据重置失败', 'error', 5000); // 错误信息，显示5秒
        }
    }

    /**
     * 处理退出登录
     */
    handleLogout() {
        console.log('👋 用户退出登录');
        
        // 清除当前用户信息
        this.currentUser = null;
        const clearResult = this.safeSetLocalStorage('blogUser', null);
        console.log('清除用户状态结果:', clearResult);
        
        // 显示登录屏幕
        this.showLoginScreen();
        
        // 清除登录表单
        this.clearLoginForms();
        
        this.showNotification('已成功退出登录', 'info', 2500); // 简单确认，2.5秒
    }

    /**
     * 清除登录表单
     */
    clearLoginForms() {
        const loginInputs = [
            'username-input-screen',
            'password-input-screen',
            'register-username-input',
            'register-email-input',
            'register-password-input',
            'register-confirm-password-input'
        ];
        
        loginInputs.forEach(inputId => {
            const input = document.getElementById(inputId);
            if (input) {
                input.value = '';
            }
        });
    }

    /**
     * 检查登录状态
     */
    async checkLoginStatus() {
        console.log('🔍 检查登录状态...');
        
        // 步骤1: 重新加载用户数据
        this.users = await this.safeGetLocalStorage('blogUsers', []);
        
        // 步骤2: 验证管理员账户
        const hasAdmin = this.users.some(user => user.username === 'zcr');
        if (!hasAdmin) {
            console.log('⚠️ 管理员账户缺失，重新创建...');
            await this.initializeAdminAccount();
            this.users = await this.safeGetLocalStorage('blogUsers', []);
        }
        
        // 步骤3: 加载当前用户状态（带严格验证）
        const storedUser = await this.safeGetLocalStorage('blogUser', null);
        
        // 修复：严格的用户对象验证
        const isValidUser = this.validateUserObject(storedUser);
        
        if (isValidUser) {
            console.log('✅ 当前用户验证成功:', storedUser.username);
            
            // 检查会话是否过期
            if (storedUser.sessionExpiry) {
                if (Date.now() > storedUser.sessionExpiry) {
                    console.log('⏰ 会话已过期');
                    this.currentUser = null;
                    await this.safeSetLocalStorage('blogUser', null);
                    this.showLoginScreen();
                    this.showNotification('会话已过期，请重新登录', 'info', 4000);
                    return;
                }
            }
            
            // 验证用户是否仍然存在
            const userExists = this.users.some(user => user.username === storedUser.username);
            if (!userExists) {
                console.log('⚠️ 当前用户不存在于用户列表');
                this.currentUser = null;
                await this.safeSetLocalStorage('blogUser', null);
                this.showLoginScreen();
                return;
            }
            
            this.currentUser = storedUser;
            this.hideLoginScreen();
            
            if (this.currentUser.isAdmin) {
                this.showOwnerButtons();
            } else {
                this.showUserButtons();
            }
            
            this.showSection('home');
        } else {
            console.log('🔒 用户未登录或会话无效');
            this.currentUser = null;
            await this.safeSetLocalStorage('blogUser', null);
            this.showLoginScreen();
        }
        
        console.log('✅ 登录状态检查完成');
    }

    /**
     * 显示登录屏幕（修复：添加防抖和过渡效果）
     */
    showLoginScreen() {
        console.log('显示登录屏幕');
        
        // 记录显示时间
        this.loginScreenShowTime = Date.now();
        
        // 清除可能存在的隐藏定时器
        if (this.hideLoginTimer) {
            clearTimeout(this.hideLoginTimer);
            this.hideLoginTimer = null;
        }
        
        const loginScreen = document.getElementById('login-screen');
        const mainContent = document.querySelector('.main-content');
        const navbar = document.querySelector('.navbar');
        const footer = document.querySelector('.footer');
        
        // 添加过渡动画
        if (loginScreen) {
            loginScreen.style.opacity = '0';
            loginScreen.style.display = 'flex';
            loginScreen.offsetHeight; // 强制重绘
            loginScreen.style.opacity = '1';
            loginScreen.style.transition = 'opacity 0.3s ease-in-out';
        }
        
        if (mainContent) {
            mainContent.style.opacity = '1';
            mainContent.style.transition = 'opacity 0.3s ease-in-out';
            mainContent.style.opacity = '0';
            setTimeout(() => {
                mainContent.style.display = 'none';
            }, 300);
        }
        
        if (navbar) {
            navbar.style.display = 'none';
        }
        
        if (footer) {
            footer.style.display = 'none';
        }
    }

    /**
     * 隐藏登录屏幕（修复：添加防抖和最小显示时间）
     */
    hideLoginScreen() {
        console.log('隐藏登录屏幕');
        
        // 设置最小显示时间（防止闪退）
        const minDisplayTime = 500; // 至少显示500毫秒
        const elapsedTime = Date.now() - (this.loginScreenShowTime || 0);
        
        if (elapsedTime < minDisplayTime) {
            const delay = minDisplayTime - elapsedTime;
            console.log(`⏱️ 延迟 ${delay}ms 隐藏登录屏幕（防止闪退）`);
            
            if (this.hideLoginTimer) {
                clearTimeout(this.hideLoginTimer);
            }
            
            this.hideLoginTimer = setTimeout(() => {
                this.performHideLoginScreen();
            }, delay);
        } else {
            this.performHideLoginScreen();
        }
    }
    
    /**
     * 实际执行隐藏登录屏幕操作
     */
    performHideLoginScreen() {
        const loginScreen = document.getElementById('login-screen');
        const mainContent = document.querySelector('.main-content');
        const navbar = document.querySelector('.navbar');
        const footer = document.querySelector('.footer');
        
        if (loginScreen) {
            loginScreen.style.opacity = '0';
            setTimeout(() => {
                loginScreen.style.display = 'none';
            }, 300);
        }
        
        if (mainContent) {
            mainContent.style.display = 'block';
            mainContent.offsetHeight; // 强制重绘
            mainContent.style.opacity = '1';
        }
        
        if (navbar) {
            navbar.style.display = 'block';
        }
        
        if (footer) {
            footer.style.display = 'block';
        }
    }
    
    /**
     * 验证用户对象（修复：严格的用户对象验证）
     */
    validateUserObject(user) {
        if (!user || typeof user !== 'object') {
            console.log('❌ 用户对象无效: 不是对象');
            return false;
        }
        
        if (!user.username || typeof user.username !== 'string' || user.username.trim() === '') {
            console.log('❌ 用户对象无效: 用户名缺失');
            return false;
        }
        
        if (!user.loginTime || typeof user.loginTime !== 'number') {
            console.log('❌ 用户对象无效: 登录时间缺失');
            return false;
        }
        
        // 检查登录时间是否太旧（超过30天视为过期）
        const thirtyDaysInMs = 30 * 24 * 60 * 60 * 1000;
        if (Date.now() - user.loginTime > thirtyDaysInMs) {
            console.log('❌ 用户对象无效: 登录时间过期');
            return false;
        }
        
        // 检查必要字段
        const requiredFields = ['username', 'loginTime', 'isAdmin'];
        for (const field of requiredFields) {
            if (!(field in user)) {
                console.log(`❌ 用户对象无效: 缺少必要字段 ${field}`);
                return false;
            }
        }
        
        console.log('✅ 用户对象验证通过:', user.username);
        return true;
    }

    /**
     * 显示管理员按钮
     */
    showOwnerButtons() {
        const writeBtn = document.getElementById('write-article-btn');
        const myArticlesLink = document.querySelector('.my-articles-link');
        const adminDashboardLink = document.querySelector('.admin-dashboard-link');
        const logoutBtn = document.getElementById('logout-btn');
        
        if (writeBtn) writeBtn.style.display = 'inline-flex';
        if (myArticlesLink) myArticlesLink.style.display = 'flex';
        if (adminDashboardLink) adminDashboardLink.style.display = 'flex';
        if (logoutBtn) logoutBtn.style.display = 'inline-flex';
        console.log('✓ 显示管理员按钮');
    }

    /**
     * 显示普通用户按钮
     */
    showUserButtons() {
        const writeBtn = document.getElementById('write-article-btn');
        const myArticlesLink = document.querySelector('.my-articles-link');
        const adminDashboardLink = document.querySelector('.admin-dashboard-link');
        const logoutBtn = document.getElementById('logout-btn');
        
        if (writeBtn) writeBtn.style.display = 'none';
        if (myArticlesLink) myArticlesLink.style.display = 'none';
        if (adminDashboardLink) adminDashboardLink.style.display = 'none';
        if (logoutBtn) logoutBtn.style.display = 'inline-flex';
        console.log('✓ 显示普通用户按钮');
    }

    /**
     * 更新UI
     */
    updateUI() {
        console.log('更新UI...');
        this.updateStats();
        this.renderRecentArticles();
    }

    /**
     * 监控阅读量统计准确性
     */
    validateViewStats() {
        console.log('🔍 验证阅读量统计准确性...');
        
        const issues = [];
        
        // 检查1：所有文章都有 views 字段
        this.articles.forEach(article => {
            if (article.views === undefined || article.views === null) {
                issues.push(`文章 "${article.title}" 缺少 views 字段`);
                article.views = 0; // 修复
            }
        });
        
        // 检查2：汇总统计是否匹配
        const totalFromArticles = this.articles.reduce((sum, a) => sum + (a.views || 0), 0);
        const totalViewsElement = document.getElementById('total-views');
        const totalFromStats = totalViewsElement ? parseInt(totalViewsElement.textContent || 0) : 0;
        
        if (totalViewsElement && totalFromArticles !== totalFromStats) {
            issues.push(`汇总统计不匹配: 文章总和=${totalFromArticles}, 首页显示=${totalFromStats}`);
            // 修复：更新显示
            totalViewsElement.textContent = totalFromArticles;
        }
        
        if (issues.length > 0) {
            console.warn('⚠️ 发现阅读量统计问题:', issues);
            this.showNotification(`检测到 ${issues.length} 个阅读量统计问题`, 'warning', 5000);
        } else {
            console.log('✅ 阅读量统计验证通过');
        }
        
        return issues;
    }
    
    /**
     * 更新统计数据
     */
    updateStats() {
        const totalArticles = document.getElementById('total-articles');
        const totalCategories = document.getElementById('total-categories');
        const totalViews = document.getElementById('total-views');

        if (totalArticles) totalArticles.textContent = this.articles.length;
        
        if (totalCategories) {
            const categories = new Set(this.articles.map(article => article.category));
            totalCategories.textContent = categories.size;
        }

        if (totalViews) {
            const total = this.articles.reduce((sum, article) => sum + (article.views || 0), 0);
            totalViews.textContent = total;
        }
    }

    /**
     * 渲染最新文章
     */
    renderRecentArticles() {
        const container = document.getElementById('recent-articles');
        if (!container) {
            console.warn('⚠ 最新文章容器未找到');
            return;
        }

        const recentArticles = this.articles
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .slice(0, 6);

        if (recentArticles.length === 0) {
            container.innerHTML = '<div class="no-articles"><p>暂无文章，快来发布第一篇吧！</p></div>';
            return;
        }

        container.innerHTML = recentArticles.map(article => this.createArticleCard(article)).join('');
    }

    /**
     * 创建文章卡片
     */
    createArticleCard(article) {
        const date = new Date(article.createdAt).toLocaleDateString('zh-CN');
        const excerpt = article.content.substring(0, 150) + (article.content.length > 150 ? '...' : '');
        
        return `
            <div class="article-card" onclick="blogApp.showArticle('${article.id}')">
                <div class="article-card-header">
                    <h3 class="article-card-title">${this.escapeHtml(article.title)}</h3>
                    <div class="article-card-meta">
                        <span class="article-card-category">${this.getCategoryName(article.category)}</span>
                        <span><i class="fas fa-calendar"></i> ${date}</span>
                        <span><i class="fas fa-eye"></i> ${article.views || 0}</span>
                    </div>
                </div>
                <div class="article-card-excerpt">
                    ${this.escapeHtml(excerpt)}
                </div>
                <div class="article-card-footer">
                    <span>阅读更多</span>
                    <i class="fas fa-arrow-right"></i>
                </div>
            </div>
        `;
    }

    /**
     * HTML转义
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * 获取分类名称
     */
    getCategoryName(category) {
        const categoryNames = {
            'tech': '技术',
            'life': '生活',
            'thoughts': '思考',
            'other': '其他'
        };
        return categoryNames[category] || category;
    }

    /**
     * 显示指定区域
     */
    showSection(sectionId) {
        console.log('显示区域:', sectionId);
        
        // 隐藏所有区域
        document.querySelectorAll('.content-section').forEach(section => {
            section.classList.remove('active');
        });

        // 显示目标区域
        const targetSection = document.getElementById(sectionId);
        if (targetSection) {
            targetSection.classList.add('active');
            console.log(`✓ 区域 ${sectionId} 已激活`);
        } else {
            console.error(`❌ 目标区域 ${sectionId} 未找到`);
            return;
        }

        // 根据区域类型执行相应操作
        switch (sectionId) {
            case 'home':
                this.renderRecentArticles();
                this.updateStats();
                break;
            case 'articles':
                this.renderArticles();
                break;
            case 'my-articles':
                if (this.currentUser && this.currentUser.isAdmin) {
                    this.renderMyArticles();
                } else {
                    console.log('⚠️ 非管理员用户无法访问我的文章页面');
                    this.showSection('home');
                    this.showNotification('只有管理员可以访问此页面', 'warning', 4000); // 警告信息，4秒
                }
                break;
            case 'admin-dashboard':
                if (this.currentUser && this.currentUser.isAdmin) {
                    this.renderAdminDashboard();
                } else {
                    console.log('⚠️ 非管理员用户无法访问后台管理页面');
                    this.showSection('home');
                    this.showNotification('只有管理员可以访问此页面', 'warning');
                }
                break;
        }
    }

    /**
     * 渲染我的文章列表
     */
    renderMyArticles() {
        console.log('📝 渲染我的文章列表...');
        
        const tbody = document.getElementById('my-articles-table-body');
        if (!tbody) {
            console.error('❌ 我的文章表格主体未找到');
            return;
        }

        // 获取当前用户的文章（假设当前用户就是管理员）
        const myArticles = this.articles;
        
        if (myArticles.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 20px; color: #666;">暂无文章，快来发布第一篇吧！</td></tr>';
            return;
        }

        tbody.innerHTML = myArticles
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .map(article => `
                <tr>
                    <td>${this.escapeHtml(article.title)}</td>
                    <td>${this.getCategoryName(article.category)}</td>
                    <td>${new Date(article.createdAt).toLocaleDateString('zh-CN')}</td>
                    <td>${article.views || 0}</td>
                    <td>
                        <button onclick="blogApp.showEditorModal('${article.id}')" class="btn btn-sm btn-primary">
                            <i class="fas fa-edit"></i> 编辑
                        </button>
                        <button onclick="blogApp.deleteArticle('${article.id}')" class="btn btn-sm btn-danger" style="margin-left: 5px;">
                            <i class="fas fa-trash"></i> 删除
                        </button>
                    </td>
                </tr>
            `).join('');

        console.log(`✅ 我的文章列表已渲染，共 ${myArticles.length} 篇文章`);
    }

    /**
     * 渲染管理员面板
     */
    renderAdminDashboard() {
        console.log('⚙️ 渲染管理员面板...');
        
        // 更新统计数据
        const totalArticlesAdmin = document.getElementById('total-articles-admin');
        const totalUsersAdmin = document.getElementById('total-users-admin');
        const totalCommentsAdmin = document.getElementById('total-comments-admin');

        if (totalArticlesAdmin) totalArticlesAdmin.textContent = this.articles.length;
        if (totalUsersAdmin) totalUsersAdmin.textContent = this.users.length;
        if (totalCommentsAdmin) totalCommentsAdmin.textContent = this.comments.length;
        
        console.log('✅ 管理员面板已渲染');
    }

    /**
     * 删除文章
     */
    deleteArticle(articleId) {
        console.log('🗑️ 删除文章:', articleId);
        
        if (confirm('确定要删除这篇文章吗？')) {
            this.articles = this.articles.filter(article => article.id !== articleId);
            this.safeSetLocalStorage('blogArticles', this.articles);
            
            this.showNotification('文章已删除', 'success', 3000); // 操作成功，3秒
            
            // 刷新当前页面
            this.renderMyArticles();
            this.renderRecentArticles();
            this.updateStats();
        }
    }

    /**
     * 设置活跃的导航链接
     */
    setActiveNavLink(activeLink) {
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
        });
        if (activeLink) {
            activeLink.classList.add('active');
        }
    }

    /**
     * 设置活跃的过滤标签
     */
    setActiveFilterTab(activeTab) {
        document.querySelectorAll('.filter-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        activeTab.classList.add('active');
    }

    /**
     * 渲染文章列表
     */
    renderArticles() {
        const container = document.getElementById('articles-container');
        if (!container) {
            console.warn('⚠ 文章列表容器未找到');
            return;
        }

        let filteredArticles = this.articles;

        // 应用过滤器
        if (this.currentFilter !== 'all') {
            filteredArticles = filteredArticles.filter(article => article.category === this.currentFilter);
        }

        // 应用搜索
        if (this.searchTerm) {
            filteredArticles = filteredArticles.filter(article =>
                article.title.toLowerCase().includes(this.searchTerm) ||
                article.content.toLowerCase().includes(this.searchTerm)
            );
        }

        // 排序
        filteredArticles.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        if (filteredArticles.length === 0) {
            container.innerHTML = '<div class="no-articles"><p>没有找到相关文章</p></div>';
            return;
        }

        container.innerHTML = filteredArticles.map(article => this.createArticleListItem(article)).join('');
    }

    /**
     * 创建文章列表项
     */
    createArticleListItem(article) {
        const date = new Date(article.createdAt).toLocaleDateString('zh-CN');
        const excerpt = article.content.substring(0, 200) + (article.content.length > 200 ? '...' : '');
        
        return `
            <div class="article-list-item" onclick="blogApp.showArticle('${article.id}')">
                <h3 class="article-list-title">${this.escapeHtml(article.title)}</h3>
                <div class="article-list-meta">
                    <span class="article-category">${this.getCategoryName(article.category)}</span>
                    <span><i class="fas fa-calendar"></i> ${date}</span>
                    <span><i class="fas fa-eye"></i> ${article.views || 0}</span>
                </div>
                <p class="article-list-excerpt">${this.escapeHtml(excerpt)}</p>
            </div>
        `;
    }

    /**
     * 安全地增加阅读量（带防重复机制）- 修复版
     */
    async incrementViewsSafely(articleId) {
        // 检查是否在当前会话中已读过
        const sessionKey = `viewed_${articleId}`;
        const hasViewed = sessionStorage.getItem(sessionKey);
        
        if (hasViewed) {
            console.log(`文章 ${articleId} 在当前会话中已读过，不增加阅读量`);
            return { increased: false, updatedArticle: null };
        }
        
        // 标记为已读（会话级）
        sessionStorage.setItem(sessionKey, 'true');
        
        // 使用锁机制防止并发更新，并获取更新后的文章
        const updatedArticle = await this.updateViewsWithLock(articleId);
        
        if (updatedArticle) {
            // 更新内存中的文章数据
            const articleIndex = this.articles.findIndex(a => a.id === articleId);
            if (articleIndex !== -1) {
                this.articles[articleIndex] = updatedArticle;
            }
            console.log(`✅ 文章 ${articleId} 阅读量已更新为: ${updatedArticle.views}`);
            return { increased: true, updatedArticle };
        }
        
        return { increased: false, updatedArticle: null };
    }
    
    /**
     * 使用锁机制更新阅读量 - 修复版
     */
    async updateViewsWithLock(articleId) {
        // 创建唯一锁标识
        const lockId = `view_lock_${articleId}`;
        const lockTimestamp = Date.now();
        
        // 尝试获取锁
        const existingLock = localStorage.getItem(lockId);
        if (existingLock && (Date.now() - parseInt(existingLock)) < 1000) {
            // 1秒内已有更新，跳过
            console.log(`文章 ${articleId} 更新频率过高，跳过本次更新`);
            return null;
        }
        
        // 设置锁
        localStorage.setItem(lockId, lockTimestamp.toString());
        
        try {
            // 重新读取最新数据（防止数据不一致）
            const storedArticles = await this.safeGetLocalStorage('blogArticles', []);
            const currentArticleIndex = storedArticles.findIndex(a => a.id === articleId);
            
            if (currentArticleIndex !== -1) {
                // 更新阅读量
                storedArticles[currentArticleIndex].views = (storedArticles[currentArticleIndex].views || 0) + 1;
                
                // 保存到 localStorage
                await this.safeSetLocalStorage('blogArticles', storedArticles);
                
                // 返回更新后的文章
                return storedArticles[currentArticleIndex];
            }
        } finally {
            // 释放锁（延迟释放，防止立即重复）
            setTimeout(() => {
                localStorage.removeItem(lockId);
            }, 1000);
        }
        
        return null;
    }
    
    /**
     * 统一更新所有阅读量显示
     */
    async syncAllViewDisplays() {
        console.log('🔄 同步所有阅读量显示...');
        
        // 重新加载最新数据
        this.articles = await this.safeGetLocalStorage('blogArticles', []);
        
        // 并行更新所有显示位置
        await Promise.all([
            this.updateStats(),
            this.renderRecentArticles(),
            this.renderArticles(),
            this.currentUser?.isAdmin ? this.renderMyArticles() : Promise.resolve(),
            this.currentUser?.isAdmin ? this.renderAdminDashboard() : Promise.resolve()
        ]);
        
        console.log('✅ 所有阅读量显示已同步');
    }
    
    /**
     * 显示文章详情（修复：使用更新后的数据）
     */
    async showArticle(articleId) {
        const article = this.articles.find(a => a.id === articleId);
        if (!article) {
            console.error(`❌ 文章 ${articleId} 未找到`);
            this.showNotification('文章未找到', 'error', 5000);
            return;
        }

        // 安全地增加阅读量（防重复），并获取更新后的文章
        const { increased, updatedArticle } = await this.incrementViewsSafely(articleId);
        
        // 使用更新后的文章数据（如果有），否则使用原文章数据
        const displayArticle = updatedArticle || article;
        
        if (increased) {
            // 同步更新所有显示
            await this.syncAllViewDisplays();
        }

        // 更新模态框内容（使用 displayArticle，确保显示的是最新数据）
        const titleElement = document.getElementById('modal-article-title');
        const dateElement = document.getElementById('modal-article-date');
        const categoryElement = document.getElementById('modal-article-category');
        const viewsElement = document.getElementById('modal-article-views');
        const contentElement = document.getElementById('modal-article-content');

        if (titleElement) titleElement.textContent = displayArticle.title;
        if (dateElement) dateElement.innerHTML = '<i class="fas fa-calendar"></i> ' + new Date(displayArticle.createdAt).toLocaleDateString('zh-CN');
        if (categoryElement) categoryElement.innerHTML = '<i class="fas fa-tag"></i> ' + this.getCategoryName(displayArticle.category);
        // ✅ 修复：使用 displayArticle.views（更新后的值）
        if (viewsElement) viewsElement.innerHTML = '<i class="fas fa-eye"></i> ' + displayArticle.views + ' 次阅读';
        if (contentElement) contentElement.innerHTML = this.formatArticleContent(displayArticle.content);

        // 设置文章ID到评论表单（必须在bindCommentEvents之前）
        const commentForm = document.getElementById('comment-form');
        if (commentForm) {
            commentForm.dataset.articleId = articleId;
            console.log('✅ 已设置文章ID到评论表单:', articleId);
        } else {
            console.error('❌ 评论表单未找到，无法设置articleId');
        }
        
        // 加载并渲染评论
        this.renderComments(articleId);
        
        // 绑定评论相关事件
        this.bindCommentEvents();
        
        // 重置评论表单
        const authorInput = document.getElementById('comment-author-input');
        const contentInput = document.getElementById('comment-content-input');
        if (authorInput) {
            if (this.currentUser) {
                // 登录用户自动填充用户名
                if (this.currentUser.isAdmin) {
                    // 管理员显示"管理员"且只读
                    authorInput.value = '管理员';
                    authorInput.readOnly = true;
                } else {
                    // 普通登录用户显示注册用户名且只读
                    authorInput.value = this.currentUser.username || '匿名用户';
                    authorInput.readOnly = true;
                }
            } else {
                // 未登录用户需要手动输入昵称
                authorInput.value = '';
                authorInput.readOnly = false;
            }
        }
        if (contentInput) {
            contentInput.value = '';
        }
        
        // 隐藏评论表单
        const commentFormContainer = document.getElementById('comment-form-container');
        const toggleCommentsBtn = document.getElementById('toggle-comments-btn');
        if (commentFormContainer) {
            commentFormContainer.style.display = 'none';
        }
        if (toggleCommentsBtn) {
            toggleCommentsBtn.innerHTML = '<i class="fas fa-comments"></i> 写评论';
        }
        
        // 显示评论区域
        const commentsSection = document.querySelector('.comments-section');
        if (commentsSection) {
            commentsSection.style.display = 'block';
        }

        // 显示模态框
        const modal = document.getElementById('article-modal');
        this.showModal(modal);
    }

    /**
     * 格式化文章内容
     */
    formatArticleContent(content) {
        return this.escapeHtml(content)
            .replace(/\n/g, '<br>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/`(.*?)`/g, '<code>$1</code>')
            .replace(/### (.*?)\n/g, '<h3>$1</h3>')
            .replace(/## (.*?)\n/g, '<h2>$1</h2>')
            .replace(/# (.*?)\n/g, '<h1>$1</h1>');
    }

    /**
     * 显示模态框
     */
    showModal(modal) {
        if (modal) {
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
            this.focusModalContent(modal);
            this.previousActiveElement = document.activeElement;
        }
    }

    /**
     * 关闭模态框
     */
    closeModal(modal) {
        if (modal) {
            modal.classList.remove('active');
            document.body.style.overflow = '';
            
            if (this.previousActiveElement) {
                this.previousActiveElement.focus();
                this.previousActiveElement = null;
            }
        }
    }

    /**
     * 聚焦模态框内容
     */
    focusModalContent(modal) {
        if (!modal) return;
        
        const focusableElements = modal.querySelectorAll(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        
        if (focusableElements.length > 0) {
            const titleInput = modal.querySelector('input[type="text"], input[placeholder*="标题"], input[placeholder*="title"]');
            if (titleInput) {
                titleInput.focus();
            } else {
                focusableElements[0].focus();
            }
        }
    }

    /**
     * 显示编辑器模态框
     */
    showEditorModal(articleId = null) {
        console.log('显示编辑器模态框:', articleId);
        
        this.editingArticleId = articleId;
        
        const modal = document.getElementById('editor-modal');
        const titleInput = document.getElementById('article-title-input');
        const categorySelect = document.getElementById('article-category-select');
        const contentEditor = document.getElementById('article-content-editor');
        const modalTitle = document.getElementById('editor-modal-title');
        
        if (!modal) {
            console.error('❌ editor-modal元素未找到');
            this.showNotification('编辑器模态框缺失', 'error', 5000); // 严重错误，5秒
            return;
        }
        
        if (articleId) {
            const article = this.articles.find(a => a.id === articleId);
            if (article) {
                modalTitle.textContent = '编辑文章';
                if (titleInput) titleInput.value = article.title;
                if (categorySelect) categorySelect.value = article.category;
                if (contentEditor) contentEditor.innerHTML = this.htmlToEditorFormat(article.content);
            }
        } else {
            modalTitle.textContent = '新建文章';
            if (titleInput) titleInput.value = '';
            if (categorySelect) categorySelect.value = '';
            if (contentEditor) contentEditor.innerHTML = '';
        }
        
        this.showModal(modal);
        this.initRichEditor();
        
        // 聚焦到标题输入框
        setTimeout(() => {
            if (titleInput) {
                titleInput.focus();
            }
        }, 100);
    }

    /**
     * 关闭编辑器模态框
     */
    closeEditorModal() {
        this.editingArticleId = null;
        this.closeModal(document.getElementById('editor-modal'));
    }

    /**
     * 保存文章（添加防止重复提交保护）
     */
    saveArticle() {
        const saveButton = document.getElementById('save-article-btn');
        const titleInput = document.getElementById('article-title-input');
        const categorySelect = document.getElementById('article-category-select');
        const contentEditor = document.getElementById('article-content-editor');
        
        if (!titleInput || !categorySelect || !contentEditor) {
            console.error('❌ 文章编辑器元素缺失');
            this.showNotification('编辑器元素缺失', 'error', 5000); // 严重错误，5秒
            return;
        }
        
        // 防止重复提交：如果按钮已禁用，则直接返回
        if (saveButton && saveButton.disabled) {
            console.warn('⚠️ 保存操作正在进行中，请稍候...');
            return;
        }
        
        // 禁用保存按钮，防止重复点击
        if (saveButton) {
            saveButton.disabled = true;
            saveButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 保存中...';
        }
        
        const title = titleInput.value.trim();
        const category = categorySelect.value;
        const content = contentEditor.innerText.trim();
        
        if (!title || !category || !content) {
            this.showNotification('请填写所有必填字段', 'error', 4000); // 表单验证错误，4秒
            // 恢复按钮状态
            if (saveButton) {
                saveButton.disabled = false;
                saveButton.innerHTML = '保存文章';
            }
            return;
        }
        
        let article;
        if (this.editingArticleId) {
            // 编辑现有文章
            article = this.articles.find(a => a.id === this.editingArticleId);
            if (article) {
                article.title = title;
                article.category = category;
                article.content = content;
                article.updatedAt = new Date().toISOString();
                this.showNotification('文章更新成功！', 'success', 3000); // 操作成功，3秒
            }
        } else {
            // 新建文章
            article = {
                id: this.generateId(),
                title,
                category,
                content,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                views: 0
            };
            this.articles.push(article);
            this.showNotification('文章发布成功！', 'success', 3000); // 操作成功，3秒
        }
        
        // 保存数据
        this.safeSetLocalStorage('blogArticles', this.articles);
        
        // 重要：确保用户状态得到保持
        if (this.currentUser) {
            this.safeSetLocalStorage('blogUser', this.currentUser);
            console.log('🔒 用户状态已保护:', this.currentUser.username);
        }
        
        // 恢复按钮状态（在关闭模态框之前）
        if (saveButton) {
            saveButton.disabled = false;
            saveButton.innerHTML = '保存文章';
        }
        
        // 关闭模态框
        this.closeEditorModal();
        
        // 更新界面，但不重新检查登录状态
        this.updateUI();
    }

    /**
     * HTML转编辑器格式（简化版）
     */
    htmlToEditorFormat(html) {
        // 简单的HTML转纯文本，保持基本格式
        return html
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<\/div>/gi, '\n')
            .replace(/<\/p>/gi, '\n')
            .replace(/<[^>]*>/g, '');
    }

    /**
     * 初始化富文本编辑器
     */
    initRichEditor() {
        const contentEditor = document.getElementById('article-content-editor');
        if (!contentEditor) return;
        
        // 绑定编辑器事件
        const toolbar = document.getElementById('editor-toolbar');
        if (toolbar) {
            const buttons = toolbar.querySelectorAll('.toolbar-btn');
            buttons.forEach(button => {
                const command = button.dataset.command;
                if (command) {
                    button.addEventListener('click', (e) => {
                        e.preventDefault();
                        this.executeEditorCommand(command);
                    });
                }
            });
        }
        
        // 绑定取消按钮事件
        const cancelBtn = document.getElementById('cancel-edit-btn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                this.closeEditorModal();
            });
        }
        
        console.log('✓ 富文本编辑器初始化完成');
    }

    /**
     * 执行编辑器命令
     */
    executeEditorCommand(command) {
        const contentEditor = document.getElementById('article-content-editor');
        if (!contentEditor) return;
        
        contentEditor.focus();
        
        switch (command) {
            case 'bold':
                document.execCommand('bold', false, null);
                break;
            case 'italic':
                document.execCommand('italic', false, null);
                break;
            case 'underline':
                document.execCommand('underline', false, null);
                break;
            case 'h1':
                document.execCommand('formatBlock', false, 'h1');
                break;
            case 'h2':
                document.execCommand('formatBlock', false, 'h2');
                break;
            case 'h3':
                document.execCommand('formatBlock', false, 'h3');
                break;
            case 'insertUnorderedList':
                document.execCommand('insertUnorderedList', false, null);
                break;
            case 'insertOrderedList':
                document.execCommand('insertOrderedList', false, null);
                break;
            case 'blockquote':
                document.execCommand('formatBlock', false, 'blockquote');
                break;
            case 'code':
                // 插入代码块标记
                const selection = window.getSelection();
                if (selection.rangeCount > 0) {
                    const range = selection.getRangeAt(0);
                    const codeElement = document.createElement('code');
                    codeElement.textContent = selection.toString();
                    range.deleteContents();
                    range.insertNode(codeElement);
                }
                break;
            default:
                console.log('未支持的编辑器命令:', command);
        }
        
        // 更新工具栏状态
        this.updateToolbarState();
    }

    /**
     * 更新工具栏状态
     */
    updateToolbarState() {
        const toolbar = document.getElementById('editor-toolbar');
        if (!toolbar) return;
        
        const buttons = toolbar.querySelectorAll('.toolbar-btn');
        buttons.forEach(button => {
            const command = button.dataset.command;
            if (command) {
                const isActive = document.queryCommandState(command);
                button.classList.toggle('active', isActive);
                button.setAttribute('aria-pressed', isActive);
            }
        });
    }

    /**
     * 销毁实例（清理资源）
     */
    destroy() {
        console.log('销毁blogApp实例...');
        
        // 清理事件监听器
        this.cleanupEventListeners();
        
        // 清除数据
        this.currentUser = null;
        this.users = [];
        this.articles = [];
        this.comments = [];
        this.editingArticleId = null;
        this.previousActiveElement = null;
        
        console.log('blogApp实例已销毁');
    }

    /**
     * 处理登录屏幕登录
     */
    async handleLoginScreen() {
        console.log('处理登录屏幕登录...');
        
        const usernameInput = document.getElementById('username-input-screen');
        const passwordInput = document.getElementById('password-input-screen');
        
        if (!usernameInput || !passwordInput) {
            console.error('❌ 登录输入框未找到');
            this.showNotification('登录表单元素缺失', 'error', 5000); // 严重错误，5秒
            return;
        }
        
        const username = usernameInput.value.trim();
        const password = passwordInput.value;

        console.log('登录尝试:', { username, passwordLength: password.length });

        // 输入验证
        if (!username || !password) {
            this.showNotification('请输入用户名和密码', 'error', 4000); // 验证错误，4秒
            return;
        }

        if (password.length < 6) {
            this.showNotification('密码长度至少6位', 'error', 4000); // 验证错误，4秒
            passwordInput.focus();
            return;
        }

        // 登录前数据完整性验证
        console.log('🔍 登录前进行数据完整性验证...');
        await this.validateDataIntegrity();
        
        // 重新同步用户数据，确保最新
        this.users = await this.safeGetLocalStorage('blogUsers', []);
        console.log('🔍 验证后的用户数据:', this.users);
        
        // 特别检查管理员账户
        const adminCheck = this.users.find(u => u.username === 'zcr');
        if (!adminCheck && username === 'zcr') {
            console.log('⚠️ 管理员账户缺失，重新创建...');
            await this.initializeAdminAccount();
            this.users = await this.safeGetLocalStorage('blogUsers', []);
            console.log('✅ 管理员账户已重新创建');
        }

        // 重新同步用户数据
        this.users = await this.safeGetLocalStorage('blogUsers', []);
        console.log('🔍 重新加载的用户数据:', this.users);
        console.log('🔍 查找用户名:', username);
        
        // 查找用户
        const user = this.users.find(u => u.username === username);
        console.log('🔍 找到的用户:', user);
        
        if (!user) {
            console.log('❌ 登录失败: 用户不存在');
            console.log('当前用户数组内容:', this.users.map(u => ({username: u.username, isAdmin: u.isAdmin})));
            this.showNotification('用户名不存在', 'error', 4000); // 登录错误，4秒
            passwordInput.value = '';
            passwordInput.focus();
            return;
        }

        // 检查账户是否被锁定
        if (user.lockedUntil && new Date() < new Date(user.lockedUntil)) {
            const remainingTime = Math.ceil((new Date(user.lockedUntil) - new Date()) / 60000);
            this.showNotification(`账户已被锁定，请在 ${remainingTime} 分钟后重试`, 'error', 0, false); // 重要安全提示，不自动关闭
            passwordInput.value = '';
            passwordInput.focus();
            return;
        }

        // 验证密码
        const hashedPassword = this.hashPassword(password);
        if (user.password === hashedPassword) {
            console.log('🎉 密码验证成功，开始登录流程...');
            
            // 登录成功，重置尝试次数
            user.loginAttempts = 0;
            user.lockedUntil = null;
            user.lastLogin = new Date().toISOString();
            
            this.currentUser = {
                id: user.id,
                username: user.username,
                isAdmin: user.isAdmin,
                email: user.email,
                loginTime: new Date().toISOString(),
                sessionExpiry: Date.now() + (24 * 60 * 60 * 1000) // 24小时后过期
            };
            
            console.log('📝 保存用户数据...');
            
            // 先更新用户数组，再保存当前用户状态
            await this.safeSetLocalStorage('blogUsers', this.users);
            const saveUserResult = await this.safeSetLocalStorage('blogUser', this.currentUser);
            
            console.log('✅ 数据保存成功');
            console.log('用户数据保存结果:', saveUserResult);
            console.log('当前用户状态:', this.currentUser);
            console.log('blogUser已保存到localStorage');
            console.log('⏰ 会话过期时间:', new Date(this.currentUser.sessionExpiry).toLocaleString());
            
            // 立即更新UI
            this.hideLoginScreen();
            
            if (this.currentUser.isAdmin) {
                this.showOwnerButtons();
                console.log('👑 显示管理员界面');
            } else {
                this.showUserButtons();
                console.log('👤 显示普通用户界面');
            }
            
            this.showSection('home');
            this.showNotification(`${this.currentUser.isAdmin ? '管理员' : '用户'}登录成功！`, 'success', 2500); // 登录成功，2.5秒
            
            console.log('🎉 登录流程完成');
        } else {
            // 登录失败，增加尝试次数
            user.loginAttempts = (user.loginAttempts || 0) + 1;
            
            // 如果尝试次数过多，锁定账户
            if (user.loginAttempts >= 5) {
                user.lockedUntil = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 锁定30分钟
                this.showNotification('登录尝试次数过多，账户已被锁定30分钟', 'error', 0, false); // 重要安全提示，不自动关闭
                console.log(`❌ 账户 ${username} 已被锁定`);
            } else {
                const remainingAttempts = 5 - user.loginAttempts;
                this.showNotification(`密码错误，还可尝试 ${remainingAttempts} 次`, 'error', 4000); // 安全警告，4秒
                console.log(`❌ 登录失败: 密码错误，剩余尝试次数: ${remainingAttempts}`);
            }
            
            passwordInput.value = '';
            passwordInput.focus();
            
            // 保存用户数据
            await this.safeSetLocalStorage('blogUsers', this.users);
        }
    }

    /**
     * 密码加密哈希函数 (简化版，实际项目中应使用bcrypt等)
     */
    hashPassword(password) {
        let hash = 0;
        for (let i = 0; i < password.length; i++) {
            const char = password.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return Math.abs(hash).toString(16);
    }

    /**
     * 初始化管理员账户
     */
    async initializeAdminAccount() {
        console.log('🔧 开始初始化管理员账户...');
        
        // 强制重新加载用户数据以确保最新
        this.users = await this.safeGetLocalStorage('blogUsers', []);
        console.log('当前用户数据:', this.users);
        
        const adminAccount = {
            id: 'admin-original',
            username: 'zcr',
            password: this.hashPassword('20120508'), // 管理员密码：20120508
            isAdmin: true,
            email: 'zcr@blog.com',
            createdAt: new Date().toISOString(),
            lastLogin: null,
            loginAttempts: 0,
            lockedUntil: null
        };

        // 检查管理员账户是否存在
        const existingAdmin = this.users.find(user => user.username === 'zcr');
        
        if (!existingAdmin) {
            console.log('🔍 管理员账户不存在，开始创建...');
            
            // 如果存在旧的管理员账户（admin），先删除
            const oldAdmin = this.users.find(user => user.username === 'admin');
            if (oldAdmin) {
                this.users = this.users.filter(user => user.username !== 'admin');
                console.log('✅ 已删除旧管理员账户');
            }
            
            // 添加新管理员账户
            this.users.push(adminAccount);
            const saveResult = await this.safeSetLocalStorage('blogUsers', this.users);
            
            if (saveResult) {
                console.log('✅ 新管理员账户 zcr 已创建并保存');
            } else {
                console.error('❌ 保存管理员账户失败');
                // 如果保存失败，至少保持内存中的数据
            }
        } else {
            console.log('🔍 管理员账户已存在，检查数据完整性...');
            
            // 检查并更新必要字段
            let needsUpdate = false;
            
            // 检查密码
            if (existingAdmin.password !== this.hashPassword('20120508')) {
                existingAdmin.password = this.hashPassword('20120508');
                needsUpdate = true;
                console.log('🔄 密码需要更新');
            }
            
            // 检查必要字段
            const requiredFields = ['id', 'isAdmin', 'email', 'createdAt'];
            for (const field of requiredFields) {
                if (!(field in existingAdmin)) {
                    existingAdmin[field] = adminAccount[field];
                    needsUpdate = true;
                    console.log(`🔄 添加缺失字段: ${field}`);
                }
            }
            
            if (needsUpdate) {
                const saveResult = await this.safeSetLocalStorage('blogUsers', this.users);
                if (saveResult) {
                    console.log('✅ 管理员账户数据已更新');
                } else {
                    console.error('❌ 更新管理员账户失败');
                }
            } else {
                console.log('✅ 管理员账户数据完整，无需更新');
            }
        }
        
        // 最终验证
        const finalAdminCheck = this.users.find(user => user.username === 'zcr');
        if (finalAdminCheck) {
            console.log('✅ 管理员账户验证成功:', finalAdminCheck);
        } else {
            console.error('❌ 管理员账户验证失败');
        }
        
        console.log('✅ 最终用户数据:', this.users);
        return this.users;
    }

    /**
     * 安全的localStorage设置
     */
    async safeSetLocalStorage(key, value) {
        try {
            // 检查localStorage是否可用
            if (typeof localStorage === 'undefined' || localStorage === null) {
                console.warn(`localStorage不可用 (${key}): 数据将丢失`);
                return false;
            }
            
            // 尝试保存数据
            const serialized = JSON.stringify(value);
            localStorage.setItem(key, serialized);
            console.log(`localStorage保存成功 (${key}):`, value);
            return true;
        } catch (error) {
            console.warn(`localStorage保存失败 (${key}):`, error);
            console.log('尝试的数据:', value);
            return false;
        }
    }

    /**
     * 处理注册
     */
    handleRegisterScreen() {
        const usernameInput = document.getElementById('register-username-input');
        const emailInput = document.getElementById('register-email-input');
        const passwordInput = document.getElementById('register-password-input');
        const confirmPasswordInput = document.getElementById('register-confirm-password-input');
        
        const username = usernameInput.value.trim();
        const email = emailInput.value.trim();
        const password = passwordInput.value;
        const confirmPassword = confirmPasswordInput.value;

        // 输入验证
        if (!username || !email || !password || !confirmPassword) {
            this.showNotification('请填写所有字段', 'error', 4000); // 表单验证，4秒
            return;
        }

        // 用户名验证
        if (username.length < 3 || username.length > 20) {
            this.showNotification('用户名长度应在3-20个字符之间', 'error', 4000); // 验证错误，4秒
            usernameInput.focus();
            return;
        }

        if (!/^[a-zA-Z0-9_]+$/.test(username)) {
            this.showNotification('用户名只能包含字母、数字和下划线', 'error', 4000); // 验证错误，4秒
            usernameInput.focus();
            return;
        }

        // 邮箱验证
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            this.showNotification('请输入有效的邮箱地址', 'error', 4000); // 验证错误，4秒
            emailInput.focus();
            return;
        }

        // 密码验证
        if (password.length < 6) {
            this.showNotification('密码长度至少6位', 'error', 4000); // 验证错误，4秒
            passwordInput.focus();
            return;
        }

        if (!/^(?=.*[a-zA-Z])(?=.*\d)/.test(password)) {
            this.showNotification('密码必须包含字母和数字', 'error', 4000); // 验证错误，4秒
            passwordInput.focus();
            return;
        }

        if (password !== confirmPassword) {
            this.showNotification('密码不匹配', 'error', 4000); // 验证错误，4秒
            confirmPasswordInput.value = '';
            confirmPasswordInput.focus();
            return;
        }

        // 检查用户名是否已存在
        if (this.users.some(user => user.username === username)) {
            this.showNotification('用户名已存在', 'error', 4000); // 注册错误，4秒
            usernameInput.focus();
            return;
        }

        // 检查邮箱是否已存在
        if (this.users.some(user => user.email === email)) {
            this.showNotification('邮箱已存在', 'error', 4000); // 注册错误，4秒
            emailInput.focus();
            return;
        }

        // 创建新用户，密码加密存储
        const newUser = {
            id: this.generateId(),
            username,
            email,
            password: this.hashPassword(password), // 加密密码
            isAdmin: false,
            createdAt: new Date().toISOString(),
            lastLogin: null,
            loginAttempts: 0,
            lockedUntil: null
        };

        this.users.push(newUser);
        this.safeSetLocalStorage('blogUsers', this.users);

        this.currentUser = {
            id: newUser.id,
            username: newUser.username,
            isAdmin: newUser.isAdmin,
            email: newUser.email,
            loginTime: new Date().toISOString()
        };
        
        this.safeSetLocalStorage('blogUser', this.currentUser);

        this.hideLoginScreen();
        this.showUserButtons();
        this.showSection('home');
        this.showNotification('注册成功！欢迎加入！', 'success', 3000); // 注册成功，3秒
    }

    /**
     * 显示注册表单
     */
    showRegisterForm() {
        const loginForm = document.getElementById('login-form-screen');
        const registerForm = document.getElementById('register-form-screen');
        
        if (loginForm) loginForm.style.display = 'none';
        if (registerForm) registerForm.style.display = 'block';
    }

    /**
     * 显示登录表单
     */
    showLoginForm() {
        const loginForm = document.getElementById('login-form-screen');
        const registerForm = document.getElementById('register-form-screen');
        
        if (registerForm) registerForm.style.display = 'none';
        if (loginForm) loginForm.style.display = 'block';
    }

    /**
     * 初始化示例数据
     */
    initializeSampleData() {
        if (this.articles.length === 0) {
            console.log('初始化示例数据');
            
            // 重要：保护当前用户状态
            const currentUserBackup = this.currentUser;
            console.log('备份当前用户状态:', currentUserBackup);
            
            const sampleArticle = {
                id: this.generateId(),
                title: '欢迎来到心流博客！',
                category: 'thoughts',
                content: '这是一个个人博客系统，您可以在这里分享您的想法和经验。\n\n## 主要功能\n\n- 文章发布和管理\n- 用户注册和登录\n- 评论系统\n- 响应式设计\n\n欢迎您的使用！',
                createdAt: new Date().toISOString(),
                views: 0  // 修复：从 1 改为 0
            };
            
            this.articles.push(sampleArticle);
            const saveResult = this.safeSetLocalStorage('blogArticles', this.articles);
            console.log('保存示例文章结果:', saveResult);
            
            // 恢复用户状态
            if (currentUserBackup) {
                this.currentUser = currentUserBackup;
                this.safeSetLocalStorage('blogUser', this.currentUser);
                console.log('✅ 用户状态已恢复:', this.currentUser.username);
            } else {
                console.log('ℹ️ 无需恢复用户状态（用户未登录）');
            }
        }
    }

    /**
     * 显示通知 - 改进版
     * 
     * 功能特性：
     * - 四种通知类型：success(成功), error(错误), warning(警告), info(信息)
     * - 自动关闭和手动关闭支持
     * - 鼠标悬停暂停自动关闭
     * - 键盘支持(ESC键关闭)
     * - 响应式设计，适配移动端
     * - 平滑的动画效果
     * - 防止通知重叠的智能定位
     * - 屏幕阅读器友好的ARIA属性
     * 
     * 使用示例：
     * 
     * // 1. 简单的成功提示（默认5秒自动关闭）
     * this.showNotification('文章发布成功！', 'success');
     * 
     * // 2. 错误提示，显示4秒
     * this.showNotification('密码错误，请重试', 'error', 4000);
     * 
     * // 3. 警告信息，显示3秒
     * this.showNotification('您的会话即将过期', 'warning', 3000);
     * 
     * // 4. 重要信息，不自动关闭（用户必须手动关闭）
     * this.showNotification('账户已被锁定，请联系管理员', 'error', 0, false);
     * 
     * // 5. 简短的成功提示，2秒关闭
     * this.showNotification('保存成功！', 'success', 2000);
     * 
     * // 6. 带动态内容的信息
     * this.showNotification(`欢迎回来，${username}！`, 'info', 2500);
     * 
     * 参数说明：
     * @param {string} message - 通知消息内容，支持HTML转义防止XSS
     * @param {string} type - 通知类型: 'success'(绿色), 'error'(红色), 'warning'(橙色), 'info'(蓝色)
     * @param {number} duration - 显示时长(毫秒)，0表示不自动关闭，默认5000ms
     * @param {boolean} autoClose - 是否自动关闭，默认true。设为false时duration参数无效
     * 
     * 样式说明：
     * - 通知显示在页面顶部中央，不会被导航栏遮挡
     * - 不同类型的通知有颜色区分和对应的图标
     * - 支持平滑的进入和退出动画
     * - 移动端适配，自动调整大小和位置
     * - 支持高对比度和减少动画等可访问性偏好
     * 
     * 最佳实践：
     * - 成功消息：2-3秒，简单确认操作成功
     * - 错误消息：4-5秒或不关闭，确保用户看到重要错误
     * - 警告消息：3-4秒，提醒用户注意
     * - 信息消息：2-4秒，根据重要性调整
     * - 关键系统消息：不自动关闭，必须用户确认
     */
    showNotification(message, type = 'info', duration = 5000, autoClose = true) {
        console.log(`📢 通知 [${type}]: ${message}`);
        
        // 创建通知元素
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.setAttribute('role', 'alert');
        notification.setAttribute('aria-live', 'polite');
        notification.setAttribute('aria-label', `${type}通知`);
        notification.setAttribute('tabindex', '0');
        
        // 转义HTML防止XSS
        const safeMessage = this.escapeHtml(message);
        
        notification.innerHTML = `
            <span>${safeMessage}</span>
            <button class="notification-close" aria-label="关闭通知">×</button>
        `;
        
        // 添加到body
        document.body.appendChild(notification);
        
        // 获取关闭按钮
        const closeBtn = notification.querySelector('.notification-close');
        
        // 关闭函数
        const closeNotification = () => {
            if (notification.parentElement) {
                notification.classList.add('removing');
                setTimeout(() => {
                    if (notification.parentElement) {
                        notification.remove();
                    }
                }, 300);
            }
        };
        
        // 绑定关闭按钮事件
        closeBtn.addEventListener('click', closeNotification);
        
        // 点击通知本身也可以关闭（可选）
        notification.addEventListener('click', (e) => {
            if (e.target === notification) {
                closeNotification();
            }
        });
        
        // 键盘支持 - ESC键关闭
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                closeNotification();
                document.removeEventListener('keydown', handleKeyDown);
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        
        // 自动关闭
        let autoCloseTimer = null;
        if (autoClose && duration > 0) {
            autoCloseTimer = setTimeout(() => {
                closeNotification();
            }, duration);
        }
        
        // 鼠标悬停时暂停自动关闭
        if (autoCloseTimer) {
            notification.addEventListener('mouseenter', () => {
                clearTimeout(autoCloseTimer);
            });
            
            notification.addEventListener('mouseleave', () => {
                autoCloseTimer = setTimeout(() => {
                    closeNotification();
                }, 1000); // 鼠标离开后1秒关闭
            });
        }
        
        // 确保通知不会被遮挡
        this.adjustNotificationPosition();
        
        return notification;
    }
    
    /**
     * 调整通知位置，确保不会被导航栏遮挡
     */
    adjustNotificationPosition() {
        const notifications = document.querySelectorAll('.notification');
        const navbar = document.querySelector('.navbar');
        const navbarHeight = navbar ? navbar.offsetHeight : 70;
        
        notifications.forEach((notification, index) => {
            const topPosition = navbarHeight + 20 + (index * 70); // 20px间距，每个通知约70px高
            notification.style.top = `${topPosition}px`;
        });
    }

    /**
     * 生成ID
     */
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    /**
     * 保存数据
     */
    saveArticles() {
        this.safeSetLocalStorage('blogArticles', this.articles);
    }

    saveUsers() {
        this.safeSetLocalStorage('blogUsers', this.users);
    }

    saveComments() {
        this.safeSetLocalStorage('blogComments', this.comments);
    }

    /**
     * 加载文章评论
     */
    loadArticleComments(articleId) {
        return this.comments.filter(comment => comment.articleId === articleId);
    }

    /**
     * 渲染评论列表
     */
    renderComments(articleId) {
        const commentsList = document.getElementById('comments-list');
        const commentsCount = document.getElementById('comments-count');
        
        if (!commentsList) {
            console.error('❌ 评论列表容器未找到');
            return;
        }

        const articleComments = this.loadArticleComments(articleId);
        
        // 更新评论数量
        if (commentsCount) {
            commentsCount.textContent = articleComments.length;
        }

        if (articleComments.length === 0) {
            commentsList.innerHTML = '<div class="no-comments"><p>暂无评论，快来发表第一条评论吧！</p></div>';
            return;
        }

        // 排序：置顶的在前，然后按时间倒序
        const sortedComments = articleComments.sort((a, b) => {
            if (a.isPinned && !b.isPinned) return -1;
            if (!a.isPinned && b.isPinned) return 1;
            return new Date(b.createdAt) - new Date(a.createdAt);
        });

        commentsList.innerHTML = sortedComments.map(comment => this.createCommentItem(comment)).join('');
        
        // 添加事件委托，处理动态生成的评论管理按钮
        this.bindCommentListEvents(commentsList, articleId);
    }

    /**
     * 创建评论项HTML
     */
    createCommentItem(comment) {
        const date = new Date(comment.createdAt).toLocaleDateString('zh-CN');
        const time = new Date(comment.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
        
        const isAdminComment = comment.isAdmin || false;
        const isPinned = comment.isPinned || false;
        const canManage = this.currentUser && this.currentUser.isAdmin;

        return `
            <div class="comment-item ${isAdminComment ? 'admin-comment' : ''} ${isPinned ? 'pinned-comment' : ''}" data-comment-id="${comment.id}">
                <div class="comment-header">
                    <div class="comment-author-info">
                        <span class="comment-author">
                            ${this.escapeHtml(comment.author)}
                            ${isAdminComment ? '<span class="admin-badge">管理员</span>' : ''}
                            ${isPinned ? '<span class="pinned-badge">置顶</span>' : ''}
                        </span>
                        <span class="comment-date">${date} ${time}</span>
                    </div>
                    ${canManage ? `
                        <div class="comment-actions">
                            ${!isPinned ? `<button type="button" class="btn btn-sm btn-primary comment-pin-btn" data-comment-id="${comment.id}" data-action="pin" title="置顶评论"><i class="fas fa-thumbtack"></i></button>` : ''}
                            <button type="button" class="btn btn-sm btn-danger comment-delete-btn" data-comment-id="${comment.id}" data-action="delete" title="删除评论"><i class="fas fa-trash"></i></button>
                        </div>
                    ` : ''}
                </div>
                <div class="comment-content">${this.escapeHtml(comment.content)}</div>
            </div>
        `;
    }

    /**
     * 提交评论
     */
    async submitComment(articleId, author, content) {
        if (!articleId || !author || !content) {
            this.showNotification('请填写完整的评论信息', 'error', 4000);
            return false;
        }

        if (content.length < 2) {
            this.showNotification('评论内容太短', 'error', 3000);
            return false;
        }

        if (content.length > 1000) {
            this.showNotification('评论内容不能超过1000字', 'error', 4000);
            return false;
        }

        const comment = {
            id: 'comment_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            articleId: articleId,
            author: author.trim(),
            content: content.trim(),
            createdAt: new Date().toISOString(),
            isAdmin: this.currentUser && this.currentUser.isAdmin,
            isPinned: false
        };

        this.comments.push(comment);
        await this.saveComments();
        
        // 重新渲染评论列表
        this.renderComments(articleId);
        
        this.showNotification('评论发表成功！', 'success', 2500);
        return true;
    }

    /**
     * 删除评论
     */
    async deleteComment(commentId) {
        if (!this.currentUser || !this.currentUser.isAdmin) {
            this.showNotification('只有管理员可以删除评论', 'error', 4000);
            return;
        }

        if (!confirm('确定要删除这条评论吗？')) {
            return;
        }

        const commentIndex = this.comments.findIndex(c => c.id === commentId);
        if (commentIndex === -1) {
            this.showNotification('评论不存在', 'error', 3000);
            return;
        }

        const comment = this.comments[commentIndex];
        this.comments.splice(commentIndex, 1);
        await this.saveComments();
        
        // 重新渲染评论列表
        this.renderComments(comment.articleId);
        
        this.showNotification('评论已删除', 'success', 2500);
    }

    /**
     * 置顶/取消置顶评论
     */
    async pinComment(commentId) {
        if (!this.currentUser || !this.currentUser.isAdmin) {
            this.showNotification('只有管理员可以置顶评论', 'error', 4000);
            return;
        }

        const comment = this.comments.find(c => c.id === commentId);
        if (!comment) {
            this.showNotification('评论不存在', 'error', 3000);
            return;
        }

        comment.isPinned = !comment.isPinned;
        await this.saveComments();
        
        // 重新渲染评论列表
        this.renderComments(comment.articleId);
        
        const action = comment.isPinned ? '置顶' : '取消置顶';
        this.showNotification(`评论已${action}`, 'success', 2500);
    }

    /**
     * 显示评论管理后台
     */
    showCommentsManagement() {
        this.showSection('admin-comments');
        this.renderAllCommentsForAdmin();
    }

    /**
     * 渲染所有评论（管理员）
     */
    renderAllCommentsForAdmin() {
        const container = document.getElementById('admin-comments-list');
        if (!container) {
            console.error('❌ 管理员评论列表容器未找到');
            return;
        }

        if (this.comments.length === 0) {
            container.innerHTML = '<div class="no-comments"><p>暂无评论</p></div>';
            return;
        }

        // 按文章分组显示评论
        const commentsByArticle = {};
        this.comments.forEach(comment => {
            if (!commentsByArticle[comment.articleId]) {
                const article = this.articles.find(a => a.id === comment.articleId);
                commentsByArticle[comment.articleId] = {
                    article: article,
                    comments: []
                };
            }
            commentsByArticle[comment.articleId].comments.push(comment);
        });

        let html = '';
        Object.values(commentsByArticle).forEach(group => {
            const articleTitle = group.article ? group.article.title : '文章已删除';
            html += `
                <div class="admin-comment-group">
                    <h3 class="admin-comment-article-title">${this.escapeHtml(articleTitle)}</h3>
                    <div class="admin-comments-list">
                        ${group.comments.map(comment => this.createAdminCommentItem(comment)).join('')}
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
    }

    /**
     * 创建管理员评论项HTML
     */
    createAdminCommentItem(comment) {
        const article = this.articles.find(a => a.id === comment.articleId);
        const articleTitle = article ? article.title : '文章已删除';
        const date = new Date(comment.createdAt).toLocaleDateString('zh-CN');
        const time = new Date(comment.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
        
        const isAdminComment = comment.isAdmin || false;
        const isPinned = comment.isPinned || false;

        return `
            <div class="admin-comment-item ${isAdminComment ? 'admin-comment' : ''} ${isPinned ? 'pinned-comment' : ''}">
                <div class="admin-comment-header">
                    <div class="admin-comment-info">
                        <span class="admin-comment-author">
                            ${this.escapeHtml(comment.author)}
                            ${isAdminComment ? '<span class="admin-badge">管理员</span>' : ''}
                            ${isPinned ? '<span class="pinned-badge">置顶</span>' : ''}
                        </span>
                        <span class="admin-comment-article">${this.escapeHtml(articleTitle)}</span>
                        <span class="admin-comment-date">${date} ${time}</span>
                    </div>
                    <div class="admin-comment-actions">
                        ${!isPinned ? `<button type="button" class="btn btn-sm btn-primary" onclick="blogApp.pinComment('${comment.id}')" title="置顶评论"><i class="fas fa-thumbtack"></i> 置顶</button>` : `<button type="button" class="btn btn-sm btn-secondary" onclick="blogApp.pinComment('${comment.id}')" title="取消置顶"><i class="fas fa-thumbtack"></i> 取消</button>`}
                        <button type="button" class="btn btn-sm btn-danger" onclick="blogApp.deleteComment('${comment.id}')" title="删除评论"><i class="fas fa-trash"></i> 删除</button>
                    </div>
                </div>
                <div class="admin-comment-content">${this.escapeHtml(comment.content)}</div>
            </div>
        `;
    }

    /**
     * 显示用户管理后台
     */
    showUsersManagement() {
        this.showSection('admin-users');
        this.renderUsersManagement();
    }

    /**
     * 渲染用户管理页面
     */
    renderUsersManagement() {
        this.renderUserStats();
        this.renderUsersTable();
    }

    /**
     * 渲染用户统计信息
     */
    renderUserStats() {
        const totalUsersEl = document.getElementById('total-users-count');
        const activeUsersEl = document.getElementById('active-users-count');
        const lockedUsersEl = document.getElementById('locked-users-count');
        const newUsersEl = document.getElementById('new-users-count');

        if (!totalUsersEl || !activeUsersEl || !lockedUsersEl || !newUsersEl) {
            console.error('❌ 用户统计元素未找到');
            return;
        }

        const totalUsers = this.users.length;
        const activeUsers = this.users.filter(user => !user.isLocked).length;
        const lockedUsers = this.users.filter(user => user.isLocked).length;
        
        // 计算本月新注册用户
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        const newUsers = this.users.filter(user => {
            if (!user.registerTime) return false;
            const registerDate = new Date(user.registerTime);
            return registerDate.getMonth() === currentMonth && registerDate.getFullYear() === currentYear;
        }).length;

        totalUsersEl.textContent = totalUsers;
        activeUsersEl.textContent = activeUsers;
        lockedUsersEl.textContent = lockedUsers;
        newUsersEl.textContent = newUsers;
    }

    /**
     * 渲染用户表格
     */
    renderUsersTable() {
        const tbody = document.getElementById('users-table-body');
        if (!tbody) {
            console.error('❌ 用户表格tbody未找到');
            return;
        }

        if (this.users.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 40px; color: var(--text-muted);">暂无用户数据</td></tr>';
            return;
        }

        // 分页逻辑
        const currentPage = this.currentUserPage || 1;
        const pageSize = 10; // 每页显示10个用户
        const startIndex = (currentPage - 1) * pageSize;
        const endIndex = startIndex + pageSize;
        const usersToShow = this.users.slice(startIndex, endIndex);

        let html = '';
        usersToShow.forEach(user => {
            const registerTime = user.registerTime ? new Date(user.registerTime).toLocaleDateString('zh-CN') : 'N/A';
            const lastLogin = user.lastLogin ? new Date(user.lastLogin).toLocaleString('zh-CN') : '从未登录';
            const status = user.isLocked ? '已锁定' : '正常';
            const statusClass = user.isLocked ? 'status-locked' : 'status-active';
            const role = user.isAdmin ? '管理员' : '普通用户';
            const roleClass = user.isAdmin ? 'role-admin' : 'role-user';

            html += `
                <tr data-user-id="${user.username}">
                    <td>
                        <input type="checkbox" class="user-checkbox" data-user-id="${user.username}" aria-label="选择用户 ${user.username}">
                    </td>
                    <td>
                        <div class="user-info">
                            <div class="user-name">${this.escapeHtml(user.username)}</div>
                            ${user.email ? `<div class="user-email small">${this.escapeHtml(user.email)}</div>` : ''}
                        </div>
                    </td>
                    <td>${user.email ? this.escapeHtml(user.email) : '未设置'}</td>
                    <td>${registerTime}</td>
                    <td>${lastLogin}</td>
                    <td><span class="status-badge ${statusClass}">${status}</span></td>
                    <td><span class="role-badge ${roleClass}">${role}</span></td>
                    <td>
                        <div class="user-actions">
                            <button type="button" class="btn btn-sm btn-primary" onclick="blogApp.editUser('${user.username}')" title="编辑用户">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button type="button" class="btn btn-sm btn-warning" onclick="blogApp.lockUser('${user.username}')" title="${user.isLocked ? '解锁用户' : '锁定用户'}">
                                <i class="fas fa-${user.isLocked ? 'unlock' : 'lock'}"></i>
                            </button>
                            <button type="button" class="btn btn-sm btn-danger" onclick="blogApp.deleteUser('${user.username}')" title="删除用户">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        });

        tbody.innerHTML = html;
        
        // 更新分页信息
        this.updateUserPagination();
        
        // 绑定用户选择事件
        this.bindUserSelectionEvents();
    }

    /**
     * 更新用户分页信息
     */
    updateUserPagination() {
        const currentPage = this.currentUserPage || 1;
        const pageSize = 10;
        const totalUsers = this.users.length;
        const totalPages = Math.ceil(totalUsers / pageSize);
        const startIndex = (currentPage - 1) * pageSize + 1;
        const endIndex = Math.min(currentPage * pageSize, totalUsers);

        document.getElementById('users-page-start').textContent = totalUsers > 0 ? startIndex : 0;
        document.getElementById('users-page-end').textContent = endIndex;
        document.getElementById('users-total-count').textContent = totalUsers;
        document.getElementById('users-current-page').textContent = currentPage;

        // 更新按钮状态
        const prevBtn = document.getElementById('users-prev-page');
        const nextBtn = document.getElementById('users-next-page');
        
        if (prevBtn) prevBtn.disabled = currentPage <= 1;
        if (nextBtn) nextBtn.disabled = currentPage >= totalPages;
    }

    /**
     * 切换用户页面
     */
    changeUserPage(direction) {
        const currentPage = this.currentUserPage || 1;
        const pageSize = 10;
        const totalPages = Math.ceil(this.users.length / pageSize);
        const newPage = currentPage + direction;

        if (newPage >= 1 && newPage <= totalPages) {
            this.currentUserPage = newPage;
            this.renderUsersTable();
        }
    }

    /**
     * 搜索用户
     */
    searchUsers(searchTerm) {
        const tbody = document.getElementById('users-table-body');
        if (!tbody || !searchTerm) {
            this.renderUsersTable();
            return;
        }

        const filteredUsers = this.users.filter(user => 
            user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (user.email && user.email.toLowerCase().includes(searchTerm.toLowerCase()))
        );

        if (filteredUsers.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 40px; color: var(--text-muted);">未找到匹配的用户</td></tr>';
            return;
        }

        let html = '';
        filteredUsers.forEach(user => {
            const registerTime = user.registerTime ? new Date(user.registerTime).toLocaleDateString('zh-CN') : 'N/A';
            const lastLogin = user.lastLogin ? new Date(user.lastLogin).toLocaleString('zh-CN') : '从未登录';
            const status = user.isLocked ? '已锁定' : '正常';
            const statusClass = user.isLocked ? 'status-locked' : 'status-active';
            const role = user.isAdmin ? '管理员' : '普通用户';
            const roleClass = user.isAdmin ? 'role-admin' : 'role-user';

            html += `
                <tr data-user-id="${user.username}">
                    <td>
                        <input type="checkbox" class="user-checkbox" data-user-id="${user.username}" aria-label="选择用户 ${user.username}">
                    </td>
                    <td>
                        <div class="user-info">
                            <div class="user-name">${this.escapeHtml(user.username)}</div>
                            ${user.email ? `<div class="user-email small">${this.escapeHtml(user.email)}</div>` : ''}
                        </div>
                    </td>
                    <td>${user.email ? this.escapeHtml(user.email) : '未设置'}</td>
                    <td>${registerTime}</td>
                    <td>${lastLogin}</td>
                    <td><span class="status-badge ${statusClass}">${status}</span></td>
                    <td><span class="role-badge ${roleClass}">${role}</span></td>
                    <td>
                        <div class="user-actions">
                            <button type="button" class="btn btn-sm btn-primary" onclick="blogApp.editUser('${user.username}')" title="编辑用户">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button type="button" class="btn btn-sm btn-warning" onclick="blogApp.lockUser('${user.username}')" title="${user.isLocked ? '解锁用户' : '锁定用户'}">
                                <i class="fas fa-${user.isLocked ? 'unlock' : 'lock'}"></i>
                            </button>
                            <button type="button" class="btn btn-sm btn-danger" onclick="blogApp.deleteUser('${user.username}')" title="删除用户">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        });

        tbody.innerHTML = html;
        this.bindUserSelectionEvents();
    }

    /**
     * 绑定用户选择事件
     */
    bindUserSelectionEvents() {
        const selectAllCheckbox = document.getElementById('select-all-users');
        const userCheckboxes = document.querySelectorAll('.user-checkbox');
        const batchActions = document.getElementById('users-batch-actions');

        if (selectAllCheckbox) {
            selectAllCheckbox.addEventListener('change', (e) => {
                userCheckboxes.forEach(checkbox => {
                    checkbox.checked = e.target.checked;
                });
                this.updateBatchActions();
            });
        }

        userCheckboxes.forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                this.updateBatchActions();
            });
        });

        // 绑定搜索事件
        const searchInput = document.getElementById('user-search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchUsers(e.target.value);
            });
        }
    }

    /**
     * 更新批量操作显示
     */
    updateBatchActions() {
        const selectedCheckboxes = document.querySelectorAll('.user-checkbox:checked');
        const batchActions = document.getElementById('users-batch-actions');
        const selectedCount = document.getElementById('selected-users-count');

        if (selectedCheckboxes.length > 0) {
            batchActions.style.display = 'block';
            selectedCount.textContent = `已选择 ${selectedCheckboxes.length} 个用户`;
        } else {
            batchActions.style.display = 'none';
        }
    }

    /**
     * 获取选中的用户
     */
    getSelectedUsers() {
        const selectedCheckboxes = document.querySelectorAll('.user-checkbox:checked');
        return Array.from(selectedCheckboxes).map(checkbox => checkbox.dataset.userId);
    }

    /**
     * 批量锁定用户
     */
    async batchLockUsers() {
        const selectedUsers = this.getSelectedUsers();
        if (selectedUsers.length === 0) {
            this.showNotification('请先选择要锁定的用户', 'warning', 3000);
            return;
        }

        if (confirm(`确定要锁定选中的 ${selectedUsers.length} 个用户吗？`)) {
            selectedUsers.forEach(username => {
                const user = this.users.find(u => u.username === username);
                if (user) {
                    user.isLocked = true;
                }
            });

            await this.safeSetLocalStorage('blogUsers', this.users);
            this.renderUsersTable();
            this.renderUserStats();
            this.showNotification(`已成功锁定 ${selectedUsers.length} 个用户`, 'success', 3000);
        }
    }

    /**
     * 批量解锁用户
     */
    async batchUnlockUsers() {
        const selectedUsers = this.getSelectedUsers();
        if (selectedUsers.length === 0) {
            this.showNotification('请先选择要解锁的用户', 'warning', 3000);
            return;
        }

        if (confirm(`确定要解锁选中的 ${selectedUsers.length} 个用户吗？`)) {
            selectedUsers.forEach(username => {
                const user = this.users.find(u => u.username === username);
                if (user) {
                    user.isLocked = false;
                }
            });

            await this.safeSetLocalStorage('blogUsers', this.users);
            this.renderUsersTable();
            this.renderUserStats();
            this.showNotification(`已成功解锁 ${selectedUsers.length} 个用户`, 'success', 3000);
        }
    }

    /**
     * 批量删除用户
     */
    async batchDeleteUsers() {
        const selectedUsers = this.getSelectedUsers();
        if (selectedUsers.length === 0) {
            this.showNotification('请先选择要删除的用户', 'warning', 3000);
            return;
        }

        if (confirm(`警告：删除用户将同时删除该用户的所有相关数据！\n\n确定要删除选中的 ${selectedUsers.length} 个用户吗？此操作不可恢复！`)) {
            // 过滤掉要删除的用户
            this.users = this.users.filter(user => !selectedUsers.includes(user.username));
            
            // 同时删除这些用户的评论
            this.comments = this.comments.filter(comment => !selectedUsers.includes(comment.author));
            
            // 如果删除的是当前登录用户，则退出登录
            if (this.currentUser && selectedUsers.includes(this.currentUser.username)) {
                this.currentUser = null;
                await this.safeSetLocalStorage('blogUser', null);
            }

            await Promise.all([
                this.safeSetLocalStorage('blogUsers', this.users),
                this.safeSetLocalStorage('blogComments', this.comments)
            ]);

            this.renderUsersTable();
            this.renderUserStats();
            this.showNotification(`已成功删除 ${selectedUsers.length} 个用户`, 'success', 3000);
        }
    }

    /**
     * 编辑用户
     */
    editUser(username) {
        const user = this.users.find(u => u.username === username);
        if (!user) {
            this.showNotification('用户不存在', 'error', 3000);
            return;
        }

        // 简单的prompt编辑，实际项目中应该使用模态框
        const newEmail = prompt('请输入新的邮箱地址（留空则不修改）：', user.email || '');
        if (newEmail !== null) {
            if (newEmail && !this.validateEmail(newEmail)) {
                this.showNotification('邮箱格式不正确', 'error', 3000);
                return;
            }
            
            user.email = newEmail || user.email;
            this.safeSetLocalStorage('blogUsers', this.users);
            this.renderUsersTable();
            this.showNotification('用户信息已更新', 'success', 3000);
        }
    }

    /**
     * 删除用户
     */
    async deleteUser(username) {
        if (username === 'zcr') {
            this.showNotification('不能删除管理员账户', 'error', 3000);
            return;
        }

        const user = this.users.find(u => u.username === username);
        if (!user) {
            this.showNotification('用户不存在', 'error', 3000);
            return;
        }

        if (confirm(`警告：删除用户 "${username}" 将同时删除该用户的所有相关数据！\n\n确定要删除吗？此操作不可恢复！`)) {
            // 删除用户
            this.users = this.users.filter(u => u.username !== username);
            
            // 删除该用户的评论
            this.comments = this.comments.filter(comment => comment.author !== username);
            
            // 如果删除的是当前登录用户，则退出登录
            if (this.currentUser && this.currentUser.username === username) {
                this.currentUser = null;
                await this.safeSetLocalStorage('blogUser', null);
            }

            await Promise.all([
                this.safeSetLocalStorage('blogUsers', this.users),
                this.safeSetLocalStorage('blogComments', this.comments)
            ]);

            this.renderUsersTable();
            this.renderUserStats();
            this.showNotification(`用户 "${username}" 已删除`, 'success', 3000);
        }
    }

    /**
     * 锁定/解锁用户
     */
    async lockUser(username) {
        if (username === 'zcr') {
            this.showNotification('不能锁定管理员账户', 'error', 3000);
            return;
        }

        const user = this.users.find(u => u.username === username);
        if (!user) {
            this.showNotification('用户不存在', 'error', 3000);
            return;
        }

        user.isLocked = !user.isLocked;
        await this.safeSetLocalStorage('blogUsers', this.users);
        
        this.renderUsersTable();
        this.renderUserStats();
        
        const action = user.isLocked ? '锁定' : '解锁';
        this.showNotification(`用户 "${username}" 已${action}`, 'success', 3000);
    }

    /**
     * 显示创建用户模态框（占位符）
     */
    showUserCreateModal() {
        this.showNotification('创建用户功能开发中...', 'info', 3000);
    }

    /**
     * 邮箱验证
     */
    validateEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    /**
     * 绑定评论相关事件
     */
    bindCommentEvents() {
        console.log('🔧 开始绑定评论事件');
        
        // 清理旧的评论事件监听器，防止重复绑定
        this.cleanupCommentEventListeners();
        
        // 切换评论表单显示
        const toggleCommentsBtn = document.getElementById('toggle-comments-btn');
        if (toggleCommentsBtn) {
            this.addSafeEventListener(toggleCommentsBtn, 'click', () => {
                const commentFormContainer = document.getElementById('comment-form-container');
                if (commentFormContainer) {
                    const isVisible = commentFormContainer.style.display !== 'none';
                    commentFormContainer.style.display = isVisible ? 'none' : 'block';
                    toggleCommentsBtn.innerHTML = isVisible ? '<i class="fas fa-comments"></i> 写评论' : '<i class="fas fa-times"></i> 关闭';
                    
                    if (!isVisible) {
                        // 显示表单时，根据用户状态自动填充昵称
                        const authorInput = document.getElementById('comment-author-input');
                        if (authorInput) {
                            if (this.currentUser) {
                                // 登录用户自动填充用户名
                                if (this.currentUser.isAdmin) {
                                    // 管理员显示"管理员"且只读
                                    authorInput.value = '管理员';
                                    authorInput.readOnly = true;
                                } else {
                                    // 普通登录用户显示注册用户名且只读
                                    authorInput.value = this.currentUser.username || '匿名用户';
                                    authorInput.readOnly = true;
                                }
                            } else {
                                // 未登录用户需要手动输入昵称
                                authorInput.value = '';
                                authorInput.readOnly = false;
                            }
                        }
                    }
                }
            });
        }

        // 评论表单提交
        const commentForm = document.getElementById('comment-form');
        if (commentForm) {
            this.addSafeEventListener(commentForm, 'submit', async (e) => {
                e.preventDefault();
                
                const articleId = commentForm.dataset.articleId;
                const authorInput = document.getElementById('comment-author-input');
                const contentInput = document.getElementById('comment-content-input');
                
                // 添加详细调试信息
                console.log('📝 评论表单提交:', {
                    articleId,
                    hasAuthorInput: !!authorInput,
                    hasContentInput: !!contentInput,
                    authorValue: authorInput ? authorInput.value : null,
                    contentValue: contentInput ? contentInput.value : null
                });
                
                if (!articleId) {
                    this.showNotification('错误：文章ID丢失，请重新打开文章', 'error', 5000);
                    console.error('❌ 文章ID丢失');
                    return;
                }
                
                if (!authorInput || !contentInput) {
                    this.showNotification('评论表单数据不完整', 'error', 4000);
                    console.error('❌ 表单输入元素缺失');
                    return;
                }

                const author = authorInput.value.trim();
                const content = contentInput.value.trim();
                
                if (!author) {
                    this.showNotification('请输入您的昵称', 'error', 3000);
                    authorInput.focus();
                    return;
                }
                
                if (!content) {
                    this.showNotification('请输入评论内容', 'error', 3000);
                    contentInput.focus();
                    return;
                }
                
                console.log('🚀 提交评论:', { articleId, author, contentLength: content.length });
                const success = await this.submitComment(articleId, author, content);
                
                if (success) {
                    // 清空表单
                    if (!this.currentUser || !this.currentUser.isAdmin) {
                        authorInput.value = '';
                    }
                    contentInput.value = '';
                    
                    // 隐藏表单
                    const commentFormContainer = document.getElementById('comment-form-container');
                    if (commentFormContainer) {
                        commentFormContainer.style.display = 'none';
                        if (toggleCommentsBtn) {
                            toggleCommentsBtn.innerHTML = '<i class="fas fa-comments"></i> 写评论';
                        }
                    }
                }
            });
        }

        // 取消评论按钮
        const cancelCommentBtn = document.getElementById('cancel-comment-btn');
        if (cancelCommentBtn) {
            this.addSafeEventListener(cancelCommentBtn, 'click', () => {
                const commentFormContainer = document.getElementById('comment-form-container');
                if (commentFormContainer) {
                    commentFormContainer.style.display = 'none';
                    if (toggleCommentsBtn) {
                        toggleCommentsBtn.innerHTML = '<i class="fas fa-comments"></i> 写评论';
                    }
                }
            });
        }

        // 字符计数和实时验证
        const contentInput = document.getElementById('comment-content-input');
        const charCounter = document.getElementById('comment-content-count');
        const authorInput = document.getElementById('comment-author-input');
        
        if (contentInput && charCounter) {
            // 初始化字符计数
            this.updateCharCounter(contentInput, charCounter);
            
            // 监听输入事件
            this.addSafeEventListener(contentInput, 'input', () => {
                this.updateCharCounter(contentInput, charCounter);
                this.validateCommentInput(contentInput);
            });
            
            // 监听粘贴事件
            this.addSafeEventListener(contentInput, 'paste', (e) => {
                setTimeout(() => {
                    this.updateCharCounter(contentInput, charCounter);
                    this.validateCommentInput(contentInput);
                }, 0);
            });
        }
        
        if (authorInput) {
            // 监听作者输入
            this.addSafeEventListener(authorInput, 'input', () => {
                this.validateAuthorInput(authorInput);
            });
            
            // 监听作者输入失焦
            this.addSafeEventListener(authorInput, 'blur', () => {
                this.validateAuthorInput(authorInput);
            });
        }
        
        // 键盘快捷键支持
        if (contentInput) {
            this.addSafeEventListener(contentInput, 'keydown', (e) => {
                // Ctrl+Enter 提交
                if (e.ctrlKey && e.key === 'Enter') {
                    e.preventDefault();
                    if (commentForm) {
                        commentForm.dispatchEvent(new Event('submit'));
                    }
                }
            });
        }
        
        // 自动保存草稿功能
        if (contentInput || authorInput) {
            const saveDraft = () => {
                const draft = {
                    author: authorInput ? authorInput.value : '',
                    content: contentInput ? contentInput.value : '',
                    timestamp: Date.now()
                };
                localStorage.setItem('commentDraft', JSON.stringify(draft));
            };
            
            if (contentInput) {
                this.addSafeEventListener(contentInput, 'input', saveDraft);
            }
            if (authorInput) {
                this.addSafeEventListener(authorInput, 'input', saveDraft);
            }
            
            // 加载草稿
            const draft = localStorage.getItem('commentDraft');
            if (draft && !this.currentUser) {
                try {
                    const draftData = JSON.parse(draft);
                    const now = Date.now();
                    // 只加载24小时内的草稿
                    if (now - draftData.timestamp < 24 * 60 * 60 * 1000) {
                        if (authorInput && draftData.author && !authorInput.readOnly) {
                            authorInput.value = draftData.author;
                        }
                        if (contentInput && draftData.content) {
                            contentInput.value = draftData.content;
                            this.updateCharCounter(contentInput, charCounter);
                        }
                    }
                } catch (e) {
                    console.warn('加载评论草稿失败:', e);
                }
            }
        }
        
        console.log('✅ 评论事件绑定完成');
    }
    
    /**
     * 清理评论相关的事件监听器，防止重复绑定
     */
    cleanupCommentEventListeners() {
        const commentElements = [
            document.getElementById('toggle-comments-btn'),
            document.getElementById('comment-form'),
            document.getElementById('cancel-comment-btn'),
            document.getElementById('comments-list')
        ].filter(Boolean);
        
        commentElements.forEach(element => {
            if (this.eventListeners.has(element)) {
                const listeners = this.eventListeners.get(element);
                listeners.forEach(({ event, handler }) => {
                    element.removeEventListener(event, handler);
                });
                this.eventListeners.delete(element);
                console.log('🧹 清理事件监听器:', element.id || element.className);
            }
        });
    }

    /**
     * 绑定评论列表事件（事件委托）
     * 处理动态生成的评论管理按钮
     */
    bindCommentListEvents(commentsList, articleId) {
        if (!commentsList || !articleId) {
            console.error('❌ 评论列表或文章ID无效');
            return;
        }

        // 使用事件委托处理评论管理按钮点击
        this.addSafeEventListener(commentsList, 'click', async (e) => {
            const button = e.target.closest('.comment-pin-btn, .comment-delete-btn');
            if (!button) return;

            e.preventDefault();
            
            const commentId = button.dataset.commentId;
            const action = button.dataset.action;
            
            if (!commentId || !action) {
                console.error('❌ 评论操作数据不完整');
                return;
            }

            try {
                if (action === 'pin') {
                    await this.pinComment(commentId);
                } else if (action === 'delete') {
                    await this.deleteComment(commentId);
                }
            } catch (error) {
                console.error(`❌ 评论${action}操作失败:`, error);
                this.showNotification(`评论${action === 'pin' ? '置顶' : '删除'}失败`, 'error', 4000);
            }
        });
    }

    /**
     * 处理初始化错误
     */
    handleInitError(error) {
        console.error('初始化失败，恢复到登录状态:', error);
        this.currentUser = null;
        this.safeSetLocalStorage('blogUser', null);
        this.showLoginScreen();
        
        setTimeout(() => {
            this.showNotification('系统初始化失败，请刷新页面重试', 'error', 0, false); // 严重错误，不自动关闭
        }, 500);
    }

    /**
     * 更新字符计数器
     */
    updateCharCounter(input, counter) {
        if (!input || !counter) return;
        
        const currentLength = input.value.length;
        const maxLength = parseInt(input.getAttribute('maxlength')) || 500;
        counter.textContent = currentLength;
        
        // 根据字符数更新样式
        counter.classList.remove('warning', 'danger');
        if (currentLength > maxLength * 0.9) {
            counter.classList.add('danger');
        } else if (currentLength > maxLength * 0.8) {
            counter.classList.add('warning');
        }
        
        // 限制最大字符数
        if (currentLength > maxLength) {
            input.value = input.value.substring(0, maxLength);
            counter.textContent = maxLength;
        }
    }

    /**
     * 验证评论内容输入
     */
    validateCommentInput(input) {
        if (!input) return;
        
        const value = input.value.trim();
        const formGroup = input.closest('.form-group');
        const maxLength = parseInt(input.getAttribute('maxlength')) || 500;
        
        // 清除之前的错误状态
        if (formGroup) {
            formGroup.classList.remove('error');
            const existingError = formGroup.querySelector('.error-message');
            if (existingError) {
                existingError.remove();
            }
        }
        
        // 验证规则
        let isValid = true;
        let errorMessage = '';
        
        if (value.length === 0) {
            isValid = false;
            errorMessage = '评论内容不能为空';
        } else if (value.length < 5) {
            isValid = false;
            errorMessage = '评论内容至少需要5个字符';
        } else if (value.length > maxLength) {
            isValid = false;
            errorMessage = `评论内容不能超过${maxLength}个字符`;
        }
        
        // 显示错误
        if (!isValid && formGroup) {
            formGroup.classList.add('error');
            const errorEl = document.createElement('div');
            errorEl.className = 'error-message';
            errorEl.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${errorMessage}`;
            formGroup.appendChild(errorEl);
            
            // 3秒后自动隐藏错误
            setTimeout(() => {
                formGroup.classList.remove('error');
                if (errorEl.parentNode) {
                    errorEl.remove();
                }
            }, 3000);
        }
        
        return isValid;
    }

    /**
     * 验证作者输入
     */
    validateAuthorInput(input) {
        if (!input) return;
        
        const value = input.value.trim();
        const formGroup = input.closest('.form-group');
        const maxLength = parseInt(input.getAttribute('maxlength')) || 20;
        
        // 清除之前的错误状态
        if (formGroup) {
            formGroup.classList.remove('error');
            const existingError = formGroup.querySelector('.error-message');
            if (existingError) {
                existingError.remove();
            }
        }
        
        // 如果是只读（已登录用户），跳过验证
        if (input.readOnly) {
            return true;
        }
        
        // 验证规则
        let isValid = true;
        let errorMessage = '';
        
        if (value.length === 0) {
            isValid = false;
            errorMessage = '昵称不能为空';
        } else if (value.length < 2) {
            isValid = false;
            errorMessage = '昵称至少需要2个字符';
        } else if (value.length > maxLength) {
            isValid = false;
            errorMessage = `昵称不能超过${maxLength}个字符`;
        } else if (!/^[a-zA-Z0-9_\u4e00-\u9fa5]+$/.test(value)) {
            isValid = false;
            errorMessage = '昵称只能包含字母、数字、下划线和中文';
        }
        
        // 显示错误
        if (!isValid && formGroup) {
            formGroup.classList.add('error');
            const errorEl = document.createElement('div');
            errorEl.className = 'error-message';
            errorEl.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${errorMessage}`;
            formGroup.appendChild(errorEl);
            
            // 3秒后自动隐藏错误
            setTimeout(() => {
                formGroup.classList.remove('error');
                if (errorEl.parentNode) {
                    errorEl.remove();
                }
            }, 3000);
        }
        
        return isValid;
    }

    /**
     * 清理评论表单草稿
     */
    clearCommentDraft() {
        localStorage.removeItem('commentDraft');
    }

    /**
     * 销毁实例（清理资源）
     */
    destroy() {
        console.log('销毁博客应用实例...');
        
        // 清理事件监听器
        this.cleanupEventListeners();
        
        // 清理数据
        this.articles = [];
        this.users = [];
        this.comments = [];
        this.currentUser = null;
        this.isInitialized = false;
        
        console.log('✓ 博客应用实例已销毁');
    }
}

// 全局初始化函数
async function initializeBlogAppOptimized() {
    console.log('=== 优化版博客脚本开始加载 ===');
    
    try {
        // 清除可能存在的旧实例
        if (window.blogApp && typeof window.blogApp.destroy === 'function') {
            console.log('销毁旧的blogApp实例');
            window.blogApp.destroy();
        }
        
        // 保留现有的localStorage数据，不主动清除
        console.log('保留现有数据状态...');
        
        window.blogApp = new BlogAppOptimized();
        
        // 等待初始化完成
        await window.blogApp.initPromise;
        
        // 不要强制显示登录界面，让初始化逻辑决定显示什么
        console.log('=== 优化版博客脚本加载完成 ===');
    } catch (error) {
        console.error('优化版博客应用初始化失败:', error);
    }
}

// 立即执行初始化
initializeBlogAppOptimized().then(() => {
    console.log('博客应用初始化完成');
}).catch(error => {
    console.error('博客应用初始化失败:', error);
});

// 导出类供其他脚本使用
window.BlogAppOptimized = BlogAppOptimized;

// 提供全局错误处理
window.addEventListener('error', (event) => {
    console.error('全局错误:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('未处理的Promise拒绝:', event.reason);
});