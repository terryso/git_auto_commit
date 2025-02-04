import { expect } from 'chai';
import * as sinon from 'sinon';
import * as simpleGitModule from 'simple-git';
import * as aiMessageGenerator from '../utils/ai-message-generator';
import { StatusResult } from 'simple-git';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import proxyquire from 'proxyquire';

chai.use(chaiAsPromised);

describe('git-auto-commit', () => {
    let gitStub: any;
    let generateAIMessageStub: sinon.SinonStub;
    let consoleLogStub: sinon.SinonStub;
    let consoleErrorStub: sinon.SinonStub;
    let processExitStub: sinon.SinonStub;
    let mockOpenAIClient: any;
    let mockReadline: any;
    let gitAutoCommit: any;
    let originalNodeEnv: string | undefined;

    beforeEach(() => {
        // 保存原始的 NODE_ENV
        originalNodeEnv = process.env.NODE_ENV;
        // 确保测试在非测试环境运行
        delete process.env.NODE_ENV;

        // 设置 git 存根
        gitStub = {
            checkIsRepo: sinon.stub(),
            status: sinon.stub(),
            diff: sinon.stub(),
            add: sinon.stub(),
            commit: sinon.stub()
        };

        // 设置 generateAIMessage 存根
        generateAIMessageStub = sinon.stub(aiMessageGenerator, 'generateAIMessage');
        generateAIMessageStub.resolves('feat: 测试提交信息');

        // 设置 console 存根
        consoleLogStub = sinon.stub(console, 'log');
        consoleErrorStub = sinon.stub(console, 'error');

        // 设置 process.exit 存根
        processExitStub = sinon.stub(process, 'exit');

        // 设置 mock OpenAI client
        mockOpenAIClient = {
            chat: {
                completions: {
                    create: sinon.stub().resolves({
                        choices: [{
                            message: {
                                content: 'feat: 测试提交信息'
                            }
                        }]
                    })
                }
            }
        };

        // 设置 mock readline
        mockReadline = {
            question: sinon.stub(),
            close: sinon.stub(),
            input: process.stdin,
            output: process.stdout
        };

        // 使用 proxyquire 替换 readline 模块
        gitAutoCommit = proxyquire('./git-auto-commit', {
            readline: {
                createInterface: () => mockReadline
            }
        });
    });

    afterEach(() => {
        // 恢复原始的 NODE_ENV
        if (originalNodeEnv) {
            process.env.NODE_ENV = originalNodeEnv;
        } else {
            delete process.env.NODE_ENV;
        }
        sinon.restore();
    });

    describe('generateCommitMessage', () => {
        it('应该在有变更时生成提交信息', async () => {
            // 设置存根
            gitStub.checkIsRepo.resolves(true);
            gitStub.status.resolves({ isClean: () => false } as StatusResult);
            
            // 执行测试
            const message = await gitAutoCommit.generateCommitMessage(gitStub, mockOpenAIClient);
            
            // 验证结果
            expect(message).to.equal('feat: 测试提交信息');
            expect(gitStub.checkIsRepo.called).to.be.true;
            expect(gitStub.status.called).to.be.true;
        });

        it('应该在非Git仓库时抛出错误', async () => {
            // 设置存根
            gitStub.checkIsRepo.resolves(false);
            
            // 执行测试
            await expect(gitAutoCommit.generateCommitMessage(gitStub, mockOpenAIClient))
                .to.be.rejectedWith('当前目录不是有效的Git仓库');
            
            expect(gitStub.checkIsRepo.called).to.be.true;
        });

        it('应该在没有变更时抛出错误', async () => {
            // 设置存根
            gitStub.checkIsRepo.resolves(true);
            gitStub.status.resolves({ isClean: () => true } as StatusResult);
            
            // 执行测试
            await expect(gitAutoCommit.generateCommitMessage(gitStub, mockOpenAIClient))
                .to.be.rejectedWith('没有检测到需要提交的变更');
            
            expect(gitStub.checkIsRepo.called).to.be.true;
            expect(gitStub.status.called).to.be.true;
        });

        it('应该在AI服务不可用时抛出错误', async () => {
            // 设置存根
            gitStub.checkIsRepo.resolves(true);
            gitStub.status.resolves({ isClean: () => false } as StatusResult);
            generateAIMessageStub.rejects(new Error('AI服务错误：服务暂时不可用'));
            
            // 执行测试
            await expect(gitAutoCommit.generateCommitMessage(gitStub, mockOpenAIClient))
                .to.be.rejectedWith('AI服务错误：服务暂时不可用');
            
            expect(gitStub.checkIsRepo.called).to.be.true;
            expect(gitStub.status.called).to.be.true;
        });

        describe('语言选项', () => {
            it('应该默认生成中文提交信息', async () => {
                // 设置存根
                gitStub.checkIsRepo.resolves(true);
                gitStub.status.resolves({ isClean: () => false } as StatusResult);
                generateAIMessageStub.withArgs(
                    gitStub,
                    mockOpenAIClient,
                    { language: 'zh' }
                ).resolves('feat: 测试提交信息');
                
                // 执行测试
                const message = await gitAutoCommit.generateCommitMessage(gitStub, mockOpenAIClient);
                
                // 验证结果
                expect(message).to.equal('feat: 测试提交信息');
                expect(generateAIMessageStub.calledWith(
                    gitStub,
                    mockOpenAIClient,
                    { language: 'zh' }
                )).to.be.true;
            });

            it('应该能生成英文提交信息', async () => {
                // 设置存根
                gitStub.checkIsRepo.resolves(true);
                gitStub.status.resolves({ isClean: () => false } as StatusResult);
                generateAIMessageStub.withArgs(
                    gitStub,
                    mockOpenAIClient,
                    { language: 'en' }
                ).resolves('feat: test commit message');
                
                // 执行测试
                const message = await gitAutoCommit.generateCommitMessage(gitStub, mockOpenAIClient, { language: 'en' });
                
                // 验证结果
                expect(message).to.equal('feat: test commit message');
                expect(generateAIMessageStub.calledWith(
                    gitStub,
                    mockOpenAIClient,
                    { language: 'en' }
                )).to.be.true;
            });

            it('应该在英文模式下处理AI服务错误', async () => {
                // 设置存根
                gitStub.checkIsRepo.resolves(true);
                gitStub.status.resolves({ isClean: () => false } as StatusResult);
                generateAIMessageStub.withArgs(
                    gitStub,
                    mockOpenAIClient,
                    { language: 'en' }
                ).rejects(new Error('AI Service Error: Service Temporarily Unavailable'));
                
                // 执行测试
                await expect(gitAutoCommit.generateCommitMessage(gitStub, mockOpenAIClient, { language: 'en' }))
                    .to.be.rejectedWith('AI Service Error: Service Temporarily Unavailable');
                
                expect(gitStub.checkIsRepo.called).to.be.true;
                expect(gitStub.status.called).to.be.true;
            });

            it('应该生成符合英文语法规范的提交信息', async () => {
                // 设置存根
                gitStub.checkIsRepo.resolves(true);
                gitStub.status.resolves({ isClean: () => false } as StatusResult);
                generateAIMessageStub.withArgs(
                    gitStub,
                    mockOpenAIClient,
                    { language: 'en' }
                ).resolves('feat: add new feature for user authentication');
                
                // 执行测试
                const message = await gitAutoCommit.generateCommitMessage(gitStub, mockOpenAIClient, { language: 'en' });
                
                // 验证结果
                expect(message).to.match(/^(feat|fix|docs|style|refactor|test|chore):/);
                expect(message).to.match(/^[a-z]+: [a-z]/); // 确保类型和描述都是小写开头
                expect(message.split(': ')[1]).to.match(/^[a-z].*[^.]$/); // 描述以小写开头，不以句号结尾
            });

            it('应该在英文模式下生成正确的提交类型', async () => {
                // 设置存根
                gitStub.checkIsRepo.resolves(true);
                gitStub.status.resolves({ isClean: () => false } as StatusResult);
                generateAIMessageStub.withArgs(
                    gitStub,
                    mockOpenAIClient,
                    { language: 'en' }
                ).resolves('feat: implement user authentication');
                
                // 执行测试
                const message = await gitAutoCommit.generateCommitMessage(gitStub, mockOpenAIClient, { language: 'en' });
                
                // 验证结果
                const validTypes = ['feat', 'fix', 'docs', 'style', 'refactor', 'test', 'chore'];
                const type = message.split(':')[0];
                expect(validTypes).to.include(type);
            });
        });
    });

    describe('main', () => {
        it('应该在用户确认时执行提交', async () => {
            // 设置存根
            gitStub.checkIsRepo.resolves(true);
            gitStub.status.resolves({ 
                isClean: () => false,
                staged: ['file1.ts'],
                modified: ['file2.ts'],
                deleted: [],
                not_added: [],
                conflicted: [],
                created: [],
                renamed: [],
                files: [],
                ahead: 0,
                behind: 0,
                current: 'main',
                tracking: null,
                detached: false
            } as StatusResult);
            
            // 模拟用户输入 'y'
            mockReadline.question.callsFake((query: string, callback: (answer: string) => void) => {
                callback('y');
            });

            // 执行测试
            await gitAutoCommit.main(gitStub, mockOpenAIClient);

            // 验证结果
            expect(gitStub.add.calledWith(['file1.ts', 'file2.ts'])).to.be.true;
            expect(gitStub.commit.calledWith('feat: 测试提交信息')).to.be.true;
            expect(consoleLogStub.calledWith('提交成功！')).to.be.true;
        });

        it('应该在用户取消时不执行提交', async () => {
            // 确保不在测试环境中运行
            delete process.env.NODE_ENV;

            // 设置存根
            gitStub.checkIsRepo.resolves(true);
            gitStub.status.resolves({ 
                isClean: () => false,
                staged: ['file1.ts'],
                modified: ['file2.ts'],
                deleted: [],
                not_added: [],
                conflicted: [],
                created: [],
                renamed: [],
                files: [],
                ahead: 0,
                behind: 0,
                current: 'main',
                tracking: null,
                detached: false
            } as StatusResult);
            
            // 模拟用户输入 'n'
            mockReadline.question.callsFake((query: string, callback: (answer: string) => void) => {
                callback('n');
            });

            // 执行测试
            await gitAutoCommit.main(gitStub, mockOpenAIClient);

            // 验证结果
            expect(gitStub.add.called).to.be.false;
            expect(gitStub.commit.called).to.be.false;
            expect(consoleLogStub.calledWith('已取消提交')).to.be.true;
        });

        it('应该在测试环境中自动执行提交', async () => {
            // 设置测试环境
            process.env.NODE_ENV = 'test';

            // 设置存根
            gitStub.checkIsRepo.resolves(true);
            gitStub.status.resolves({ 
                isClean: () => false,
                staged: ['file1.ts'],
                modified: ['file2.ts'],
                deleted: [],
                not_added: [],
                conflicted: [],
                created: [],
                renamed: [],
                files: [],
                ahead: 0,
                behind: 0,
                current: 'main',
                tracking: null,
                detached: false
            } as StatusResult);

            // 执行测试
            await gitAutoCommit.main(gitStub, mockOpenAIClient);

            // 验证结果
            expect(gitStub.add.calledWith(['file1.ts', 'file2.ts'])).to.be.true;
            expect(gitStub.commit.calledWith('feat: 测试提交信息')).to.be.true;
            expect(consoleLogStub.calledWith('提交成功！')).to.be.true;
            expect(mockReadline.question.called).to.be.false;
        });

        it('应该在发生错误时显示错误信息并以非零状态码退出', async () => {
            // 设置存根
            gitStub.checkIsRepo.resolves(false);

            try {
                // 执行测试
                await gitAutoCommit.main(gitStub, mockOpenAIClient);
                // 如果没有抛出错误，测试应该失败
                expect.fail('应该抛出错误');
            } catch (error: any) {
                // 验证结果
                expect(consoleErrorStub.calledWith('错误：', '当前目录不是有效的Git仓库')).to.be.true;
                expect(processExitStub.calledWith(1)).to.be.true;
            }
        });

        it('应该在AI服务不可用时显示错误信息并以非零状态码退出', async () => {
            // 设置存根
            gitStub.checkIsRepo.resolves(true);
            gitStub.status.resolves({ isClean: () => false } as StatusResult);
            generateAIMessageStub.rejects(new Error('AI服务错误：服务暂时不可用'));

            try {
                // 执行测试
                await gitAutoCommit.main(gitStub, mockOpenAIClient);
                // 如果没有抛出错误，测试应该失败
                expect.fail('应该抛出错误');
            } catch (error: any) {
                // 验证结果
                expect(consoleErrorStub.calledWith('错误：', 'AI服务错误：服务暂时不可用')).to.be.true;
                expect(processExitStub.calledWith(1)).to.be.true;
            }
        });

        it('应该在自动确认模式下自动执行提交', async () => {
            // 设置存根
            gitStub.checkIsRepo.resolves(true);
            gitStub.status.resolves({ 
                isClean: () => false,
                staged: ['file1.ts'],
                modified: ['file2.ts'],
                deleted: [],
                not_added: ['file3.ts'],
                conflicted: [],
                created: [],
                renamed: [],
                files: [],
                ahead: 0,
                behind: 0,
                current: 'main',
                tracking: null,
                detached: false
            } as StatusResult);

            // 执行测试
            await gitAutoCommit.main(gitStub, mockOpenAIClient, true);

            // 验证结果
            expect(gitStub.add.calledWith(['file1.ts', 'file2.ts', 'file3.ts'])).to.be.true;
            expect(gitStub.commit.calledWith('feat: 测试提交信息')).to.be.true;
            expect(consoleLogStub.calledWith('提交成功！')).to.be.true;
            expect(mockReadline.question.called).to.be.false;
        });

        it('应该在自动确认模式下处理没有可提交文件的情况', async () => {
            // 设置存根
            gitStub.checkIsRepo.resolves(true);
            gitStub.status.resolves({ 
                isClean: () => true,
                staged: [],
                modified: [],
                deleted: [],
                not_added: [],
                conflicted: [],
                created: [],
                renamed: [],
                files: [],
                ahead: 0,
                behind: 0,
                current: 'main',
                tracking: null,
                detached: false
            } as StatusResult);

            try {
                // 执行测试
                await gitAutoCommit.main(gitStub, mockOpenAIClient, true);
                // 如果没有抛出错误，测试应该失败
                expect.fail('应该抛出错误');
            } catch (error: any) {
                // 验证结果
                expect(consoleErrorStub.calledWith('错误：', '没有检测到需要提交的变更')).to.be.true;
                expect(processExitStub.calledWith(1)).to.be.true;
                expect(gitStub.commit.called).to.be.false;
            }
        });

        it('应该在自动确认模式下处理错误情况', async () => {
            // 设置存根
            gitStub.checkIsRepo.resolves(true);
            gitStub.status.resolves({ 
                isClean: () => false,
                staged: ['file1.ts'],
                modified: [],
                deleted: [],
                not_added: [],
                conflicted: [],
                created: [],
                renamed: [],
                files: [],
                ahead: 0,
                behind: 0,
                current: 'main',
                tracking: null,
                detached: false
            } as StatusResult);
            gitStub.add.rejects(new Error('Git错误'));

            try {
                // 执行测试
                await gitAutoCommit.main(gitStub, mockOpenAIClient, true);
                // 如果没有抛出错误，测试应该失败
                expect.fail('应该抛出错误');
            } catch (error: any) {
                // 验证结果
                expect(consoleErrorStub.calledWith('错误：', 'Git错误')).to.be.true;
                expect(processExitStub.calledWith(1)).to.be.true;
            }
        });

        describe('自动确认模式', () => {
            it('应该在使用 --auto-confirm 参数时自动执行提交', async () => {
                // 设置存根
                gitStub.checkIsRepo.resolves(true);
                gitStub.status.resolves({ 
                    isClean: () => false,
                    staged: ['file1.ts'],
                    modified: ['file2.ts'],
                    deleted: [],
                    not_added: [],
                    conflicted: [],
                    created: [],
                    renamed: [],
                    files: [],
                    ahead: 0,
                    behind: 0,
                    current: 'main',
                    tracking: null,
                    detached: false
                } as StatusResult);

                // 执行测试
                await gitAutoCommit.main(gitStub, mockOpenAIClient, true);

                // 验证结果
                expect(gitStub.add.calledWith(['file1.ts', 'file2.ts'])).to.be.true;
                expect(gitStub.commit.calledWith('feat: 测试提交信息')).to.be.true;
                expect(consoleLogStub.calledWith('提交成功！')).to.be.true;
                expect(mockReadline.question.called).to.be.false;
            });

            it('应该在使用 -y 参数时自动执行提交', async () => {
                // 设置存根
                gitStub.checkIsRepo.resolves(true);
                gitStub.status.resolves({ 
                    isClean: () => false,
                    staged: ['file1.ts'],
                    modified: ['file2.ts'],
                    deleted: [],
                    not_added: [],
                    conflicted: [],
                    created: [],
                    renamed: [],
                    files: [],
                    ahead: 0,
                    behind: 0,
                    current: 'main',
                    tracking: null,
                    detached: false
                } as StatusResult);

                // 执行测试
                await gitAutoCommit.main(gitStub, mockOpenAIClient, true);

                // 验证结果
                expect(gitStub.add.calledWith(['file1.ts', 'file2.ts'])).to.be.true;
                expect(gitStub.commit.calledWith('feat: 测试提交信息')).to.be.true;
                expect(consoleLogStub.calledWith('提交成功！')).to.be.true;
                expect(mockReadline.question.called).to.be.false;
            });

            it('应该在自动确认模式下处理错误情况', async () => {
                // 设置存根
                gitStub.checkIsRepo.resolves(true);
                gitStub.status.resolves({ 
                    isClean: () => false,
                    staged: ['file1.ts'],
                    modified: ['file2.ts'],
                    deleted: [],
                    not_added: [],
                    conflicted: [],
                    created: [],
                    renamed: [],
                    files: [],
                    ahead: 0,
                    behind: 0,
                    current: 'main',
                    tracking: null,
                    detached: false
                } as StatusResult);
                generateAIMessageStub.rejects(new Error('AI服务错误：服务暂时不可用'));

                try {
                    // 执行测试
                    await gitAutoCommit.main(gitStub, mockOpenAIClient, true);
                    // 如果没有抛出错误，测试应该失败
                    expect.fail('应该抛出错误');
                } catch (error: any) {
                    // 验证结果
                    expect(consoleErrorStub.calledWith('错误：', 'AI服务错误：服务暂时不可用')).to.be.true;
                    expect(processExitStub.calledWith(1)).to.be.true;
                    expect(gitStub.commit.called).to.be.false;
                }
            });

            it('应该在自动确认模式下处理没有变更的情况', async () => {
                // 设置存根
                gitStub.checkIsRepo.resolves(true);
                gitStub.status.resolves({ 
                    isClean: () => true,
                    staged: [],
                    modified: [],
                    deleted: [],
                    not_added: [],
                    conflicted: [],
                    created: [],
                    renamed: [],
                    files: [],
                    ahead: 0,
                    behind: 0,
                    current: 'main',
                    tracking: null,
                    detached: false
                } as StatusResult);

                try {
                    // 执行测试
                    await gitAutoCommit.main(gitStub, mockOpenAIClient, true);
                    // 如果没有抛出错误，测试应该失败
                    expect.fail('应该抛出错误');
                } catch (error: any) {
                    // 验证结果
                    expect(consoleErrorStub.calledWith('错误：', '没有检测到需要提交的变更')).to.be.true;
                    expect(processExitStub.calledWith(1)).to.be.true;
                    expect(gitStub.commit.called).to.be.false;
                }
            });
        });

        describe('语言选项', () => {
            it('应该在英文模式下自动执行提交', async () => {
                // 设置存根
                gitStub.checkIsRepo.resolves(true);
                gitStub.status.resolves({ 
                    isClean: () => false,
                    staged: ['file1.ts'],
                    modified: ['file2.ts'],
                    deleted: [],
                    not_added: [],
                    conflicted: [],
                    created: [],
                    renamed: [],
                    files: [],
                    ahead: 0,
                    behind: 0,
                    current: 'main',
                    tracking: null,
                    detached: false
                } as StatusResult);
                generateAIMessageStub.withArgs(
                    gitStub,
                    mockOpenAIClient,
                    { language: 'en' }
                ).resolves('feat: test commit message');

                // 执行测试
                await gitAutoCommit.main(gitStub, mockOpenAIClient, true, { language: 'en' });

                // 验证结果
                expect(gitStub.add.calledWith(['file1.ts', 'file2.ts'])).to.be.true;
                expect(gitStub.commit.calledWith('feat: test commit message')).to.be.true;
                expect(consoleLogStub.calledWith('Commit successful!')).to.be.true;
                expect(mockReadline.question.called).to.be.false;
            });

            it('应该在英文模式下等待用户确认', async () => {
                // 设置存根
                gitStub.checkIsRepo.resolves(true);
                gitStub.status.resolves({ 
                    isClean: () => false,
                    staged: ['file1.ts'],
                    modified: ['file2.ts'],
                    deleted: [],
                    not_added: [],
                    conflicted: [],
                    created: [],
                    renamed: [],
                    files: [],
                    ahead: 0,
                    behind: 0,
                    current: 'main',
                    tracking: null,
                    detached: false
                } as StatusResult);
                generateAIMessageStub.withArgs(
                    gitStub,
                    mockOpenAIClient,
                    { language: 'en' }
                ).resolves('feat: test commit message');
                
                // 模拟用户输入 'y'
                mockReadline.question.callsFake((query: string, callback: (answer: string) => void) => {
                    callback('y');
                });

                // 执行测试
                await gitAutoCommit.main(gitStub, mockOpenAIClient, false, { language: 'en' });

                // 验证结果
                expect(gitStub.add.calledWith(['file1.ts', 'file2.ts'])).to.be.true;
                expect(gitStub.commit.calledWith('feat: test commit message')).to.be.true;
                expect(consoleLogStub.calledWith('Commit successful!')).to.be.true;
                expect(mockReadline.question.calledWith('\nConfirm commit? (y/n) ')).to.be.true;
            });

            it('应该在英文模式下处理错误情况', async () => {
                // 设置存根
                gitStub.checkIsRepo.resolves(true);
                gitStub.status.resolves({ 
                    isClean: () => false,
                    staged: ['file1.ts'],
                    modified: ['file2.ts'],
                    deleted: [],
                    not_added: [],
                    conflicted: [],
                    created: [],
                    renamed: [],
                    files: [],
                    ahead: 0,
                    behind: 0,
                    current: 'main',
                    tracking: null,
                    detached: false
                } as StatusResult);
                generateAIMessageStub.rejects(new Error('AI Service Error: Service Temporarily Unavailable'));

                try {
                    // 执行测试
                    await gitAutoCommit.main(gitStub, mockOpenAIClient, true, { language: 'en' });
                    // 如果没有抛出错误，测试应该失败
                    expect.fail('应该抛出错误');
                } catch (error: any) {
                    // 验证结果
                    expect(consoleErrorStub.calledWith('Error: ', 'AI Service Error: Service Temporarily Unavailable')).to.be.true;
                    expect(processExitStub.calledWith(1)).to.be.true;
                    expect(gitStub.commit.called).to.be.false;
                }
            });

            it('应该正确处理 --language 参数', async () => {
                // 设置存根
                gitStub.checkIsRepo.resolves(true);
                gitStub.status.resolves({ 
                    isClean: () => false,
                    staged: ['file1.ts'],
                    modified: [],
                    deleted: [],
                    not_added: [],
                    conflicted: [],
                    created: [],
                    renamed: [],
                    files: [{ path: 'file1.ts', index: 'A', working_dir: 'M' }],
                    ahead: 0,
                    behind: 0,
                    current: 'main',
                    tracking: null,
                    detached: false
                } as StatusResult);
                gitStub.add.resolves();
                gitStub.commit.resolves();
                generateAIMessageStub.resolves('feat: implement new feature');

                // 执行测试
                await gitAutoCommit.main(gitStub, mockOpenAIClient, true, { language: 'en' });

                // 验证结果
                expect(generateAIMessageStub.calledWith(
                    gitStub,
                    mockOpenAIClient,
                    { language: 'en' }
                )).to.be.true;
                expect(gitStub.commit.called).to.be.true;
            });

            it('应该在英文模式下正确显示操作结果', async () => {
                // 设置存根
                gitStub.checkIsRepo.resolves(true);
                gitStub.status.resolves({ 
                    isClean: () => false,
                    staged: ['file1.ts'],
                    modified: [],
                    deleted: [],
                    not_added: [],
                    conflicted: [],
                    created: [],
                    renamed: [],
                    files: [{ path: 'file1.ts', index: 'A', working_dir: 'M' }],
                    ahead: 0,
                    behind: 0,
                    current: 'main',
                    tracking: null,
                    detached: false
                } as StatusResult);
                gitStub.add.resolves();
                gitStub.commit.resolves();
                generateAIMessageStub.resolves('feat: implement new feature');

                // 执行测试
                await gitAutoCommit.main(gitStub, mockOpenAIClient, true, { language: 'en' });

                // 验证结果
                expect(consoleLogStub.calledWith(sinon.match(/Files to be committed/))).to.be.true;
                expect(consoleLogStub.calledWith(sinon.match(/Staged files/))).to.be.true;
                expect(consoleLogStub.calledWith(sinon.match(/Generated commit message/))).to.be.true;
                expect(consoleLogStub.calledWith(sinon.match(/Commit successful/))).to.be.true;
            });
        });
    });
}); 