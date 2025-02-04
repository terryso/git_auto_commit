import { getApiKey, setApiKey } from '../utils/config';

export function configCommand(args: string[]) {
    if (args.length === 0) {
        console.log(`
使用方法：
  git-auto-commit config set-api-key <your-api-key>  设置 API 密钥
  git-auto-commit config get-api-key                 获取当前 API 密钥
        `);
        return;
    }

    const [subCommand, ...rest] = args;

    switch (subCommand) {
        case 'set-api-key':
            if (rest.length === 0) {
                console.error('错误：请提供 API 密钥');
                process.exit(1);
            }
            setApiKey(rest[0]);
            console.log('API 密钥已设置');
            break;

        case 'get-api-key':
            const apiKey = getApiKey();
            if (apiKey) {
                console.log(`当前 API 密钥：${apiKey}`);
            } else {
                console.log('API 密钥未设置');
            }
            break;

        default:
            console.error('错误：未知的子命令');
            process.exit(1);
    }
} 