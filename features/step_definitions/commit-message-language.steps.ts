import { Given, When, Then, Before, After, BeforeAll } from '@cucumber/cucumber';
import { expect } from 'chai';
import simpleGit from 'simple-git';
import { generateCommitMessage } from '../../src/commands/git-auto-commit';
import path from 'path';
import { mkdir, writeFile, rm } from 'fs/promises';
import { mockOpenAIClient } from '../../src/utils/mock-openai-client';
import sinon from 'sinon';
import * as aiMessageGeneratorModule from '../../src/utils/ai-message-generator';
import { ICustomWorld } from '../support/world';

declare module '@cucumber/cucumber' {
    interface World extends ICustomWorld {}
}

// 在所有测试开始前执行
BeforeAll(async function() {
    const world = this as unknown as ICustomWorld;
    world.testRepoPath = path.join(process.cwd(), 'test-repo');
});

// 每个场景开始前执行
Before(async function() {
    const world = this as unknown as ICustomWorld;
    world.sandbox = sinon.createSandbox();
    world.generateAIMessageStub = world.sandbox.stub(aiMessageGeneratorModule, 'generateAIMessage');
    
    // 确保测试目录存在
    if (!world.testRepoPath) {
        world.testRepoPath = path.join(process.cwd(), 'test-repo');
    }
    await mkdir(world.testRepoPath, { recursive: true });
    world.gitClient = simpleGit(world.testRepoPath);
    await world.gitClient.init();
    
    // 设置 Git 配置
    await world.gitClient.addConfig('user.name', 'Test User');
    await world.gitClient.addConfig('user.email', 'test@example.com');
    
    // 创建测试文件
    await writeFile(path.join(world.testRepoPath, 'test.txt'), 'test content');
});

// 每个场景结束后执行
After(async function() {
    const world = this as unknown as ICustomWorld;
    if (world.sandbox) {
        world.sandbox.restore();
    }
    
    // 清理测试目录
    try {
        if (world.testRepoPath) {
            await rm(world.testRepoPath, { recursive: true, force: true });
        }
    } catch (error) {
        console.error('清理测试目录失败:', error);
    }
});

Given('当前目录是一个Git仓库', async function() {
    const world = this as unknown as ICustomWorld;
    const isRepo = await world.gitClient.checkIsRepo();
    expect(isRepo).to.be.true;
});

When('我使用英文参数执行命令 {string}', async function(command: string) {
    const world = this as unknown as ICustomWorld;
    world.generateAIMessageStub.resolves('feat: test commit message');
    
    const options = { language: 'en' as const };
    world.generatedMessage = await generateCommitMessage(world.gitClient, mockOpenAIClient, options);
});

Then('系统应该生成英文的提交信息', function() {
    const world = this as unknown as ICustomWorld;
    expect(world.generatedMessage).to.be.a('string');
    expect(world.generatedMessage.length).to.be.greaterThan(0);
});

Then('提交信息应该符合英文语法规范', function() {
    const world = this as unknown as ICustomWorld;
    const containsEnglishWords = /^[a-zA-Z0-9\s:]+$/.test(world.generatedMessage);
    expect(containsEnglishWords).to.be.true;
    
    // 检查基本的英文语法结构
    const hasValidStructure = /^[a-z]+:\s[a-z0-9].*$/i.test(world.generatedMessage);
    expect(hasValidStructure).to.be.true;
});

Then('提交信息格式应该是 {string}', function(format: string) {
    const world = this as unknown as ICustomWorld;
    const formatRegex = /^(feat|fix|docs|style|refactor|test|chore):\s.+$/;
    expect(formatRegex.test(world.generatedMessage)).to.be.true;
    expect(world.generatedMessage).to.match(formatRegex);
});

When('我确认提交', async function() {
    const world = this as unknown as ICustomWorld;
    await world.gitClient.add('.');
    await world.gitClient.commit(world.generatedMessage);
});

Then('变更应该被成功提交到仓库', async function() {
    const world = this as unknown as ICustomWorld;
    const log = await world.gitClient.log();
    expect(log.latest?.message).to.equal(world.generatedMessage);
    
    // 验证工作目录是干净的
    const status = await world.gitClient.status();
    expect(status.isClean()).to.be.true;
}); 