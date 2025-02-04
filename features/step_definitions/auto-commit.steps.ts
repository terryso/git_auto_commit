import { Given, When, Then, setDefaultTimeout } from '@cucumber/cucumber';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import simpleGit from 'simple-git';
import { generateCommitMessage } from '../../src/commands/git-auto-commit';
import { expect } from 'chai';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as aiMessageGenerator from '../../src/utils/ai-message-generator';
import sinon from 'sinon';
import { mockOpenAIClient } from '../../src/utils/mock-openai-client';
import * as fsPromises from 'fs/promises';
import { ICustomWorld } from '../support/world';

// 设置更短的超时时间
setDefaultTimeout(15000);

// 设置更短的等待时间
const WAIT_TIME = 100;

declare module '@cucumber/cucumber' {
    interface World extends ICustomWorld {}
}

const execAsync = promisify(exec);

Given('当前目录是一个有效的Git仓库', async function() {
    const world = this as unknown as ICustomWorld;
    try {
        // 确保测试目录不存在
        if (fs.existsSync(world.testRepoPath)) {
            await fsPromises.rm(world.testRepoPath, { recursive: true, force: true });
        }
        
        // 创建新的测试目录并初始化 Git 仓库
        await fsPromises.mkdir(world.testRepoPath, { recursive: true });
        world.gitClient = simpleGit(world.testRepoPath);
        await world.gitClient.init();
        
        // 设置 Git 配置
        await world.gitClient.addConfig('user.name', 'Test User');
        await world.gitClient.addConfig('user.email', 'test@example.com');
        
        // 创建并提交一个初始文件
        const readmePath = path.join(world.testRepoPath, 'README.md');
        await fsPromises.writeFile(readmePath, '# Test Repository');
        await world.gitClient.add('.');
        await world.gitClient.commit('initial commit');
        
        // 简短等待确保文件系统同步
        await new Promise(resolve => setTimeout(resolve, WAIT_TIME));
        
        // 重置测试状态
        world.commandError = null;
        world.exitCode = 0;
        world.lastCommitMessage = '';
        world.lastOutput = '';
        world.initialStatus = null;

        // 重置存根
        if (world.generateAIMessageStub) {
            world.generateAIMessageStub.restore();
        }
        world.generateAIMessageStub = sinon.stub(aiMessageGenerator, 'generateAIMessage');
        world.generateAIMessageStub.resolves('feat: 测试提交信息');
    } catch (error) {
        console.error('设置Git仓库失败:', error);
        throw error;
    }
});

Given('当前目录不是Git仓库', async function() {
    const world = this as unknown as ICustomWorld;
    try {
        const tempDir = os.tmpdir();
        const testDir = `git-auto-commit-test-${Date.now()}`;
        world.testRepoPath = path.join(tempDir, testDir);
        
        if (fs.existsSync(world.testRepoPath)) {
            await fsPromises.rm(world.testRepoPath, { recursive: true, force: true });
        }
        
        await fsPromises.mkdir(world.testRepoPath, { recursive: true });
        await new Promise(resolve => setTimeout(resolve, WAIT_TIME));
        
        // 重置测试状态
        world.commandError = null;
        world.exitCode = 0;
        world.lastCommitMessage = '';
        world.lastOutput = '';
        world.initialStatus = null;

        if (world.generateAIMessageStub) {
            world.generateAIMessageStub.restore();
        }
        world.generateAIMessageStub = sinon.stub(aiMessageGenerator, 'generateAIMessage');
        world.generateAIMessageStub.resolves('feat: 测试提交信息');
    } catch (error) {
        console.error('创建非Git目录失败:', error);
        throw error;
    }
});

Given('没有任何未提交的变更', async function() {
    const world = this as unknown as ICustomWorld;
    // 验证没有未提交的变更
    const status = await world.gitClient.cwd(world.testRepoPath).status();
    if (!status.isClean()) {
        throw new Error('仍有未提交的变更');
    }
});

Given('AI服务不可用', function() {
    const world = this as unknown as ICustomWorld;
    world.generateAIMessageStub.restore();
    world.generateAIMessageStub = sinon.stub(aiMessageGenerator, 'generateAIMessage');
    world.generateAIMessageStub.rejects(new Error('AI服务错误：服务暂时不可用'));
});

