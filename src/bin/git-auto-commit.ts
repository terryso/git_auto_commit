#!/usr/bin/env node

import { configCommand } from '../commands/config';
import { main } from '../commands/git-auto-commit';
import { simpleGit } from 'simple-git';

// 解析命令行参数
const args = process.argv.slice(2);

// 处理配置命令
if (args[0] === 'config') {
    configCommand(args.slice(1));
    process.exit(0);
}

// 处理主命令
const autoConfirm = args.includes('--auto-confirm') || args.includes('-y');
const language = args.includes('--en') ? 'en' : 'zh';
main(simpleGit(), undefined, autoConfirm, { language }); 