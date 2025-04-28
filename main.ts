import { App, Plugin, PluginSettingTab, Setting, ButtonComponent, Notice } from 'obsidian';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs';

const execAsync = promisify(exec);

interface GitSyncSettings {
    targetDirectory: string;
    syncInterval: number;
    isAutoSyncEnabled: boolean;
    allowCustomDirectory: boolean;
}

const DEFAULT_SETTINGS: GitSyncSettings = {
    targetDirectory: '',
    syncInterval: 5,
    isAutoSyncEnabled: false,
    allowCustomDirectory: false
}

export default class GitSyncPlugin extends Plugin {
    settings: GitSyncSettings;
    syncInterval: NodeJS.Timeout | null = null;
    vaultPath: string;

    async onload() {
        // 获取Vault路径 - 修复方法
        // @ts-ignore
        this.vaultPath = (this.app.vault.adapter as any).getBasePath?.() || '';
        
        await this.loadSettings();
        
        // 如果目录为空，设置为Vault根目录
        if (!this.settings.targetDirectory) {
            this.settings.targetDirectory = this.vaultPath;
            await this.saveSettings();
        }

        // 添加设置选项卡
        this.addSettingTab(new GitSyncSettingTab(this.app, this));

        // 添加命令
        this.addCommand({
            id: 'manual-sync',
            name: '手动同步',
            callback: () => this.syncGit()
        });

        // 如果启用了自动同步，启动定时器
        if (this.settings.isAutoSyncEnabled) {
            this.startAutoSync();
        }
    }

    onunload() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
        }
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    startAutoSync() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
        }
        this.syncInterval = setInterval(() => {
            this.syncGit(true);
        }, this.settings.syncInterval * 60 * 1000);
    }

    async syncGit(isAuto = false) {
        if (!this.settings.targetDirectory) {
            new Notice('未设置目标目录，请先设置目标目录');
            return;
        }

        try {
            // 切换到目标目录
            process.chdir(this.settings.targetDirectory);

            // 拉取最新更改
            await execAsync('git pull');

            // 检查是否有文件变更
            const statusResult = await execAsync('git status --porcelain');
            if (!statusResult.stdout.trim()) {
                // 没有需要提交的变更
                // 只在手动同步时显示提示
                if (!isAuto) {
                    new Notice('没有内容需要同步');
                }
                return;
            }

            // 添加所有更改
            await execAsync('git add .');

            // 获取当前时间
            const now = new Date();
            const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
            // 根据是否为自动同步设置不同的提交信息
            const syncType = isAuto ? '自动同步' : '手动同步';
            const commitMessage = `${formattedDate} ${syncType}`;

            // 提交更改
            await execAsync(`git commit -m "${commitMessage}"`);

            // 推送更改
            await execAsync('git push');

            // 显示成功通知
            new Notice('Git 同步完成');
            console.log('Git 同步完成');
        } catch (error) {
            // 显示错误通知
            new Notice(`Git 同步失败: ${error.message || '未知错误'}`);
            console.error('Git 同步失败:', error);
        }
    }
}

class GitSyncSettingTab extends PluginSettingTab {
    plugin: GitSyncPlugin;
    hasUnsavedChanges: boolean = false;
    directoryInputEl: HTMLInputElement;
    intervalInputEl: HTMLInputElement;
    autoSyncToggle: any;

    constructor(app: App, plugin: GitSyncPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const {containerEl} = this;
        containerEl.empty();

        containerEl.createEl('h2', {text: 'Git 同步设置'});

        // 目标目录设置
        let dirSetting = new Setting(containerEl)
            .setName('目标目录')
            .setDesc('当前Vault目录（默认不可编辑）')
            .addText(text => {
                this.directoryInputEl = text
                    .setPlaceholder('Vault目录')
                    .setValue(this.plugin.settings.targetDirectory)
                    .setDisabled(!this.plugin.settings.allowCustomDirectory)
                    .onChange(() => {
                        this.hasUnsavedChanges = true;
                    })
                    .inputEl;
                return text;
            });

        // 添加修改按钮
        dirSetting.addButton(button => button
            .setButtonText(this.plugin.settings.allowCustomDirectory ? '锁定' : '修改')
            .onClick(async () => {
                // 切换是否允许编辑
                this.plugin.settings.allowCustomDirectory = !this.plugin.settings.allowCustomDirectory;
                
                // 更新输入框状态
                this.directoryInputEl.disabled = !this.plugin.settings.allowCustomDirectory;
                
                // 更新按钮文本
                button.setButtonText(this.plugin.settings.allowCustomDirectory ? '锁定' : '修改');
                
                // 如果禁用编辑，恢复默认目录
                if (!this.plugin.settings.allowCustomDirectory) {
                    this.directoryInputEl.value = this.plugin.vaultPath;
                    this.hasUnsavedChanges = true;
                }
            }));

        // 同步间隔设置
        new Setting(containerEl)
            .setName('同步间隔（分钟）')
            .setDesc('设置自动同步的时间间隔（分钟）')
            .addText(text => {
                this.intervalInputEl = text
                    .setPlaceholder('分钟')
                    .setValue(this.plugin.settings.syncInterval.toString())
                    .onChange(() => {
                        this.hasUnsavedChanges = true;
                    })
                    .inputEl;
                return text;
            });

        // 自动同步开关
        new Setting(containerEl)
            .setName('启用自动同步')
            .setDesc('开启后将按照设定的时间间隔自动同步')
            .addToggle(toggle => {
                toggle.setValue(this.plugin.settings.isAutoSyncEnabled)
                    .onChange(value => {
                        this.hasUnsavedChanges = true;
                        this.plugin.settings.isAutoSyncEnabled = value;
                    });
                this.autoSyncToggle = toggle;
                return toggle;
            });

        // 手动同步按钮
        new Setting(containerEl)
            .setName('手动同步')
            .setDesc('点击按钮立即执行同步操作')
            .addButton(button => button
                .setButtonText('立即同步')
                .onClick(async () => {
                    // 先应用当前设置
                    await this.saveSettings();
                    // 执行同步
                    await this.plugin.syncGit();
                }));

        // 保存按钮
        new Setting(containerEl)
            .addButton(button => button
                .setButtonText('保存设置')
                .setCta()
                .onClick(async () => {
                    await this.saveSettings();
                    new Notice('设置已保存');
                }));
    }

    async saveSettings() {
        if (this.directoryInputEl && this.intervalInputEl) {
            // 更新设置
            this.plugin.settings.targetDirectory = this.directoryInputEl.value;
            
            // 解析同步间隔
            const intervalValue = parseInt(this.intervalInputEl.value);
            this.plugin.settings.syncInterval = isNaN(intervalValue) ? 5 : intervalValue;
            
            // 注意：this.plugin.settings.isAutoSyncEnabled 已经在 onChange 中设置好了

            // 保存设置
            await this.plugin.saveSettings();

            // 重启自动同步
            if (this.plugin.settings.isAutoSyncEnabled) {
                this.plugin.startAutoSync();
            } else if (this.plugin.syncInterval) {
                clearInterval(this.plugin.syncInterval);
            }

            this.hasUnsavedChanges = false;
        }
    }
} 