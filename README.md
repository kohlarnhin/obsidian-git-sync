# Obsidian Git Sync 插件

这是一个为Obsidian开发的插件，用于通过Git自动同步指定目录下的文件。

## 主要功能

- 自动检测并使用当前Vault目录作为Git仓库
- 支持自定义同步目录（通过修改按钮）
- 可配置的同步时间间隔（分钟）
- 自动执行git pull、add、commit和push操作
- 提交信息使用时间戳格式（yyyy-MM-dd HH:mm:ss 自动同步/手动同步）
- 支持手动触发同步

## 使用方法

1. 安装插件后，它会自动检测当前Vault目录
2. 设置自动同步的时间间隔（分钟）
3. 启用自动同步功能
4. 点击"保存设置"应用设置
5. 可以通过"立即同步"按钮手动触发同步

## 注意事项

- 确保目标目录已经正确初始化为Git仓库
- 确保已经配置好Git的用户名和邮箱
- 确保有适当的Git仓库访问权限

## 安装方法

1. 下载最新版本的发布包
2. 解压到 Obsidian 插件目录：`.obsidian/plugins/obsidian-git-sync/`
3. 在 Obsidian 中启用插件

## 开发

```bash
# 安装依赖
npm install

# 开发模式
npm run dev

# 构建生产版本
npm run build
``` 