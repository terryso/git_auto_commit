import { simpleGit, SimpleGit } from 'simple-git';
import { generateAIMessage } from '../utils/ai-message-generator';
import * as readline from 'readline';
import { OpenAI } from 'openai';
import * as dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

// 检查必要的环境变量
if (!process.env.SILICONFLOW_API_KEY) {
    throw new Error('请在 .env 文件中设置 SILICONFLOW_API_KEY');
}

// 创建默认的 OpenAI client
const defaultOpenAIClient = new OpenAI({
    apiKey: process.env.SILICONFLOW_API_KEY,
    baseURL: 'https://api.siliconflow.cn/v1'
});

export async function generateCommitMessage(git: SimpleGit = simpleGit(), openAIClient: OpenAI = defaultOpenAIClient): Promise<string> {
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
    const message = await generateAIMessage(git, openAIClient);
    
    return message;
}

export async function main(git: SimpleGit = simpleGit(), openAIClient: OpenAI = defaultOpenAIClient) {
    try {
        // 生成提交信息
        const message = await generateCommitMessage(git, openAIClient);
        
        // 获取仓库状态
        const status = await git.status();
        
        // 显示将要提交的文件
        console.log('\n将要提交的文件：');
        if (status.staged.length > 0) {
            console.log('已暂存的文件：');
            status.staged.forEach(file => console.log(`  ${file}`));
        }
        if (status.modified.length > 0) {
            console.log('已修改的文件：');
            status.modified.forEach(file => console.log(`  ${file}`));
        }
        if (status.deleted.length > 0) {
            console.log('已删除的文件：');
            status.deleted.forEach(file => console.log(`  ${file}`));
        }
        
        console.log(`\n生成的提交信息：${message}`);
        
        // 创建 readline 接口
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        // 询问用户是否确认提交
        const answer = await new Promise<string>(resolve => {
            rl.question('\n确认提交？(y/n) ', resolve);
        });
        rl.close();

        if (answer.toLowerCase() === 'n') {
            console.log('已取消提交');
            return;
        }

        // 只提交已跟踪和已暂存的文件
        const filesToCommit = [
            ...status.staged,
            ...status.modified,
            ...status.deleted
        ];
        
        if (filesToCommit.length > 0) {
            // 只添加已跟踪和已暂存的文件
            await git.add(filesToCommit);
            await git.commit(message);
            console.log('提交成功！');
        } else {
            console.log('没有可提交的文件');
        }
    } catch (error: any) {
        console.error('错误：', error.message);
        process.exit(1);
    }
}

// 当直接运行此文件时执行
if (require.main === module) {
    main();
} 