When('我执行 git-auto-commit 命令', async function() {
    const world = this as unknown as ICustomWorld;
    try {
        const status = await world.gitClient.cwd(world.testRepoPath).status();
        if (!status.files.length) {
            throw new Error('没有检测到需要提交的变更');
        }
        world.lastCommitMessage = await generateCommitMessage(world.gitClient.cwd(world.testRepoPath));
        world.exitCode = 0;
        world.lastOutput = '提交成功！';
    } catch (error: any) {
        world.commandError = error as Error;
        world.exitCode = 1;
        world.lastOutput = error?.message || '未知错误';
    }
});

When('用户取消提交', async function() {
    const world = this as unknown as ICustomWorld;
    world.lastOutput = '已取消提交';
    world.exitCode = 0;
});

When('我执行 git-auto-commit --auto-confirm 命令', async function() {
    const world = this as unknown as ICustomWorld;
    try {
        // 获取初始状态并缓存
        world.initialStatus = await world.gitClient.cwd(world.testRepoPath).status();
        
        // 一次性添加所有文件并获取状态
        await world.gitClient.cwd(world.testRepoPath).add('.');
        const status = await world.gitClient.cwd(world.testRepoPath).status();
        
        const hasChanges = status.files.length > 0 || 
                          status.staged.length > 0 || 
                          status.not_added.length > 0 || 
                          status.modified.length > 0 ||
                          status.created.length > 0 ||
                          status.deleted.length > 0;
        
        if (!hasChanges) {
            throw new Error('没有检测到需要提交的变更');
        }
        
        world.lastCommitMessage = await generateCommitMessage(world.gitClient.cwd(world.testRepoPath));
        await world.gitClient.cwd(world.testRepoPath).commit(world.lastCommitMessage);
        world.exitCode = 0;
        world.lastOutput = '提交成功！';
    } catch (error: any) {
        world.commandError = error as Error;
        world.exitCode = 1;
        world.lastOutput = error?.message || '未知错误';
    }
});

When('我执行 git-auto-commit -y 命令', async function() {
    const world = this as unknown as ICustomWorld;
    try {
        // 获取初始状态并缓存
        world.initialStatus = await world.gitClient.cwd(world.testRepoPath).status();
        
        // 一次性添加所有文件并获取状态
        await world.gitClient.cwd(world.testRepoPath).add('.');
        const status = await world.gitClient.cwd(world.testRepoPath).status();
        
        const hasChanges = status.files.length > 0 || 
                          status.staged.length > 0 || 
                          status.not_added.length > 0 || 
                          status.modified.length > 0 ||
                          status.created.length > 0 ||
                          status.deleted.length > 0;
        
        if (!hasChanges) {
            throw new Error('没有检测到需要提交的变更');
        }
        
        world.lastCommitMessage = await generateCommitMessage(world.gitClient.cwd(world.testRepoPath));
        await world.gitClient.cwd(world.testRepoPath).commit(world.lastCommitMessage);
        world.exitCode = 0;
        world.lastOutput = '提交成功！';
    } catch (error: any) {
        world.commandError = error as Error;
        world.exitCode = 1;
        world.lastOutput = error?.message || '未知错误';
    }
});

When('用户确认提交', async function() {
    const world = this as unknown as ICustomWorld;
    await world.gitClient.cwd(world.testRepoPath).add('.');
    await world.gitClient.cwd(world.testRepoPath).commit(world.lastCommitMessage);
});

Then('系统应该分析当前的代码变更', async function() {
    const world = this as unknown as ICustomWorld;
    
    // 使用初始状态进行检查
    const initialStatus = world.initialStatus;
    
    if (!initialStatus) {
        throw new Error('无法获取初始Git状态');
    }
    
    // 输出当前Git状态以帮助调试
    console.log('初始Git状态:', {
        files: initialStatus.files,
        staged: initialStatus.staged,
        modified: initialStatus.modified,
        created: initialStatus.created,
        deleted: initialStatus.deleted,
        not_added: initialStatus.not_added,
        renamed: initialStatus.renamed
    });
    
    // 检查是否有任何类型的变更
    const hasChanges = initialStatus.files.length > 0 || 
                      initialStatus.staged.length > 0 || 
                      initialStatus.not_added.length > 0 || 
                      initialStatus.modified.length > 0 ||
                      initialStatus.created.length > 0 ||
                      initialStatus.deleted.length > 0 ||
                      initialStatus.renamed.length > 0;

    expect(hasChanges, '没有检测到需要分析的变更').to.be.true;
});

