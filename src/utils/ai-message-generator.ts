import { OpenAI } from 'openai';
import { SimpleGit } from 'simple-git';
import { ChatCompletionMessageParam } from 'openai/resources/chat';

// diff 大小限制（字符数）
// DeepSeek-V3 模型支持 64K tokens 上下文
// 1 token ≈ 4 字符（英文），所以理论上最大支持约 260K 字符
// 考虑到系统提示和其他内容也需要 tokens，这里设置为 200K
const MAX_DIFF_SIZE = 100000;

// API 请求超时时间（毫秒）
const API_TIMEOUT = 120000; // 120 秒

interface APIError extends Error {
    response?: {
        data: {
            error: {
                message: string;
            };
        };
    };
}

interface CommitOptions {
    language?: 'zh' | 'en';
}

// 带超时的 Promise
function withTimeout<T>(promise: Promise<T>, timeout: number): Promise<T> {
    let timeoutId: NodeJS.Timeout;
    
    const timeoutPromise = new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => {
            reject(new Error('Request timeout'));
        }, timeout);
    });

    return Promise.race([
        promise.finally(() => clearTimeout(timeoutId)),
        timeoutPromise
    ]);
}

export async function generateAIMessage(
    git: SimpleGit,
    openAIClient: OpenAI,
    options: CommitOptions = { language: 'zh' }
): Promise<string> {
    try {
        // 获取仓库状态
        console.log(options.language === 'en' 
            ? 'Getting repository status...'
            : '正在获取仓库状态...');
        const status = await git.status();
        
        console.log(options.language === 'en'
            ? 'Getting changes content...'
            : '正在获取变更内容...');
        let diff = await git.diff();
        
        // 如果 diff 太大，只保留前面部分
        if (diff.length > MAX_DIFF_SIZE) {
            diff = diff.substring(0, MAX_DIFF_SIZE) + '\n... (diff 太大，已截断)';
            console.log(options.language === 'en' 
                ? '\nWarning: The diff is too large, only showing the first part.'
                : '\n警告：变更内容太大，只显示前面部分。');
        }
        
        // 构建提示信息
        console.log(options.language === 'en'
            ? 'Generating commit message...'
            : '正在生成提交信息...');
        
        const prompt = options.language === 'en' 
            ? `Please generate a commit message for the following Git changes:

Changes content:
${diff}

Please analyze the changes and:
1. Identify the 3 most significant changes
2. Generate a single concise commit message that summarizes these main changes
3. Format the message as <type>: <description>

Type must be one of: feat (new feature) / fix (bug fix).
- Use feat for new files or features
- Use fix for bug fixes or improvements

Requirements:
1. Message must be concise, no more than 100 words
2. Focus on the most impactful changes only
3. Use general descriptions, avoid specific file names
4. Choose the most appropriate type based on the main changes`
            : `请为以下Git变更生成提交信息：

变更内容：
${diff}

请分析变更并：
1. 识别3个最重要的改动
2. 生成一条简洁的提交信息，概括这些主要改动
3. 使用 <type>: <description> 格式

type必须是：feat（新功能）/fix（修复）之一。
- 如果主要涉及新增功能，使用 feat
- 如果主要是修复问题或改进，使用 fix

要求：
1. 提交信息必须简洁，不超过100个字
2. 只关注最有影响力的改动
3. 使用概括性描述，避免列出具体文件名
4. 根据主要改动选择最合适的type`;

        const messages: ChatCompletionMessageParam[] = [
            {
                role: 'system',
                content: options.language === 'en'
                    ? `You are a Git commit message generator assistant. You need to generate concise and clear commit messages in English.
                    The commit message format must be: <type>: <description>
                    Type rules:
                    - feat: for new files or features
                    - fix: for bug fixes or improvements
                    Description must be in English, use general descriptions, do not list specific file names.`
                    : `你是一个Git提交信息生成助手。你需要生成简洁、清晰、符合规范的中文提交信息。
                    提交信息格式必须是：<type>: <description>
                    其中type规则：
                    - feat：用于新增文件或新功能
                    - fix：用于修复问题或改进现有功能
                    description必须是中文，使用概括性描述，不要列出具体文件名。`
            },
            {
                role: 'user',
                content: prompt
            }
        ];

        let response;
        try {
            console.log(options.language === 'en'
                ? 'Waiting for AI response...'
                : '正在等待 AI 响应...');
            response = await withTimeout(
                openAIClient.chat.completions.create({
                    model: "deepseek-ai/DeepSeek-V3",
                    messages,
                    temperature: 0.3,
                    max_tokens: 256,
                    stream: false
                }),
                API_TIMEOUT
            );
        } catch (error: any) {
            if (error.message === 'Request timeout') {
                throw new Error(options.language === 'en'
                    ? 'AI service timeout. Please try again.'
                    : 'AI 服务超时，请重试。');
            }
            const errorMessage = error.response?.data?.error?.message || error.message;
            if (error.response?.status === 400) {
                throw new Error(options.language === 'en'
                    ? `AI service error: Request too large. Try committing changes in smaller batches.`
                    : `AI服务错误：请求内容过大。请尝试分批提交变更。`);
            }
            throw new Error(options.language === 'en'
                ? `AI service error: ${errorMessage}`
                : `AI服务错误：${errorMessage}`);
        }

        if (!response?.choices?.length) {
            throw new Error(options.language === 'en'
                ? 'AI failed to generate a valid commit message'
                : 'AI 未能生成有效的提交信息');
        }

        const message = response.choices[0]?.message?.content?.trim();
        if (!message || !message.match(/^(feat|fix):/)) {
            throw new Error(options.language === 'en'
                ? 'AI failed to generate a valid commit message'
                : 'AI 未能生成有效的提交信息');
        }

        return message;
    } catch (error: any) {
        if (error.message.startsWith('AI服务错误：') || 
            error.message === 'AI 未能生成有效的提交信息' ||
            error.message.startsWith('AI service error:') ||
            error.message === 'AI failed to generate a valid commit message') {
            throw error;
        }
        throw new Error(options.language === 'en'
            ? `AI service error: ${error.message}`
            : `AI服务错误：${error.message}`);
    }
} 