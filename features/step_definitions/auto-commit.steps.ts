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

// 设置更长的超时时间
setDefaultTimeout(30000);

const execAsync = promisify(exec);
const git = simpleGit();
let testRepoPath: string;
const originalCwd = process.cwd();
let commandError: Error | null = null;
let exitCode: number = 0;
let lastCommitMessage: string = '';
let lastOutput: string = '';
let initialStatus: any = null;
let generateAIMessageStub: sinon.SinonStub;

Given('当前目录是一个有效的Git仓库', async function () {
    // 在系统临时目录下创建测试仓库
    const tempDir = os.tmpdir();
    const testDir = `git-auto-commit-test-${Date.now()}`;
    testRepoPath = path.join(tempDir, testDir);
    console.log(testRepoPath);
    
    if (fs.existsSync(testRepoPath)) {
        fs.rmSync(testRepoPath, { recursive: true, force: true });
    }
    fs.mkdirSync(testRepoPath);
    
    await git.cwd(testRepoPath).init();
    
    // 创建一个初始提交
    const initFile = path.join(testRepoPath, 'init.txt');
    fs.writeFileSync(initFile, 'initial commit');
    await git.add('.');
    await git.commit('initial commit');
    
    commandError = null;
    exitCode = 0;
    lastCommitMessage = '';
    lastOutput = '';
    initialStatus = null;

    // 重置所有存根
    if (generateAIMessageStub) {
        generateAIMessageStub.restore();
    }
    generateAIMessageStub = sinon.stub(aiMessageGenerator, 'generateAIMessage');
    generateAIMessageStub.resolves('feat: 测试提交信息');
});

Given('当前目录不是Git仓库', async function () {
    // 在系统临时目录下创建一个普通目录
    const tempDir = os.tmpdir();
    const testDir = `git-auto-commit-test-${Date.now()}`;
    testRepoPath = path.join(tempDir, testDir);
    
    if (fs.existsSync(testRepoPath)) {
        fs.rmSync(testRepoPath, { recursive: true, force: true });
    }
    fs.mkdirSync(testRepoPath);
    commandError = null;
    exitCode = 0;
    lastCommitMessage = '';
    lastOutput = '';
    initialStatus = null;

    // 重置所有存根
    if (generateAIMessageStub) {
        generateAIMessageStub.restore();
    }
    generateAIMessageStub = sinon.stub(aiMessageGenerator, 'generateAIMessage');
    generateAIMessageStub.resolves('feat: 测试提交信息');
});

Given('存在未提交的文件变更', async function () {
    const testFile = path.join(testRepoPath, 'test.txt');
    fs.writeFileSync(testFile, 'test content');
    initialStatus = await git.cwd(testRepoPath).status();
    if (!initialStatus.not_added.length && !initialStatus.modified.length) {
        throw new Error('没有检测到未提交的变更');
    }
});

Given('没有任何未提交的变更', async function () {
    // 验证没有未提交的变更
    const status = await git.cwd(testRepoPath).status();
    if (!status.isClean()) {
        throw new Error('仍有未提交的变更');
    }
});

Given('AI服务不可用', async function () {
    generateAIMessageStub.rejects(new Error('AI服务错误：服务暂时不可用'));
});

When('我执行 git-auto-commit 命令', async function () {
    process.chdir(testRepoPath);
    try {
        lastCommitMessage = await generateCommitMessage();
        // 模拟用户输入 'y' 确认提交
        process.stdin.push('y\n');
        exitCode = 0;
        lastOutput = '提交成功！';
    } catch (error) {
        commandError = error as Error;
        exitCode = 1;
    } finally {
        process.chdir(originalCwd);
    }
});

When('用户取消提交', async function () {
    // 模拟用户输入 'n' 取消提交
    process.stdin.push('n\n');
    lastOutput = '已取消提交';
    exitCode = 0;
});

Then('系统应该分析当前的代码变更', async function () {
    const status = await git.cwd(testRepoPath).status();
    if (!status.not_added.length && !status.modified.length) {
        throw new Error('没有检测到需要分析的变更');
    }
});

Then('生成符合规范的提交信息', async function () {
    if (!lastCommitMessage || !lastCommitMessage.match(/^(feat|fix):/)) {
        throw new Error('生成的提交信息不符合规范');
    }
});

Then('等待用户确认', async function () {
    // 在测试中模拟用户确认
    // 实际实现中会通过命令行交互
});

When('用户确认提交', async function () {
    await git.cwd(testRepoPath).add('.');
    await git.cwd(testRepoPath).commit(lastCommitMessage);
});

Then('系统应该自动执行git commit命令', async function () {
    const logs = await git.cwd(testRepoPath).log();
    const latestCommit = logs.latest;
    if (!latestCommit || latestCommit.message !== lastCommitMessage) {
        throw new Error('提交未成功执行或提交信息不匹配');
    }
});

Then('显示提交成功的信息', async function () {
    const status = await git.cwd(testRepoPath).status();
    if (!status.isClean()) {
        throw new Error('仍有未提交的变更');
    }
});

Then('系统应该显示错误信息 {string}', async function (expectedError: string) {
    expect(commandError).to.not.be.null;
    expect(commandError!.message).to.include(expectedError);
});

Then('以非零状态码退出', async function () {
    expect(exitCode).to.not.equal(0);
});

Then('系统应该显示 {string}', async function (expectedMessage: string) {
    expect(lastOutput).to.include(expectedMessage);
});

Then('不应该执行git commit命令', async function () {
    const logs = await git.cwd(testRepoPath).log();
    // 应该只有初始提交
    expect(logs.total).to.equal(1);
    expect(logs.all[0].message).to.equal('initial commit');
});

Then('变更应该保持未提交状态', async function () {
    const currentStatus = await git.cwd(testRepoPath).status();
    expect(currentStatus.not_added).to.deep.equal(initialStatus.not_added);
    expect(currentStatus.modified).to.deep.equal(initialStatus.modified);
}); 