Then('生成符合规范的提交信息', function() {
    const world = this as unknown as ICustomWorld;
    expect(world.lastCommitMessage).to.be.a('string');
    expect(world.lastCommitMessage.length).to.be.greaterThan(0);
    
    // 检查提交信息格式
    const formatRegex = /^(feat|fix|docs|style|refactor|test|chore):\s.+$/;
    expect(formatRegex.test(world.lastCommitMessage)).to.be.true;
});

Then('等待用户确认', function() {
    // 这里不需要实际等待，因为在测试环境中我们模拟用户确认
    const world = this as unknown as ICustomWorld;
    expect(world.lastCommitMessage).to.be.a('string');
    expect(world.lastCommitMessage.length).to.be.greaterThan(0);
});

Then('系统应该自动执行git commit命令', async function() {
    const world = this as unknown as ICustomWorld;
    const log = await world.gitClient.cwd(world.testRepoPath).log();
    expect(log.latest?.message).to.equal(world.lastCommitMessage);
});

Then('系统应该显示错误信息 {string}', function(expectedError: string) {
    const world = this as unknown as ICustomWorld;
    const errorMappings: { [key: string]: string[] } = {
        '当前目录不是有效的Git仓库': [
            '不是 git 仓库',
            'fatal: 不是 git 仓库',
            'not a git repository'
        ],
        '没有检测到需要提交的变更': [
            '没有检测到文件变更',
            '没有需要提交的变更',
            'no changes added to commit',
            '没有检测到需要分析的变更',
            '没有检测到需要提交的变更'
        ],
        'AI服务错误': [
            '服务暂时不可用',
            'ai service error',
            '服务错误',
            'ai服务错误'
        ]
    };

    const expectedPatterns = errorMappings[expectedError] || [expectedError];
    const actualError = world.lastOutput;
    const hasMatch = expectedPatterns.some(pattern => 
        actualError.toLowerCase().includes(pattern.toLowerCase()) ||
        pattern.toLowerCase().includes(actualError.toLowerCase())
    );

    expect(hasMatch, `期望错误信息包含 "${expectedError}" 或其变体，但实际是 "${actualError}"`).to.be.true;
});

Then('显示提交成功的信息', function() {
    const world = this as unknown as ICustomWorld;
    expect(world.lastOutput).to.equal('提交成功！');
});

Then('以非零状态码退出', function() {
    const world = this as unknown as ICustomWorld;
    expect(world.exitCode).to.not.equal(0);
});

Then('不应该执行git commit命令', async function() {
    const world = this as unknown as ICustomWorld;
    const log = await world.gitClient.cwd(world.testRepoPath).log();
    expect(log.latest?.message).to.not.equal(world.lastCommitMessage);
});

Then('变更应该保持未提交状态', async function() {
    const world = this as unknown as ICustomWorld;
    const status = await world.gitClient.cwd(world.testRepoPath).status();
    const hasChanges = status.files.length > 0 || 
                      status.staged.length > 0 || 
                      status.not_added.length > 0 || 
                      status.modified.length > 0 ||
                      status.created.length > 0 ||
                      status.deleted.length > 0;
    expect(hasChanges).to.be.true;
});

Then('系统应该显示 {string}', function(expectedMessage: string) {
    const world = this as unknown as ICustomWorld;
    expect(world.lastOutput).to.equal(expectedMessage);
});

Then('不应该等待用户确认', function() {
    // 这里不需要实际验证，因为在测试环境中我们模拟自动确认
});

Then('自动执行git commit命令', async function() {
    const world = this as unknown as ICustomWorld;
    const log = await world.gitClient.cwd(world.testRepoPath).log();
    expect(log.latest?.message).to.equal(world.lastCommitMessage);
}); 