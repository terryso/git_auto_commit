import { simpleGit, SimpleGit } from 'simple-git';
import * as readline from 'readline';
import { OpenAI } from 'openai';
import { getApiKey } from '../utils/config';
import { generateAIMessage } from '../utils/ai-message-generator';

// 创建 OpenAI client
function createOpenAIClient(): OpenAI {
    const apiKey = getApiKey();
    if (!apiKey) {
        throw new Error(`请先设置 API 密钥。

您可以通过以下命令设置 API 密钥：
git-auto-commit config set-api-key <your-api-key>

如果您还没有 API 密钥，可以通过以下步骤获取：
1. 访问 https://siliconflow.cn
2. 注册/登录您的账号
3. 在控制台中创建 API 密钥`);
    }

    return new OpenAI({
        apiKey,
        baseURL: 'https://api.siliconflow.cn/v1',
        defaultHeaders: {
            'Content-Type': 'application/json'
        }
    });
}

interface CommitOptions {
    language?: 'zh' | 'en';
}

export async function generateCommitMessage(
    git: SimpleGit = simpleGit(),
    openAIClient?: OpenAI,
    options: CommitOptions = { language: 'zh' }
): Promise<string> {
    // 检查是否是Git仓库
    const isRepo = await git.checkIsRepo();
    if (!isRepo) {
        throw new Error('当前目录不是有效的Git仓库');
    }

    // 获取仓库状态
    const status = await git.status();
    
    // 检查是否有变更
    if (status.isClean()) {
        throw new Error('没有检测到需要提交的变更');
    }

    // 使用 AI 生成提交信息
    const message = await generateAIMessage(git, openAIClient || createOpenAIClient(), options);
    
    return message;
}

export async function main(
    git: SimpleGit = simpleGit(), 
    openAIClient?: OpenAI,
    autoConfirm: boolean = false,
    options: CommitOptions = { language: 'zh' }
) {
    try {
        // 生成提交信息
        const message = await generateCommitMessage(git, openAIClient, options);
        
        // 获取仓库状态
        const status = await git.status();
        
        // 显示将要提交的文件
        console.log(options.language === 'en' ? '\nFiles to be committed:' : '\n将要提交的文件：');
        if (status.staged.length > 0) {
            console.log(options.language === 'en' ? 'Staged files:' : '已暂存的文件：');
            status.staged.forEach(file => console.log(`  ${file}`));
        }
        if (status.modified.length > 0) {
            console.log(options.language === 'en' ? 'Modified files:' : '已修改的文件：');
            status.modified.forEach(file => console.log(`  ${file}`));
        }
        if (status.deleted.length > 0) {
            console.log(options.language === 'en' ? 'Deleted files:' : '已删除的文件：');
            status.deleted.forEach(file => console.log(`  ${file}`));
        }
        
        console.log(options.language === 'en' ? `\nGenerated commit message: ${message}` : `\n生成的提交信息：${message}`);
        
        // 准备要提交的文件
        const filesToCommit = [
            ...status.staged,
            ...status.modified,
            ...status.deleted,
            ...status.not_added
        ];
        
        if (filesToCommit.length === 0) {
            console.log(options.language === 'en' ? 'No files to commit' : '没有可提交的文件');
            return;
        }

        // 在测试环境中或自动确认模式下跳过用户确认
        if (process.env.NODE_ENV === 'test' || autoConfirm) {
            await git.add(filesToCommit);
            await git.commit(message);
            console.log(options.language === 'en' ? 'Commit successful!' : '提交成功！');
            if (process.env.NODE_ENV !== 'test') {
                process.exit(0);
            }
            return;
        }

        // 创建 readline 接口
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        try {
            // 询问用户是否确认提交
            const answer = await new Promise<string>(resolve => {
                rl.question(options.language === 'en' ? '\nConfirm commit? (y/n) ' : '\n确认提交？(y/n) ', resolve);
            });
            rl.close();

            if (answer.toLowerCase() === 'n') {
                console.log(options.language === 'en' ? 'Commit cancelled' : '已取消提交');
                if (process.env.NODE_ENV !== 'test') {
                    process.exit(0);
                }
                return;
            }

            await git.add(filesToCommit);
            await git.commit(message);
            console.log(options.language === 'en' ? 'Commit successful!' : '提交成功！');
            if (process.env.NODE_ENV !== 'test') {
                process.exit(0);
            }
            return;
        } catch (error) {
            rl.close();
            throw error;
        }
    } catch (error: any) {
        console.error(options.language === 'en' ? 'Error: ' : '错误：', error.message);
        if (process.env.NODE_ENV !== 'test') {
            process.exit(1);
        }
        throw error;
    }
} 