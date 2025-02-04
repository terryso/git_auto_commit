# Git AI 提交信息生成器

[English](./README_EN.md) | 简体中文

一个使用 AI 自动生成 Git 提交信息的命令行工具。

## 功能特点

- 自动分析代码变更并生成符合规范的提交信息
- 支持中文和英文提交信息
- 提供交互式确认机制（可选）
- 支持自动提交模式
- 自动处理各种错误情况

## 安装

```bash
npm install -g @terryso/git-auto-commit
```

## 使用方法

1. 确保你的项目是一个 Git 仓库
2. 添加需要提交的文件到暂存区
3. 配置 API Key：
```bash
git-auto-commit config set apiKey "your-api-key"
```
4. 运行命令：
```bash
git-auto-commit [选项]
```

### 命令选项

- `--en`: 使用英文生成提交信息（默认：中文）
- `-y, --auto-confirm`: 启用自动确认模式，跳过确认步骤
- `config`: 配置管理
  - `set <key> <value>`: 设置配置项
  - `get <key>`: 获取配置项
  - `list`: 列出所有配置
  - `remove <key>`: 删除配置项

示例：
```bash
# 使用英文，自动确认
git-auto-commit --en -y

# 使用中文，手动确认
git-auto-commit

# 配置 API Key
git-auto-commit config set apiKey "your-api-key"
```

工具会：
1. 分析当前的代码变更
2. 使用 AI 生成提交信息
3. 根据设置显示生成的提交信息并等待确认（除非使用 --auto 选项）
4. 执行提交

## API Key 配置

### 方法一：配置命令（推荐）
```bash
git-auto-commit config set apiKey "your-api-key"
```

### 方法二：配置文件
手动编辑配置文件：
```bash
mkdir -p ~/.config/git-auto-commit
echo '{"apiKey": "your-api-key"}' > ~/.config/git-auto-commit/config.json
```

### 注意事项
1. 请勿将 API Key 提交到代码仓库
2. 配置文件位于：~/.config/git-auto-commit/config.json
3. API Key 获取方式：
   1. 访问 https://siliconflow.cn
   2. 注册/登录您的账号
   3. 在控制台中创建 API 密钥

## 提交信息格式

生成的提交信息会总结最多3个主要改动：
```
<type>: <主要改动1>
<type>: <主要改动2>
<type>: <主要改动3>
```

其中：
- type: 必须是 feat（新功能）或 fix（修复）之一
- 每个改动描述使用简洁的中文，不超过20个字
- AI 会分析所有更改，提取最重要的2-3个改动生成提交信息
- 如果改动较小，可能只生成1-2行提交信息

提交信息示例：
```
feat: 添加英文提交信息支持
feat: 新增自动提交模式跳过确认
fix: 修复配置文件读取错误
```

> 注意：工具会智能分析代码变更，提取最重要的改动点。如果您的更改非常多或者复杂，建议将它们分成多个独立的提交，以便更好地追踪和管理代码历史。

## 错误处理

工具会在以下情况下显示错误信息：
- 当前目录不是有效的 Git 仓库
- 没有检测到需要提交的变更
- AI 服务不可用

## 开发

```bash
# 安装依赖
npm install

# 运行测试
npm test

# 运行 BDD 测试
npm run test:bdd

# 构建
npm run build
```

## 许可证

MIT 