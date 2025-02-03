import { OpenAI } from 'openai';
import { SimpleGit } from 'simple-git';
import * as dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

// 检查必要的环境变量
if (!process.env.SILICONFLOW_API_KEY) {
    throw new Error('请在 .env 文件中设置 SILICONFLOW_API_KEY');
}

interface APIError extends Error {
    response?: {
        data: {
            error: {
                message: string;
            };
        };
    };
}

export async function generateAIMessage(git: SimpleGit, openAIClient: OpenAI): Promise<string> {
    try {
        // 获取仓库状态
        const status = await git.status();
        const diff = await git.diff();
        
        // 构建提示信息
        const prompt = `请为以下Git变更生成提交信息：

变更状态：
- 新增文件：${status.not_added.join(', ')}
- 修改文件：${status.modified.join(', ')}
- 删除文件：${status.deleted.join(', ')}
- 重命名文件：${status.renamed.map(r => `${r.from} -> ${r.to}`).join(', ')}

变更内容：
${diff}

请生成一条简洁的中文提交信息，格式为 <type>: <description>。
type必须是：feat（新功能）/fix（修复）之一。
- 如果涉及新增文件或新功能，使用 feat
- 如果是修复问题或改进现有功能，使用 fix

要求：
1. 提交信息必须简洁，不超过20个字
2. 不要列出具体的文件名，使用概括性的描述
3. 根据变更内容选择最合适的type`;

        let response;
        try {
            response = await openAIClient.chat.completions.create({
                model: "deepseek-ai/DeepSeek-V3",
                messages: [
                    {
                        role: "system",
                        content: `你是一个Git提交信息生成助手。你需要生成简洁、清晰、符合规范的中文提交信息。
                        提交信息格式必须是：<type>: <description>
                        其中type规则：
                        - feat：用于新增文件或新功能
                        - fix：用于修复问题或改进现有功能
                        description必须是中文，使用概括性描述，不要列出具体文件名。`
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                temperature: 0.3,
                max_tokens: 100
            });
        } catch (error: any) {
            const errorMessage = error.response?.data?.error?.message || error.message;
            throw new Error(`AI服务错误：${errorMessage}`);
        }

        if (!response?.choices?.length) {
            throw new Error('AI 未能生成有效的提交信息');
        }

        const message = response.choices[0]?.message?.content?.trim();
        if (!message || !message.match(/^(feat|fix):/)) {
            throw new Error('AI 未能生成有效的提交信息');
        }

        return message;
    } catch (error: any) {
        if (error.message.startsWith('AI服务错误：') || 
            error.message === 'AI 未能生成有效的提交信息') {
            throw error;
        }
        throw new Error(`AI服务错误：${error.message}`);
    }
} 